# PHASE STATUS — PHASE_14 (Production Hardening + Final Architect Review)

## PHASE 14 STATUS: PASS

## PRODUCTION READINESS: PRODUCTION CANDIDATE

Not PRODUCTION READY — every application-layer condition (security, data integrity, config validation, migration safety, health checks, backup/restore *procedure*, deployment procedure, full regression) is verified and green, but a small number of genuinely infrastructure-dependent conditions (automated off-host backups, real alerting/metrics, TLS termination, a connected CI platform) cannot be verified from within this development sandbox — they require the actual target deployment environment, which does not exist here. Per this phase's own instruction: "Không được chọn PRODUCTION READY chỉ vì tất cả tests xanh." See **PRODUCTION BLOCKERS** below for the precise, complete list of what remains.

**Update (post-Phase-14)**: a formal GO-LIVE attempt was subsequently run against this classification and correctly halted at pre-flight — no production infrastructure exists to deploy to. See `docs/production/GO_LIVE_CHECKLIST.md` and `docs/production/GO_LIVE_REPORT.md` for the full pre-flight verification and exact blockers (a superset of, and consistent with, the PRODUCTION BLOCKERS section below).

---

## ENVIRONMENT

- `NODE_ENV` is now the one variable every other production safeguard hinges on — documented as mandatory in `PRODUCTION_RUNBOOK.md` §2, since two real dev-only-token-leak gates (`AuthService.requestPasswordReset`, `PortalAccessService`'s equivalent) depend on it being exactly `"production"`.
- New boot-time config validator (`assertProductionConfigSafe()`) refuses to start when `NODE_ENV=production` and any required secret is missing or still a known dev placeholder, or `AUTH_COOKIE_SECURE=false`. Verified live via a real Docker container boot (clean start with real secrets; the codebase's own independent `MfaEncryption` constructor check also verified to reject a malformed key).
- CORS: closed by default (`origin: false`), opt-in via `CORS_ALLOWED_ORIGINS`. Verified live — a cross-origin request gets no `Access-Control-Allow-Origin` header.
- `.env.example` reviewed: no real secrets, all placeholders clearly labeled, every variable commented with required/optional status and generation instructions. Added `NODE_ENV`, `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX_REQUESTS`, `BOOTSTRAP_ADMIN_PASSWORD`.

## SECRETS

- No real secret committed anywhere in the repository (no `.git` history to leak from — this project has never been a git repository in any phase — and `.env` itself is git-ignored).
- **Real finding, fixed**: `database/seeds/seed.ts`'s bootstrap `admin`/SYSTEM_ADMIN user was created with a fixed, source-committed password (`ChangeMe!123`) *unconditionally*, in every environment including production. Now requires `BOOTSTRAP_ADMIN_PASSWORD` when `NODE_ENV=production` and fails the seed run (never falls back to the default) if absent. Verified live against an isolated scratch database: failed cleanly without the variable, succeeded with exactly one `admin` row (zero demo fixtures) with it set.
- Secrets are never logged, never returned in API responses, never included in error messages (`ErrorContractFilter` returns a generic message for every 5xx, full detail only to the server-side log).
- A real production secret-management mechanism (Vault/Secrets Manager/etc.) is a deployment-environment concern this repository cannot itself provision.

## DATABASE

- Full schema re-reviewed (Final Architect Review): no duplicate entities, no missing FKs beyond a documented naming/consistency-only inconsistency (13 actor-attribution fields lack `@relation` to User — no orphan risk given Hard Rule #5, not fixed, see `docs/FINAL_ARCHITECT_REVIEW.md` §1), one real missing index found and fixed (`DocumentAccess`).
- Every migration across all 21 (now) migrations is additive-only — confirmed by re-reading every migration file; none has ever dropped or renamed an existing column in place.

## MIGRATIONS

- `prisma migrate deploy` run against a fresh copy of the schema history (via the restore-drill scratch database) — reported all migrations applied cleanly, "Database schema is up to date!"
- New migrations this phase: `20260820030000_competition_research_business_id_phase13` (carried over from Phase 13's own fix, applied this phase's session), `20260820040000_document_access_index_phase14`.
- Never used `migrate reset`/`db push` at any point.

## BACKUP

- Real `pg_dump -Fc` backup taken against the live dev database (2.53 MB).
- **No automated/scheduled backup job or off-host storage target is provisioned in this environment** — see PRODUCTION BLOCKERS below (`docs/ASSUMPTIONS.md` ASM-61).

## RESTORE

- **Real, complete restore drill performed** (not a description of an untested procedure): backup → fresh database → `pg_restore` → row-count verification across 8 key tables (students/cases/documents/audit_logs/users/payments/contracts/background_jobs — every one an exact match) → `prisma migrate status` confirms schema/migration-history consistency survived → **the compiled application was actually started against the restored database and its `/health/ready` endpoint confirmed real database connectivity.** Full detail and exact commands in `docs/production/DISASTER_RECOVERY.md`.
- RPO/RTO are documented, business-unconfirmed assumptions (≤24h / ≤4h) — `docs/ASSUMPTIONS.md` ASM-60.

## STORAGE

**ACCEPTED LIMITATION for single-instance deployment; PRODUCTION BLOCKER for multi-instance.** `LocalFilesystemStorageProvider` (Phase 12) writes to local disk — correct and safe for exactly one running instance with a persistent volume, unsafe the moment a second instance is added or the instance is replaced without volume continuity. Migration path to S3-compatible storage is a single `useClass` swap behind the existing `StorageProvider` interface — not implemented (no cloud credentials exist in this environment; building an untested, unverifiable integration would not be real hardening). See `docs/production/SECURITY_BASELINE.md` "Storage."

## SECURITY BASELINE

Full detail in `docs/production/SECURITY_BASELINE.md`. New this phase: security headers (helmet, verified live), CORS (closed-by-default, verified live), general API rate-limiting (closes `docs/ASSUMPTIONS.md` ASM-56, verified live with real rate-limit headers on a real request), boot-time config validation, bootstrap-admin-password fix. Re-verified from Phase 12-13: cookie security, session revocation, webhook signature/replay protection, signed-URL scoping, upload validation chain, IDOR protections, audit-on-guard-deny.

## API HARDENING

- Reviewed every controller for missing auth/authorization, client-controlled ownership, insecure status updates, excessive data exposure, missing pagination — no new finding beyond what Phase 13 already found and fixed.
- Confirmed no stack trace/DB-error/internal-path leakage in any error response — `ErrorContractFilter` returns a generic message for every unhandled exception, full detail logged server-side only (already correctly built, re-verified this phase).
- Payload/upload limits: `DOCUMENT_MAX_SIZE_BYTES` (25MB default) enforced at both the multer-interceptor layer and the service's own validation. Export endpoints (`/reports/cases/export`, `/students/export`) are deliberately unbounded by row count (an export must return everything matching scope) — no hard ceiling exists; noted as a LOW future-hardening item, not a current defect.
- Pagination: `DEFAULT_PAGE_SIZE` enforced on every list endpoint.

## BACKGROUND JOBS

- Retry/backoff/dead-letter/idempotency (dedupeKey) all re-verified working via the existing e2e suite (`jobs-platform.e2e-spec.ts`) plus a fresh idempotency re-check across every registered processor (Final Architect Review §8) — no issue found.
- **"In-process poller has no stuck-job reaper" — assessed explicitly, per this phase's instruction.** Verdict: **ACCEPTED LIMITATION, not a production blocker.** A job claimed by `updateMany` (status→RUNNING) that then crashes mid-processing (the whole process dies) would stay `RUNNING` indefinitely with no automatic re-claim. However: (1) the failure mode requires the *entire Node process* to crash between claiming and completing a job — a narrow window given jobs are typically short (email dispatch, scan status update, reminder sweep); (2) `GET /admin/jobs` (SYSTEM_ADMIN) makes any stuck `RUNNING` row directly observable for manual intervention; (3) building an automatic reaper (a second timer sweeping for stale-RUNNING rows past some threshold) is a real, testable feature addition, not a one-line fix — appropriate for a dedicated future pass, not a rushed same-phase addition. Documented here rather than silently accepted.

## SCHEDULER

- Dedupe-keyed per UTC calendar day — confirmed safe under multiple concurrent application instances (each instance's scheduler enqueues the same dedupe key; only one job row is ever created per day per type).
- Auto-starts on boot unless `NODE_ENV=test` (unchanged from Phase 12, re-verified).

## OBSERVABILITY

**PARTIAL — a real, named gap, not silently treated as adequate.**
- **Logs**: present throughout (NestJS's built-in `Logger`), include correlation (`requestId` on every error-path log line, `correlationId` on every job-processing log line), structured as greppable `key=value` message text — but **not JSON-structured**, which most production log-aggregation pipelines (ELK, CloudWatch Logs Insights, etc.) want for reliable field extraction. Recommend wiring a JSON-output logger (e.g. `nestjs-pino`) before connecting to a real log pipeline — not done this phase (a library swap with its own review surface, not a hardening fix).
- **Audit trail**: comprehensive and queryable (`GET /audit-logs`) — this is the system's strongest observability surface, and it's real (every sensitive mutation, actor, before/after, IP/UA, guard-level denials included per Phase 13's fix).
- **Metrics**: none. No Prometheus/StatsD/equivalent integration exists — request latency, error rate, queue depth, etc. are not exported as metrics, only inferable from logs/the `/admin/jobs` and `/audit-logs` query endpoints.
- **Alerts**: none configured. No PagerDuty/equivalent wiring for DB-down, queue-failing, backup-failure, storage-failure, auth-anomaly, or high-error-rate conditions — these are all currently only discoverable by someone actively looking (health-check polling, log review, `/admin/jobs` review), not proactively surfaced.
- **No sensitive data logged**: verified — no password/token/API-key/signed-URL-secret/document-content logging found anywhere in the codebase (grep-verified).

## HEALTH CHECKS

New this phase, verified live: `GET /health` (liveness, no dependency check) and `GET /health/ready` (readiness, real `SELECT 1` via Prisma). Both `@Public()` + `@SkipThrottle()`. Docker `HEALTHCHECK` wired into the verified `Dockerfile`.

## CI/CD

**Authored, not exercised.** `.github/workflows/ci.yml` created — install → lint → typecheck → dependency-audit → migrate deploy (against a real ephemeral Postgres service container) → unit → e2e → build → Docker-image-build → a deployment gate job. This repository has no git remote/CI platform connected in any phase (confirmed — no `.git` directory exists), so this workflow has never actually run in CI; every command it invokes has been run manually and confirmed passing throughout this phase. Honest classification: reviewed/authored, not exercised — do not represent this as "CI passing."

## DEPENDENCY REVIEW

- `npm audit --omit=dev`: 3 HIGH advisories, single root cause (`deepmerge-ts`, a transitive dependency of the `prisma` CLI devDependency's `@prisma/config`, never reachable from the running application's `@prisma/client` runtime dependency, never processes attacker-controlled input). The suggested fix downgrades `prisma` to 6.12.0 — a real regression, not applied. Documented, accepted risk.
- Lockfile: single `package-lock.json`, npm workspaces, no competing lockfile.
- Node 22 LTS, pinned in the Docker image. One non-blocking `EBADENGINE` warning (a devDependency wants a slightly newer Node patch version) — cosmetic, not a security issue.
- New dependencies added this phase: `helmet@8.3.0`, `@nestjs/throttler@6.5.0` — both current stable releases, peer-dependency-compatible with the existing NestJS 11 stack, `npm audit` clean for both.

## ARCHITECTURE REVIEW

Full detail in `docs/FINAL_ARCHITECT_REVIEW.md`. 2 HIGH findings (commission/partner-attribution integrity gap; currency-blind dashboard sums), both fixed with regression tests. 3 MEDIUM findings fixed (missing index, payment-currency validation, contract-status guard on new payment activity); 1 MEDIUM documented as a low-risk consistency-only item, not fixed. 1 LOW finding folded into an existing documented assumption (ASM-57). 5 review areas (dead code, unused permissions, idempotency, legal-record-overwrite, application/scholarship-duplication) confirmed clean with no issue.

## ASSUMPTION REVIEW

Re-read `docs/ASSUMPTIONS.md` and `docs/DECISIONS.md` in full. Classification of every Phase 12-13 assumption named in this phase's own instructions:

| Assumption | Classification |
|---|---|
| Storage (local disk, ASM-50) | Accepted for production **only single-instance**; production blocker for multi-instance (re-classified explicitly this phase, was previously just "noted") |
| Job scheduler / in-process poller, no Redis (ASM-52) | Accepted for production at current scale; stuck-job reaper is a documented accepted limitation (see BACKGROUND JOBS above) |
| Commission adjustment/reversal (ASM-45, PAID/CANCELLED both terminal) | Accepted — still matches the SRS, no new information changes this |
| Service-layer TOCTOU / check-then-create races (ASM-57) | Accepted, narrow-window, now covers 2 known instances (generalized this phase) |
| Visa type taxonomy | Reviewed — confirmed deliberate free-text design (`Visa.visaType String`, matched against configurable `VisaChecklistTemplate` rows), consistent with the project's "master data not hard-coded" convention; not a gap |
| Report metrics (SLA/quality definitions, ASM-55) | Accepted — still honestly labeled derived metrics, not an invented score |
| LOR/portal test gaps (ASM-59, and the Phase 13 UAT parent-document-revocation gap) | Accepted as tracked test-coverage gaps — code paths independently confirmed correct by direct read, only their own regression tests are missing |
| Rate limiting (ASM-56) | **Now implemented** (this phase) — no longer a gap |
| Checksum-at-download (ASM-58) | Accepted — still not a live risk with the current single-write-path local storage provider |
| Concurrent-case race (ASM-57) | Accepted, see above |

No assumption was silently upgraded into a requirement, and no assumption was found to actually be a production blocker beyond what's already listed under PRODUCTION BLOCKERS below.

---

## CRITICAL FINDINGS: 0

## HIGH FINDINGS: 0 (2 found, both fixed — see ARCHITECTURE REVIEW above)

## MEDIUM FINDINGS: 1 remaining (documented, not fixed — 13 actor-attribution fields lack `@relation` to User; naming/consistency only, no data-integrity or security impact)

## LOW FINDINGS: 2 (Application check-then-create race, folded into ASM-57; export endpoints have no hard row ceiling)

## FIXES

Production code (7 files): `apps/api/src/main.ts` (helmet, CORS, graceful shutdown, config validation call), `apps/api/src/common/config/assert-production-config.ts` (new), `apps/api/src/common/rate-limit/rate-limit.module.ts` (new), `apps/api/src/modules/health/{health.controller,health.module}.ts` (new), `apps/api/src/app.module.ts`, `apps/api/src/modules/identity/auth/auth.controller.ts` (login throttle), `database/seeds/seed.ts` (bootstrap-admin-password fix), `apps/api/src/modules/partners/commission-transactions/commission-transactions.service.ts` (PartnerStudentLink validation), `apps/api/src/modules/reporting/reports/reports.service.ts` (currency-grouped revenue/receivables), `apps/api/src/modules/commercial/payments/payments.service.ts` (currency validation + contract-status guard), `database/schema.prisma` (DocumentAccess index).

New deployment artifacts: `Dockerfile`, `.dockerignore`, `.github/workflows/ci.yml`.

## FILES CREATED/UPDATED

**New documentation**: `docs/production/PRODUCTION_RUNBOOK.md`, `docs/production/SECURITY_BASELINE.md`, `docs/production/DISASTER_RECOVERY.md`, `docs/FINAL_ARCHITECT_REVIEW.md`, `docs/phase-status/PHASE_14.md` (this file).

**Updated documentation**: `docs/ASSUMPTIONS.md` (ASM-56 updated to "implemented", ASM-57 generalized, new ASM-60/ASM-61), `.env.example`/`.env` (new variables, documented).

**New migration**: `database/migrations/20260820040000_document_access_index_phase14/`.

**New/updated tests** (10 new regression tests across 5 files): `apps/api/src/common/config/assert-production-config.spec.ts` (new, 11 unit test cases), `apps/api/test/partners.e2e-spec.ts` (2 new + `linkPartnerToStudent` helper + all existing commission tests updated to establish the now-required link), `apps/api/test/reporting.e2e-spec.ts` (1 new + 2 existing updated to the new currency-grouped shape), `apps/api/test/payments.e2e-spec.ts` (4 new).

No `docs/DECISIONS.md` entry — every fix this phase was a genuine defect correction against already-clear requirements/architecture principles, not a discovered requirement conflict needing a recorded judgment call.

---

## TEST RESULTS

- Unit: **174/174 passed** (14 suites — +11 from the new config-validator tests).
- E2E: **466/466 passed** (24 suites — +6 from this phase's fixes: 2 commission-attribution, 1 currency-mismatch, 2 terminal-contract-payment, 1 multi-currency-dashboard).

## FULL REGRESSION

Full suite (unit + e2e, all of Phase 01-14, not just this phase's new tests) re-run **three times** across this phase's session (twice consecutively after the architecture-review fixes, once more after the seed.ts bootstrap-admin fix) — 466/466 e2e and 174/174 unit every time, zero flakes.

## TYPECHECK

`tsc -p tsconfig.json --noEmit` — clean.

## LINT

`eslint` — 0 errors, 7 pre-existing warnings in one untouched file (`mfa.service.spec.ts`, `no-explicit-any`), not introduced by this phase.

## BUILD

`nest build` — clean, both directly and inside the verified Docker multi-stage build.

## PRODUCTION SMOKE TEST

Performed against a real Docker container (image built from the repository's own `Dockerfile`) connected to the real docker-compose PostgreSQL, with `NODE_ENV=production` and real (non-placeholder) generated secrets:

- Clean boot — `assertProductionConfigSafe()` passed, application started as a non-root user, listening on port 3000.
- `GET /health` → 200, all expected security headers present.
- `GET /health/ready` → 200, `{"status":"ok","database":"ok"}` — real DB connectivity confirmed.
- Docker `HEALTHCHECK` reported `healthy` after the configured start period.
- `docker stop` (SIGTERM) → clean shutdown in ~1.1 seconds, exit code 0, log line `"SIGTERM received, shutting down gracefully..."` — `enableShutdownHooks()` + the explicit signal handler work correctly with `node` as container PID 1.
- Also separately verified: a malformed `AUTH_MFA_ENCRYPTION_KEY` correctly crashes the process at DI-construction time (defense-in-depth beyond the boot-time config validator).

## KNOWN RISKS

- General observability gap: no metrics/alerting infrastructure, logs are not JSON-structured (see OBSERVABILITY above).
- Rate-limit and job-poller state are single-instance-scoped (safe today, a real constraint at horizontal scale).
- Background-job stuck-`RUNNING`-row reaper does not exist (accepted limitation, see BACKGROUND JOBS above).
- `npm audit` HIGH advisories in a devDependency-only code path (documented, accepted, not exploitable via the running application).

## ACCEPTED LIMITATIONS

- Local-disk document storage — safe for single-instance deployment only; migration path to object storage is a one-file swap behind an existing interface, not implemented (no cloud credentials in this environment).
- No stuck-job reaper (see above) — narrow failure window, manually observable via `/admin/jobs`.
- Rate-limiting/job-poller in-memory/in-process state does not span multiple instances.
- 13 actor-attribution schema fields lack a formal `@relation` (naming/consistency only, no functional impact).

## PRODUCTION BLOCKERS

These are the specific, complete reasons this phase's classification is PRODUCTION CANDIDATE and not PRODUCTION READY — every one of them requires the actual target deployment environment to resolve, which does not exist in this development sandbox:

1. **No automated, scheduled, off-host backup job exists** (`docs/ASSUMPTIONS.md` ASM-61). The backup/restore *procedure* is real and verified (see RESTORE above); the *automation* that would run it on a schedule and ship the result somewhere that survives a primary-host failure is not provisioned.
2. **No metrics/alerting infrastructure is wired up.** Structured-enough logs and a comprehensive audit trail exist, but nothing proactively pages anyone for DB-down/queue-failing/backup-failure/storage-failure/auth-anomaly/high-error-rate conditions.
3. **No real TLS termination exists or has been verified** — this repository's application serves plain HTTP by design (TLS is a reverse-proxy/load-balancer responsibility), but that reverse proxy has not been built or tested anywhere in this project.
4. **No CI platform is actually connected** — the CI workflow is authored and every command in it has been manually verified, but it has never executed as an actual CI run gating a real deployment.
5. **Multi-instance deployment is not yet safe** — document storage and rate-limit state are both single-instance-scoped; a horizontally-scaled deployment needs object storage and a shared rate-limit store first.

None of these are CRITICAL or HIGH *application-layer* defects — the application itself is thoroughly hardened, tested, and verified. They are infrastructure/operational readiness items that are outside what a codebase alone can prove.

## RECOMMENDED NEXT STEPS

1. Provision the target production environment (cloud database, object storage, reverse proxy with TLS, CI platform, secret manager) and re-run this phase's verified procedures (migration, seed, smoke test, backup/restore drill) against it.
2. Wire an automated backup schedule + off-host storage; re-run the restore drill against that real target at least once before go-live.
3. Wire metrics export + alerting for the conditions named above.
4. Connect the authored CI workflow to a real git remote and confirm it actually runs and gates deployment.
5. If horizontal scaling is planned: swap `StorageProvider` to an object-storage implementation and configure a shared `ThrottlerStorage` (Redis-backed) before adding a second instance.
6. Optional, lower-priority: JSON-structured logging, a stuck-job reaper, the 13 actor-attribution FK relations, a hard row ceiling on export endpoints.

---

## FINAL RELEASE DECISION: PRODUCTION CANDIDATE

## READY FOR PRODUCTION: NO

Application-layer hardening, security, data-integrity, and testing are complete and verified — every CRITICAL/HIGH finding across Phases 13-14 is fixed, full regression is green, and this phase's own smoke tests (including a real Docker build, boot, health check, and graceful-shutdown-under-SIGTERM) all passed against real infrastructure where that infrastructure exists in this environment (PostgreSQL, Docker). What remains is exclusively infrastructure/operational provisioning (automated backups, alerting, TLS, CI) that requires a real target deployment environment this sandbox does not have. Không tự chuyển sang phase mới ngoài phạm vi Phase 14.
