# Production Runbook — Phase 14

Every command below was actually run against a real Docker image and a real PostgreSQL instance during this phase — this is a verified procedure, not a description of an untested one.

**Status note**: a formal go-live attempt (post-Phase-14) confirmed this procedure is ready to execute the moment a real production target exists, but was blocked from actually running against production because no production database, domain/TLS, CI/CD connection, or off-host backup exists anywhere in this project. See `docs/production/GO_LIVE_REPORT.md` for the full account and exact remediation steps.

## 1. Prerequisites

- PostgreSQL 16 (or compatible), reachable via `DATABASE_URL`.
- A container runtime (this repo ships a verified `Dockerfile`) or a Node 22 runtime if deploying without containers.
- A persistent volume for `DOCUMENT_STORAGE_DIR` if using the default local-disk `StorageProvider` — see `docs/production/SECURITY_BASELINE.md` "Storage" for why this is a single-instance-only arrangement.
- A reverse proxy / load balancer terminating TLS in front of this process (the application itself serves plain HTTP — see `SECURITY_BASELINE.md` "Transport / headers").
- A real secret-management mechanism to supply the six required secrets below (this repository has no built-in secret manager integration — that's a deployment-environment concern).
- Off-host backup storage and a scheduled backup job — **not provisioned in this environment; see Known Risks in `docs/phase-status/PHASE_14.md`. This is a genuine production blocker, not optional.**

## 2. Required environment variables

See `.env.example` for the full, commented list. The ones that MUST be real, generated, unique-per-environment secrets in production (never the committed dev/example values — `main.ts`'s `assertProductionConfigSafe()` refuses to boot with `NODE_ENV=production` if any of these still match a known placeholder):

| Variable | Generate with |
|---|---|
| `AUTH_JWT_SECRET` | any high-entropy random string from your secret manager |
| `AUTH_MFA_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (must be exactly 32 bytes / 64 hex chars) |
| `DOCUMENT_SIGNING_SECRET` | same as `AUTH_JWT_SECRET` |
| `ESIGN_WEBHOOK_SECRET` | same as `AUTH_JWT_SECRET` — must match whatever the e-signature provider is configured to sign with |
| `DATABASE_URL` | your real production Postgres connection string |

Also required/important:

- **`NODE_ENV=production`** — mandatory. Without it, `AuthService.requestPasswordReset`/`PortalAccessService`'s dev-only-token-in-response behavior stays active, a real information-leak in production. `assertProductionConfigSafe()` does not itself check that `NODE_ENV` is set correctly (it can't distinguish "intentionally not production" from "operator forgot") — this must be a deployment-checklist item, not just a code check.
- `AUTH_COOKIE_SECURE` — leave unset/default (`true`) in production; the boot-time validator refuses `false`.
- `CORS_ALLOWED_ORIGINS` — set to your real frontend origin(s) once one exists; empty means no browser origin can call this API at all.
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` — tune for real traffic; defaults (120 req/60s/IP) are a conservative starting point for an internal staff+portal system.

## 3. Deployment order

1. **Config validation** — the application itself performs this at boot (`assertProductionConfigSafe()`, step 1 of `bootstrap()` in `main.ts`) before anything else runs. Nothing to do manually beyond ensuring the environment variables above are actually set — the app will refuse to start otherwise.
2. **Migration policy** — `prisma migrate deploy` (never `migrate dev`, never `db push`, never `migrate reset` — this phase's instructions are explicit: "Không dùng: prisma migrate reset, db push, destructive development migration trong production readiness workflow"). Run this as its own explicit, auditable step — a separate command/CI job, never auto-executed inside the application's own boot sequence (which would risk multiple replicas racing to apply migrations simultaneously on a rolling deploy). Verified command:
   ```bash
   DATABASE_URL="<production-url>" npx prisma migrate deploy --schema=database/schema.prisma
   ```
3. **Seed policy** — `npm run db:seed` (`prisma db seed`) IS required once, in every environment including production — it's how the role/permission matrix and the bootstrap `admin` user get created; there's no separate "production-safe" script. Verified this phase (against an isolated scratch database, not the shared dev database):
   - The role/permission catalogue always seeds.
   - The demo/fixture users (`demo.director`, `demo.finance`, ~20 more, shared publicly-known password, RBAC-e2e-test-only) are gated behind `NODE_ENV !== 'production'` and were confirmed to NOT be created when `NODE_ENV=production` — a fresh production seed run leaves exactly one row in `users` (the bootstrap admin).
   - **`BOOTSTRAP_ADMIN_PASSWORD` is now required (Phase 14 fix) whenever `NODE_ENV=production`** — the seed script previously created the bootstrap `admin` account with a fixed, source-committed password (`ChangeMe!123`) *unconditionally*, a real credential-exposure risk for a first-time production deploy. It now fails closed (throws, seed does not complete) if `NODE_ENV=production` and this variable isn't set — verified live: the seed run failed with a clear error message when the variable was absent, and succeeded (creating exactly one `admin` user with the supplied password, zero demo fixtures) once it was set.
   - Command: `DATABASE_URL="<production-url>" NODE_ENV=production BOOTSTRAP_ADMIN_PASSWORD="<a-real-generated-password>" npx prisma db seed --schema=database/schema.prisma`.
   - Re-running the seed later is safe (idempotent upserts) and will NOT reset the admin password if `BOOTSTRAP_ADMIN_PASSWORD` changes — the `admin` user's `update: {}` clause only touches it on first creation.
   - **Executed for the live Render + Supabase deployment** (see `docs/DEPLOYMENT_FREE.md` "Bootstrap admin procedure"): production `users` table holds exactly one `admin` row (`SYSTEM_ADMIN`, `ACTIVE`, hashed password), zero business-fixture rows, re-run confirmed idempotent (no duplicate, unchanged `createdAt`/hash), and login/session/RBAC-deny/logout all verified live. No password printed or committed anywhere in that record.
   - **Adding a second admin/staff account**: not yet a self-service or API-exposed flow (`UsersController` has no `create` endpoint). Until one exists, provision the same way as the bootstrap admin — extend the seed script's upsert logic (or an equivalent one-off script) with a real operator-supplied password.
4. **Application startup** — the compiled entrypoint directly, never through `npm start`/`nest start` in production (those wrap the process and can interfere with signal propagation — see graceful shutdown below):
   ```bash
   node apps/api/dist/main.js
   ```
   Or via the verified Docker image (see §6).
5. **Worker startup** — no separate worker process exists. The background-job poller (`JobRunnerService`) and scheduler (`SchedulerService`) run in-process, inside the same application instance, auto-starting on boot (gated only by `NODE_ENV!=='test'` — see `docs/ASSUMPTIONS.md` ASM-52 for why this is a deliberate DB-backed-queue-instead-of-Redis/BullMQ architecture choice). **Running more than one application instance means more than one poller/scheduler running concurrently** — this is safe for the poller (jobs are claimed atomically, `JOB_POLL_INTERVAL_MS`) and safe for the scheduler (enqueue calls are dedupe-keyed per UTC calendar day), but is a real scaling/cost consideration to know about, not a correctness bug.
6. **Scheduler startup** — same process as above, no separate step.
7. **Health checks** — see §4.
8. **Smoke tests** — see §5.

## 4. Health checks

| Endpoint | Purpose | Checks |
|---|---|---|
| `GET /health` | Liveness | Process is up and can handle a request at all. No dependency checks — a container orchestrator restarts the process on failure here, so this must never fail merely because the database is temporarily down. |
| `GET /health/ready` | Readiness | Real database connectivity (`SELECT 1` via Prisma). A `503` here tells a load balancer to stop routing new traffic to this instance without killing it. |

Both are `@Public()` (no auth required — an orchestrator polls these before any session exists) and `@SkipThrottle()` (exempt from rate limiting — frequent orchestrator polling must never trip it). Verified live via `curl` during this phase, both returning 200 with the expected body against a real Postgres connection.

Docker `HEALTHCHECK` is built into the verified `Dockerfile` (30s interval, calls `GET /health`).

## 5. Smoke tests (run after every deploy)

Minimum checklist, all verified reachable during this phase:

1. `curl <base-url>/health` → `200 {"status":"ok"}`.
2. `curl <base-url>/health/ready` → `200 {"status":"ok","database":"ok"}`.
3. `POST <base-url>/auth/login` with invalid credentials → `401`, error contract shape intact, `X-RateLimit-*` headers present.
4. `GET <base-url>/this-route-does-not-exist` → `404` with the standard error contract (`{"error":{"code":"NOT_FOUND",...}}`) — confirms the global exception filter is wired and not leaking a stack trace or framework default page.
5. Confirm security headers are present on any response (`curl -i`): `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`.
6. A real login with valid staff credentials, followed by one representative authenticated `GET` (e.g. `GET /reports/me`), confirms the full auth chain (JWT issuance → `AuthContextMiddleware` → `AuthGuard` → permission check) end-to-end.

## 6. Docker (verified build + run + graceful shutdown, this phase)

```bash
# Build (multi-stage — builder has devDependencies for compiling; runtime does not)
docker build -t abroad-scholarship-api:<tag> .

# Run
docker run -d \
  -e NODE_ENV=production \
  -e DATABASE_URL="..." -e AUTH_JWT_SECRET="..." -e AUTH_MFA_ENCRYPTION_KEY="..." \
  -e DOCUMENT_SIGNING_SECRET="..." -e ESIGN_WEBHOOK_SECRET="..." \
  -p 3000:3000 \
  abroad-scholarship-api:<tag>
```

Verified this phase, against a real Postgres container on a shared Docker network:
- Clean boot with `NODE_ENV=production` and real (non-placeholder) secrets — `assertProductionConfigSafe()` passed, application started, `/health/ready` returned 200 confirming real DB connectivity.
- Runs as a non-root user (`app`, created in the image) — never root inside the container.
- `docker stop` (sends SIGTERM, the same signal a real orchestrator sends before SIGKILL) completed in ~1.1 seconds with a clean exit code (0) and the log line `"SIGTERM received, shutting down gracefully..."` — `node` runs directly as PID 1 (no shell wrapper swallowing the signal), and `app.enableShutdownHooks()` + the explicit SIGTERM/SIGINT handler in `main.ts` work as designed.

## 7. Rollback

- **Application code**: redeploy the previous known-good image tag. Stateless beyond the database — no application-level rollback data to reconcile as long as no migration was applied in the failed deploy.
- **Database migrations**: Prisma's `migrate deploy` has no built-in automatic "down" migration. If a migration in a failed deploy needs reverting: (1) assess whether the migration was purely additive (every migration in this project has been — new nullable/defaulted columns, new tables, new indexes; see `database/migrations/*` — none has ever dropped or renamed an existing column in place) and whether simply rolling back application code alongside a schema that's a strict superset of what the old code expects is sufficient (usually yes, for additive migrations); (2) if a genuine rollback of schema is required, write and review a new forward migration that reverses the change — never hand-edit `_prisma_migrations` or run a destructive command against production.
- **Never** use `prisma migrate reset` or `db push` against a production database, ever, for any reason, rollback included — both are explicitly named as forbidden in this phase's own instructions.

## 8. Incident response

1. Check `/health/ready` first — distinguishes "the app is up but the database is unreachable" from "the app itself is down."
2. Check application logs for `[ErrorContractFilter]`-tagged 5xx entries — every unhandled exception is logged server-side with its `requestId` and full stack trace (never exposed to the client — see `SECURITY_BASELINE.md`), so correlate a user-reported `requestId` directly to a log line.
3. Check `GET /admin/jobs` (SYSTEM_ADMIN only, `jobs:view`) for a backlog of `FAILED`/stuck `PENDING` background jobs — a growing backlog usually means a downstream dependency (email provider, external sync target) is failing, not the application itself.
4. Check `GET /audit-logs` for a spike in `DENIED`/`ERROR` results around the incident window — can distinguish an auth/permission misconfiguration from a genuine application bug.
5. If the database itself is suspected: `/health/ready`'s `503` plus a direct `psql`/connection check to the database host narrows it to infra vs. application.
6. For a full outage requiring restore-from-backup, follow `docs/production/DISASTER_RECOVERY.md`'s verified restore procedure.

## 9. Backup / restore reference

See `docs/production/DISASTER_RECOVERY.md` for the full, drill-verified procedure, RPO/RTO assumptions, and what restore does and does not cover.
