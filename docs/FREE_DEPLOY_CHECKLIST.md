# Free Deploy Checklist

Prepared: 2026-08-20, updated as each real step actually happened (this file is kept current, not a frozen point-in-time snapshot).

- [x] **GitHub ready** — repository created at https://github.com/Theloser1869/abroad-scholarship-system, local commit `981f447` pushed to `main`. `.github/workflows/ci.yml` authored and ready to run on the next push.
- [x] **Render config ready** — `render.yaml` written (service, Docker runtime, free plan, health check path, full env-var list grouped and either `value`/`generateValue: true`/`sync: false` as appropriate). Not yet applied to a real Render account — Render setup is a separate, not-yet-performed step.
- [x] **Supabase connected** — project ref `xpxvvzwtvmcqkvugzfmd` (`ap-northeast-2`) is the live REMOTE DEMO database. Full migration history (20 migrations) applied via `prisma migrate deploy` and verified. See "Supabase connection verification" below for the full record. `DATABASE_URL`/`DIRECT_URL` live only in the local, git-ignored `.env` — never committed, never printed in any tool output.
- [x] **R2 connected** — bucket `abroad-scholarship-documents` (account `d36f5cff4f75a0a34a92710adaf63c8d`) is the live REMOTE DEMO storage target. `R2StorageProvider` validated for real against it (bucket access, private access, upload/download, versioning, IDOR, file security, audit logging — all PASS). See "R2 connection verification" below for the full record. `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` live only in the local, git-ignored `.env` — never committed, never printed in any tool output.
- [x] **Env documented** — `docs/DEPLOYMENT_ENV.md` covers every variable across LOCAL/TEST/REMOTE DEMO; `.env.example` fully updated and grouped to match.
- [x] **Secrets documented** — every secret-shaped variable is either a clearly-labeled placeholder or explicitly marked `sync: false`/`generateValue: true` in `render.yaml`, never a real value.
- [x] **Local production build PASS** — `docker build` succeeded against the updated `Dockerfile` (see `docs/production/PRODUCTION_RUNBOOK.md` for the original verification; re-verified this task after the PORT/healthcheck update).
- [x] **Local production run PASS** — container boots with `NODE_ENV=production` and real-shaped (non-placeholder) secrets, `STORAGE_PROVIDER=r2` pointed at local MinIO, `/health` and `/health/ready` return 200, graceful SIGTERM shutdown confirmed.
- [x] **Prisma migration validation PASS** — `prisma validate`, `prisma generate`, `prisma migrate status` all clean against the local database with the new `directUrl` field; `migrate deploy` applies cleanly from a fresh schema history (verified in Phase 14, unaffected by this task's schema comment-only change to the datasource block).
- [x] **Storage provider validation PASS** — `R2StorageProvider` validated for real against MinIO (a local S3-API-compatible emulator, not a mock): isolated store/read/delete round-trip tests, plus the full `DocumentsService` upload→scan→download→version→cross-user-IDOR flow re-run with `STORAGE_PROVIDER=r2` bound instead of the default local provider. 9/9 tests passing (`apps/api/test/r2-storage-provider.e2e-spec.ts`).
- [x] **Security validation PASS** — `assertProductionConfigSafe()` extended with storage-provider and CORS-wildcard checks, unit-tested (19/19 in `assert-production-config.spec.ts`); no change to the Phase 13/14 security posture otherwise (RBAC/IDOR/audit/webhook/signed-URL protections all re-verified via the unchanged full e2e suite).
- [x] **Full regression PASS** — 182/182 unit, 475/475 e2e (up from Phase 14's 174/466 baseline — +8 unit and +9 e2e new tests from this task's changes, zero regressions). Typecheck and lint both clean (0 errors).
- [x] **Ready to create remaining cloud resources** — GitHub, Supabase, and R2 are now all real and connected (see above). Creating the Render service is the remaining explicit next action, not yet performed.
- [x] **Render live** — service deployed at `https://abroad-scholarship-system.onrender.com`; `GET /health` and `GET /health/ready` both return 200 against the real database.
- [x] **Production admin bootstrap PASS** — see "Production admin bootstrap" below.

## Production admin bootstrap (real, against the live Render + Supabase deployment)

- **Demo seed NOT run** — proved from source before running anything: `main()` in `database/seeds/seed.ts` calls `seedRolesAndPermissions` (role/permission matrix, not fixture data) and `seedBootstrapAdmin` (single idempotent upsert on `username: 'admin'`) unconditionally, and `seedRbacFixtures` — the only function that creates demo users or any Student/Case/Task/Lead/StudentContact fixture — only when `NODE_ENV !== 'production'`. Ran with `NODE_ENV=production`, confirmed the log line `NODE_ENV=production — skipping demo users and RBAC test fixtures.`
- **Pre-existing stray admin removed first**: a read-only query found one `admin` row already present (created earlier the same day by an earlier, unrelated local validation task's throwaway setup — not this deployment's intended credential). Confirmed via read-only query it had zero `audit_logs` rows referencing it and zero sessions (safe to delete without altering audit history), then removed it by exact `username: 'admin'` match before seeding fresh.
- **Bootstrap admin created**: exactly one `users` row afterward — `username: admin`, role `SYSTEM_ADMIN`, `status: ACTIVE`, `passwordHash` scrypt-hashed (never plaintext, never printed).
- **No development fixtures created**: `student`, `case`, `task`, `application`, `scholarshipApplication`, `visa`, `enrollment`, `partner`, `lead`, `contract`, `payment`, `document`, `studentContact` all counted **0** via read-only query, both immediately after bootstrap and after the idempotency re-run.
- **Idempotency PASS**: re-ran the identical seed command a second time — `users` count stayed at exactly 1, `createdAt` and password hash unchanged (the `update: {}` upsert clause), confirming a retry cannot create a duplicate admin or silently reset the password.
- **Login smoke test PASS**: `POST /auth/login` → 201, correct `roleCode: SYSTEM_ADMIN`, access + refresh tokens issued; `GET /auth/me` → 200 with the same role; `POST /auth/logout` → 200, after which the same access token is immediately rejected (`401 UNAUTHENTICATED`), not just the refresh cookie.
- **RBAC smoke test PASS**: `GET /users` and `GET /audit-logs` (both granted to `SYSTEM_ADMIN`) → 200; `GET /students`, `GET /documents/:id`, `GET /portal/me` (none granted to `SYSTEM_ADMIN` by design — see `database/seeds/seed.ts` GRANTS) → 403 `PERMISSION_DENIED`; `GET /users` with no token → 401.
- **Audit PASS**: the authenticated `GET /audit-logs` (VIEW), the denied `GET /documents/:id` (VIEW, `result: DENIED`), and `POST /auth/logout` (LOGOUT) all produced audit rows correctly attributed to the admin's `actorId`. (Login itself audits with a null actor by design — no principal exists yet at that point in the request.)
- **No password, token, or connection string appears anywhere in this record.**

## Supabase connection verification (real, against project `xpxvvzwtvmcqkvugzfmd`)

All checks below were run for real against the live Supabase database — none are simulated or assumed. No password or connection string appears anywhere in this record.

- **Connectivity**: `prisma migrate status` connects successfully; datasource reported as `PostgreSQL database "postgres", schema "public" at "aws-0-ap-northeast-2.pooler.supabase.com:5432"` (host/port only, no credentials in Prisma's own output).
- **SSL**: found the connection was not explicitly requiring TLS (relying on Prisma's default `sslmode=prefer`, which silently allows a plaintext fallback) — fixed by adding `sslmode=require` to both `DATABASE_URL` and `DIRECT_URL`; re-verified the connection still succeeds with SSL explicitly mandatory.
- **Malformed credential caught and fixed**: the password contained an unescaped `@`, which is ambiguous inside a connection URI (the same character that separates credentials from host) — percent-encoded (`%40`) before first use.
- **Migration**: `prisma migrate deploy` applied all 20 migrations cleanly to a completely fresh/empty database (every migration showed as pending beforehand); `prisma migrate status` afterward reports "Database schema is up to date!" with zero pending/conflicting migrations.
- **Schema verification** (via read-only `information_schema`/`pg_catalog` queries, not the Supabase dashboard): **64 tables**, **64 primary keys** (one per table), **109 foreign keys**, **187 indexes** (Prisma implements `@unique` as unique indexes rather than named table constraints — expected, not a gap), **25 numeric/decimal columns**. Every domain group (Identity/RBAC, Lead/Student/Case, Contract/Payment, Task/Notification, Assessment/Roadmap/Profile, Application/Scholarship, Visa/Enrollment, Partner/Commission, Documents, Portal, Reporting/Audit, Platform) accounted for by table name.
- **Transaction test**: a real `$transaction` with two queries executed successfully.
- **Data policy**: row counts on `users`, `students`, `cases`, `documents`, `background_jobs` all confirmed **0** — genuinely empty, no seed/demo/dummy data present or created.
- **No destructive command used**: only `prisma validate`/`generate`/`migrate status`/`migrate deploy` and read-only `SELECT`s were run. `migrate reset` and `db push` were never invoked.
- **Typecheck/lint/build**: all re-run and clean against the updated schema/config; DB-touching test suites (unit/e2e) were deliberately **not** run against this connection, since the local suite's fixtures/seed would populate this now-clean remote database with test/demo data — exactly what this step forbids. They remain verified against the local dev database (see "Baseline comparison" below, unchanged by this step).

## R2 connection verification (real, against bucket `abroad-scholarship-documents`)

All checks below were run for real against the live Cloudflare R2 bucket — none are simulated or assumed. No access key, secret key, or token appears anywhere in this record.

- **Credential validation**: the real `R2StorageProvider` class (compiled from `apps/api/dist`) constructed successfully against the real account/bucket config, and separately confirmed to fail fast with a clear error when required config is empty.
- **Bucket access**: `HeadBucket` and a prefix-scoped `ListObjectsV2` both succeeded against the real bucket.
- **Private access**: an unauthenticated direct fetch of a written object's URL returned an error (not the object), confirming the bucket has no public access configured.
- **Controlled smoke test**: one object was written at a fixed, clearly-namespaced key, read back byte-identical, then deleted — confirmed absent afterward via `GetObject` (`NoSuchKey`) and a prefix listing. No other object in the bucket was touched.
- **Full `DocumentsService` flow** (via the real HTTP API, `STORAGE_PROVIDER=r2` bound, two throwaway RBAC-seeded test users, an isolated non-FK-constrained owner reference — no real Case/Student record created): upload → malware-scan job processed → download (byte-identical) → signed URL issued and expiry-scoped correctly, rejected once expired, not obtainable by an unauthorized user → v2 created without overwriting v1, correct `previousVersionId`, both versions independently downloadable with correct bytes → cross-user IDOR (User B denied 404 on User A's document; tampering with owner/reference fields grants no extra access, consistent with `ownerId`/`ownerEntity` carrying no FK/authorization weight) → file-security checks intact (MIME allowlist, magic-byte validation, checksum, provider-generated key only, no public object URL) → every upload/download/version/access-denial produced a correctly attributed audit row.
- **Cleanup**: every R2 object created during validation deleted via the real provider's own `delete()`; every audit/document/session/user row created during validation deleted by exact ID (including one audit row from a deliberately-rejected upload attempt whose `objectId` was null and fell outside the primary cleanup filter — found and removed in a follow-up pass). Independently re-verified afterward: bucket has 0 objects, and the database's `users`/`documents`/`sessions`/`audit_logs` counts are back to exactly the pre-validation baseline (1 bootstrap admin user, 0 of everything else). No object outside the test run, no pre-existing data, and no unrelated row was touched.
- **No destructive operation used**: no public-access change, no bucket-policy change, no credential rotation, no new token creation, no bucket deletion, no deletion of any object this task didn't itself create.
- **Typecheck/lint/build**: all re-run and clean after this task's validation work (0 typecheck errors, 0 lint errors/7 pre-existing warnings unchanged, build clean). The full 475-case e2e suite was deliberately **not** re-run in this task — `.env`'s `DATABASE_URL`/`DIRECT_URL` now point at the live Supabase database, and that suite's fixtures/seed would populate it with test data, exactly what the Supabase-connection task's data policy forbids. Document/security-relevant behavior was instead verified for real via the full `DocumentsService` flow above, run directly against real R2 + real Supabase with precise, fully-cleaned-up test fixtures.

## Baseline comparison (Phase 14 → free-deploy-prep task)

| Metric | Phase 14 | This task |
|---|---|---|
| Unit tests | 174 | 182 (+8) |
| E2E tests | 466 | 475 (+9) |
| Typecheck | clean | clean |
| Lint | 0 errors, 7 pre-existing warnings | 0 errors, 7 pre-existing warnings (unchanged) |
| Build | clean | clean |

No test scope was reduced. No existing assertion was weakened or removed to make a test pass.
