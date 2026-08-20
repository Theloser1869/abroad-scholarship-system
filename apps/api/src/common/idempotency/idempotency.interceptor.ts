import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { Request } from 'express';
import { Observable, from, of } from 'rxjs';
import { concatMap, switchMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

export const IDEMPOTENT_KEY = 'idempotent';

/// Marks a mutating route as transaction-sensitive, per 02_API_FOUNDATION.md
/// "idempotency strategy cho transaction-sensitive endpoint" (e.g. contract creation,
/// payment recording — anything where a retried POST must not double-create).
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/// Strategy: the caller sends `Idempotency-Key: <client-generated-uuid>` on a POST marked
/// `@Idempotent()`. First time a key is seen, the request runs normally and the response is
/// stored against that key (docs/database/schema.prisma `IdempotencyKey`, TTL-based
/// cleanup — see AUTH_JWT_SECRET-style env var IDEMPOTENCY_KEY_TTL_HOURS). Any later request
/// with the same key AND the same request body returns the stored response without
/// re-running the handler. The same key with a DIFFERENT body is a client bug — rejected
/// with 409, not silently executed twice under one key.
///
/// This is a request-scoped safety net, not a substitute for a DB-level unique constraint
/// on the underlying business record — both apply.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isIdempotent) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const key = req.header(IDEMPOTENCY_KEY_HEADER);
    if (!key) {
      // No key supplied: the interceptor does not force one at this layer (a route may
      // choose to require it via its own DTO/validation) — it simply cannot deduplicate.
      return next.handle();
    }

    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');

    return from(this.prisma.idempotencyKey.findUnique({ where: { key } })).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'This Idempotency-Key was already used with a different request body.',
            });
          }
          // Nest applies the route's own default status code (e.g. 201 for a bare POST
          // handler, since no @HttpCode() override is used on the idempotent routes this
          // interceptor guards today) after the interceptor chain resolves, regardless of
          // what we return here — replaying the cached body goes through that same
          // handler, so the status lines up with the original response without us having
          // to re-derive it from a `responseStatus` column.
          return of(existing.responseBody);
        }

        // concatMap (not tap+void) so the response is only sent once the idempotency
        // record is durably stored — a fire-and-forget write here would let a fast retry
        // race the write and slip past the findUnique check above.
        return next.handle().pipe(
          concatMap(async (body) => {
            await this.store(key, req.path, requestHash, body);
            return body;
          }),
        );
      }),
    );
  }

  private async store(key: string, path: string, requestHash: string, body: unknown): Promise<void> {
    const ttlHours = Number(this.config.get<string>('IDEMPOTENCY_KEY_TTL_HOURS') ?? '24');
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await this.prisma.idempotencyKey.create({
      data: {
        key,
        requestPath: path,
        requestHash,
        // Round-trip through JSON.stringify/parse (what Express's own res.json() does)
        // before handing it to Prisma's `Json` column — passed as a raw object, Prisma's
        // own wire serialization turns a `Prisma.Decimal` field (e.g. Payment.amount,
        // Contract.value) into a JSON *number*, while the original response actually sent
        // to the client used `Decimal.toJSON()` and serialized it as a *string*. Without
        // this, a replayed idempotent response for any money-bearing endpoint (05-commercial
        // Contract/Payment being exactly the routes this interceptor exists for) would
        // silently differ in field type from the original — found by
        // apps/api/test/payments.e2e-spec.ts's duplicate-transaction-protection test.
        responseBody: (body === undefined ? null : JSON.parse(JSON.stringify(body))) as never,
        expiresAt,
      },
    });
  }
}
