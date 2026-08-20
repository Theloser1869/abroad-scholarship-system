import { createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

const WEBHOOK_SECRET = process.env.ESIGN_WEBHOOK_SECRET ?? 'dev-only-esign-webhook-secret-not-for-production-use';

function sign(body: object): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(body)).digest('hex');
}

/// 12-platform/02_INTEGRATIONS_JOBS.md — Webhooks: signature verification, idempotency,
/// event ID storage, retry, audit. This test app instance replicates `main.ts`'s
/// `bodyParser:false` + manual `express.json({ verify })` setup — the ONE thing every
/// other e2e test file's default `createNestApplication()` doesn't need, since only this
/// route reads `req.rawBody` for HMAC verification.
describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(
      express.json({
        verify: (req: express.Request, _res, buf) => {
          req.rawBody = buf;
        },
      }),
    );
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a correctly-signed event, records it (idempotency-ready), and audits it', async () => {
    const body = { eventId: randomUUID(), status: 'completed' };
    const signature = sign(body);

    const res = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', signature).send(body);
    expect(res.status).toBe(201);
    expect(res.body.received).toBe(true);
    expect(res.body.duplicate).toBe(false);

    const stored = await prisma.incomingWebhookEvent.findUnique({ where: { source_eventId: { source: 'esign', eventId: body.eventId } } });
    expect(stored?.signatureValid).toBe(true);
    expect(stored?.status).toBe('PROCESSED');

    const auditRow = await prisma.auditLog.findFirst({ where: { action: 'CREATE', objectType: 'Webhooks' }, orderBy: { createdAt: 'desc' } });
    expect(auditRow).not.toBeNull();
    expect((auditRow?.metadata as { eventId?: string })?.eventId).toBe(body.eventId);
  });

  it('rejects a forged/incorrect signature — never processes the event, but still records/audits the attempt', async () => {
    const body = { eventId: randomUUID(), status: 'completed' };

    const res = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', 'not-the-real-signature').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');

    const stored = await prisma.incomingWebhookEvent.findUnique({ where: { source_eventId: { source: 'esign', eventId: body.eventId } } });
    expect(stored?.signatureValid).toBe(false);
    expect(stored?.status).toBe('REJECTED');

    const auditRow = await prisma.auditLog.findFirst({ where: { action: 'CREATE', objectType: 'Webhooks' }, orderBy: { createdAt: 'desc' } });
    expect(auditRow).not.toBeNull(); // even a rejected/forged attempt is auditable, not silently dropped
  });

  it('rejects a request with a missing signature header entirely', async () => {
    const body = { eventId: randomUUID(), status: 'completed' };
    const res = await request(app.getHttpServer()).post('/webhooks/esign').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('rejects a body with no eventId', async () => {
    const body = { status: 'completed' };
    const res = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', sign(body)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_EVENT_ID');
  });

  it('replay protection — the exact same event delivered twice is recognized as a duplicate, not reprocessed as new', async () => {
    const body = { eventId: randomUUID(), status: 'completed' };
    const signature = sign(body);

    const first = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', signature).send(body);
    expect(first.body.duplicate).toBe(false);

    const replay = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', signature).send(body);
    expect(replay.status).toBe(201);
    expect(replay.body.duplicate).toBe(true);

    const count = await prisma.incomingWebhookEvent.count({ where: { source: 'esign', eventId: body.eventId } });
    expect(count).toBe(1); // never a second row for the same (source, eventId)
  });

  // Phase 13 MEDIUM-fix regression — a forged delivery that guesses/intercepts an eventId
  // ahead of the real one used to permanently occupy the (source, eventId) slot as
  // REJECTED, so the legitimate provider's later, correctly-signed delivery under the same
  // id was silently treated as a "duplicate" and never marked PROCESSED. The forged attempt
  // must never be able to block the real event from ever being processed.
  it('a forged delivery under a guessed eventId never blocks the later legitimately-signed delivery of the same event', async () => {
    const body = { eventId: randomUUID(), status: 'completed' };

    const forged = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', 'not-the-real-signature').send(body);
    expect(forged.status).toBe(400);

    const real = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', sign(body)).send(body);
    expect(real.status).toBe(201);
    expect(real.body.duplicate).toBe(false);

    const stored = await prisma.incomingWebhookEvent.findUnique({ where: { source_eventId: { source: 'esign', eventId: body.eventId } } });
    expect(stored?.signatureValid).toBe(true);
    expect(stored?.status).toBe('PROCESSED');
    const count = await prisma.incomingWebhookEvent.count({ where: { source: 'esign', eventId: body.eventId } });
    expect(count).toBe(1); // upgraded in place, never a second row

    // A genuine replay of the now-valid event still can't be reprocessed a second time.
    const replay = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', sign(body)).send(body);
    expect(replay.body.duplicate).toBe(true);
  });

  it('is publicly reachable without an Authorization header — the signature IS the authorization', async () => {
    const body = { eventId: randomUUID(), status: 'completed' };
    const res = await request(app.getHttpServer()).post('/webhooks/esign').set('x-webhook-signature', sign(body)).send(body);
    expect(res.status).not.toBe(401);
  });
});
