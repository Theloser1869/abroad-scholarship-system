import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, from, throwError } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

export const AUDIT_ACTION_KEY = 'auditAction';

/// Declares which audit `action` a route represents (SRS section 1/21: VIEW, EDIT,
/// DOWNLOAD, EXPORT, SHARE, DELETE, LOGIN). Routes without this decorator are not audited
/// — audit is opt-in per endpoint, not blanket-logged for every GET, to keep AuditLog to
/// the sensitive operations SRS actually asks for.
export const Audit = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);

declare module 'express' {
  interface Request {
    /// A handler may attach action-specific context here before returning (e.g. export's
    /// reason/filter/row-count/fields — SRS 6.21) and the interceptor folds it into
    /// `audit_logs.metadata`. Optional; most audited routes leave it unset.
    auditMetadata?: Record<string, unknown>;
  }
}

/// Cross-cutting audit hook (02_API_FOUNDATION.md "audit hook"). One interceptor every
/// `@Audit(action)`-decorated route goes through, instead of each domain module hand-
/// rolling its own audit write (TARGET_ARCHITECTURE.md section 8 / section 15: audit
/// boundary lives at the API layer). Writes AFTER the handler resolves so `result` and
/// `objectId` (for creates) are known; still writes on failure with result="DENIED"/"ERROR"
/// so denied attempts are auditable too (SRS section 1: "Mọi thao tác nhạy cảm... phải có
/// audit trail" — a rejected attempt is exactly the kind of event that must not go dark).
///
/// The write is always awaited (`concatMap`, not a fire-and-forget `tap`) before the
/// response completes or the error is rethrown — an earlier version of the sibling
/// idempotency interceptor had exactly this fire-and-forget bug and a race condition
/// slipped through as a result (see docs/api/API_CONVENTIONS.md section 9); the audit hook
/// is written the same, safer way from the start.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const objectType = context.getClass().name.replace(/Controller$/, '');

    return next.handle().pipe(
      concatMap(async (result) => {
        await this.write(req, action, objectType, 'SUCCESS', result);
        return result;
      }),
      catchError((err) => {
        const result = err?.status === 401 || err?.status === 403 ? 'DENIED' : 'ERROR';
        return from(this.write(req, action, objectType, result, undefined)).pipe(
          concatMap(() => throwError(() => err)),
        );
      }),
    );
  }

  private async write(
    req: Request,
    action: string,
    objectType: string,
    result: 'SUCCESS' | 'DENIED' | 'ERROR',
    payload: unknown,
  ): Promise<void> {
    const objectId = this.extractObjectId(req, payload);
    await this.prisma.auditLog.create({
      data: {
        actorId: req.principal?.userId,
        action,
        objectType,
        objectId,
        studentId: this.extractStudentId(req, objectId, payload),
        caseId: this.extractCaseId(req, objectId),
        result,
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
        metadata: req.auditMetadata as never,
        requestId: req.requestId,
      },
    });
  }

  private extractObjectId(req: Request, payload: unknown): string | undefined {
    const paramId = req.params?.id;
    if (typeof paramId === 'string' && paramId.length > 0) {
      return paramId;
    }
    if (payload && typeof payload === 'object' && 'id' in payload) {
      const id = (payload as { id?: unknown }).id;
      return typeof id === 'string' ? id : undefined;
    }
    return undefined;
  }

  /// Best-effort: populated whenever the route's own object either IS a Student
  /// (objectId === studentId) or carries a `studentId` field directly (a Case response
  /// always does — SRS 6.21 wants audit rows filterable by student regardless of which
  /// entity the action was actually performed on).
  private extractStudentId(req: Request, objectId: string | undefined, payload: unknown): string | undefined {
    if (req.path.startsWith('/students')) {
      return objectId;
    }
    if (payload && typeof payload === 'object' && 'studentId' in payload) {
      const studentId = (payload as { studentId?: unknown }).studentId;
      return typeof studentId === 'string' ? studentId : undefined;
    }
    return undefined;
  }

  /// Best-effort: populated when the route's own object IS a Case (objectId === caseId).
  private extractCaseId(req: Request, objectId: string | undefined): string | undefined {
    if (req.path.startsWith('/cases/') || req.path === '/cases') {
      // Sub-routes like /cases/:id/stage still have the case id as the first path
      // segment's :id param, which extractObjectId already resolved from req.params.id
      // when present; for those, objectId IS the case id.
      return objectId;
    }
    return undefined;
  }
}
