import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express, { Request } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertProductionConfigSafe } from './common/config/assert-production-config';

declare module 'express' {
  interface Request {
    /// Phase 12 — the exact raw bytes of a JSON request body, captured before parsing.
    /// Needed only by the webhook signature-verification path (`WebhooksController`),
    /// which must verify a provider's HMAC signature against the bytes actually sent, not
    /// a re-serialized `JSON.stringify(req.body)` (re-serialization is not guaranteed to
    /// byte-match the original and would make signature verification unreliable).
    rawBody?: Buffer;
  }
}

async function bootstrap() {
  // Phase 14 hardening — step 1 of production startup (config validation), before
  // anything else runs. Only ever throws when NODE_ENV=production; every other
  // environment is unaffected. See assert-production-config.ts.
  assertProductionConfigSafe();

  // Default body parsing disabled, then re-enabled manually with a `verify` hook so every
  // route's `req.body` behaves EXACTLY as before (parsed JSON/urlencoded, unchanged),
  // while also capturing the raw bytes onto `req.rawBody` for the one route that needs
  // them. Purely additive — no route's existing request-handling behavior changes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Phase 14 — security headers. `contentSecurityPolicy` set to `default-src 'none'`: this
  // process serves a JSON API only, never HTML/JS/CSS of its own, so there is nothing for a
  // permissive CSP to protect and a maximally-restrictive one costs nothing.
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } } }));

  // Phase 14 — CORS is closed (`origin: false`) unless explicitly configured. This is a
  // bearer-token API; the one cookie in use (the refresh token) is already `SameSite:
  // Strict` (see AuthController), so CORS's job here is solely "which browser origins may
  // call this API with fetch()/XHR at all" for a future frontend — never wildcarded
  // (`credentials: true` + `origin: '*'` is invalid/unsafe together), always an explicit,
  // operator-configured allowlist.
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });

  app.use(express.json({ verify: (req: Request, _res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Phase 14 — graceful shutdown. Without `enableShutdownHooks()`, Nest never invokes the
  // `onModuleDestroy` lifecycle hooks `JobRunnerService`/`SchedulerService`/`PrismaService`
  // already correctly implement (Phase 12/02) — they'd simply never run in a real
  // container orchestrator's SIGTERM-then-SIGKILL shutdown sequence. `app.close()` on
  // SIGTERM/SIGINT stops accepting new connections, lets in-flight requests finish, then
  // runs every module's `onModuleDestroy` (interval timers cleared, DB connection closed)
  // before the process exits.
  app.enableShutdownHooks();
  const logger = new Logger('Bootstrap');
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      logger.log(`${signal} received, shutting down gracefully...`);
      app
        .close()
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('Error during shutdown', err instanceof Error ? err.stack : undefined);
          process.exit(1);
        });
    });
  }

  // Render (and most PaaS free tiers) inject `PORT` and require the app to bind to it —
  // it always wins over `API_PORT` when set. `API_PORT` stays the local-dev-friendly name
  // (predates the free-remote-deployment target) and remains the fallback everywhere PORT
  // isn't set.
  const port = process.env.PORT ?? process.env.API_PORT ?? 3000;
  await app.listen(port);
  logger.log(`Listening on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? 'unset'})`);
}

bootstrap();
