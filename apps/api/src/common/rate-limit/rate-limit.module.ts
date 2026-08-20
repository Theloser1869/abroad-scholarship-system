import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

/// Phase 14 hardening — NFR-SEC-06 "Rate limit login/API; chống brute force" was only
/// half-built through Phase 13 (login's own account-lockout mechanism; no general API
/// limiter — see docs/ASSUMPTIONS.md ASM-56, now closed). The global default here is
/// deliberately generous (this is an internal staff/portal system, not a public
/// high-traffic consumer API) — its job is blocking scripted abuse/resource exhaustion,
/// not shaping normal usage. `POST /auth/login` additionally carries its own tighter
/// `@Throttle` override (see AuthController) on top of the existing per-account lockout,
/// so brute-forcing is bounded both per-account (lockout) and per-IP (this).
///
/// `skipIf: NODE_ENV==='test'` mirrors the identical, already-vetted pattern `JobsModule`/
/// `SchedulerModule` use (Phase 12) — the e2e suite fires many rapid successive requests
/// per spec file under `--runInBand`, and Jest sets NODE_ENV=test by default; without this
/// the limiter would produce test flakiness unrelated to product behavior, not a real
/// safety gap (a `--runInBand` Jest suite is not an internet-facing client).
///
/// In-memory storage (the package default) is single-instance-scoped — fine for the
/// current single-instance deployment model (same scope note as `LocalFilesystemStorage
/// Provider`); a multi-instance deployment needs a shared store (e.g. Redis-backed
/// `ThrottlerStorage`) to make limits hold across instances. See docs/production/
/// SECURITY_BASELINE.md.
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
          limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
        },
      ],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
