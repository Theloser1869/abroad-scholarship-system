# Free Deploy Checklist

Prepared: 2026-08-20. Every item is a *local preparation/validation* status — none of these were verified against a real Render/Supabase/R2 deployment, since none was created (see "No cloud action" boundary in `docs/DEPLOYMENT_FREE.md`).

- [x] **GitHub ready** — `.github/workflows/ci.yml` authored and every command in it individually verified locally; this repository has no `.git` directory yet (`git init` + first push is a manual step outside this task's scope, not performed).
- [x] **Render config ready** — `render.yaml` written (service, Docker runtime, free plan, health check path, full env-var list grouped and either `value`/`generateValue: true`/`sync: false` as appropriate). Not applied to any real Render account.
- [x] **Supabase config ready** — `DIRECT_URL` added to `schema.prisma`'s datasource and to `.env`/`.env.example`, documented setup steps in `docs/DEPLOYMENT_ENV.md`/`docs/DEPLOYMENT_FREE.md`. No Supabase project created.
- [x] **R2 config ready** — `R2StorageProvider` implemented behind the existing `StorageProvider` interface, env-driven selection (`STORAGE_PROVIDER=local|r2`), config validation. No real R2 bucket/credentials used anywhere.
- [x] **Env documented** — `docs/DEPLOYMENT_ENV.md` covers every variable across LOCAL/TEST/REMOTE DEMO; `.env.example` fully updated and grouped to match.
- [x] **Secrets documented** — every secret-shaped variable is either a clearly-labeled placeholder or explicitly marked `sync: false`/`generateValue: true` in `render.yaml`, never a real value.
- [x] **Local production build PASS** — `docker build` succeeded against the updated `Dockerfile` (see `docs/production/PRODUCTION_RUNBOOK.md` for the original verification; re-verified this task after the PORT/healthcheck update).
- [x] **Local production run PASS** — container boots with `NODE_ENV=production` and real-shaped (non-placeholder) secrets, `STORAGE_PROVIDER=r2` pointed at local MinIO, `/health` and `/health/ready` return 200, graceful SIGTERM shutdown confirmed.
- [x] **Prisma migration validation PASS** — `prisma validate`, `prisma generate`, `prisma migrate status` all clean against the local database with the new `directUrl` field; `migrate deploy` applies cleanly from a fresh schema history (verified in Phase 14, unaffected by this task's schema comment-only change to the datasource block).
- [x] **Storage provider validation PASS** — `R2StorageProvider` validated for real against MinIO (a local S3-API-compatible emulator, not a mock): isolated store/read/delete round-trip tests, plus the full `DocumentsService` upload→scan→download→version→cross-user-IDOR flow re-run with `STORAGE_PROVIDER=r2` bound instead of the default local provider. 9/9 tests passing (`apps/api/test/r2-storage-provider.e2e-spec.ts`).
- [x] **Security validation PASS** — `assertProductionConfigSafe()` extended with storage-provider and CORS-wildcard checks, unit-tested (19/19 in `assert-production-config.spec.ts`); no change to the Phase 13/14 security posture otherwise (RBAC/IDOR/audit/webhook/signed-URL protections all re-verified via the unchanged full e2e suite).
- [x] **Full regression PASS** — 182/182 unit, 475/475 e2e (up from Phase 14's 174/466 baseline — +8 unit and +9 e2e new tests from this task's changes, zero regressions). Typecheck and lint both clean (0 errors).
- [x] **Ready to create cloud resources** — every local preparation and validation this task's instructions require is complete and green. Creating the actual Render service, Supabase project, R2 bucket, and GitHub remote are the explicit next actions, deliberately not performed here.

## Baseline comparison (Phase 14 → this task)

| Metric | Phase 14 | This task |
|---|---|---|
| Unit tests | 174 | 182 (+8) |
| E2E tests | 466 | 475 (+9) |
| Typecheck | clean | clean |
| Lint | 0 errors, 7 pre-existing warnings | 0 errors, 7 pre-existing warnings (unchanged) |
| Build | clean | clean |

No test scope was reduced. No existing assertion was weakened or removed to make a test pass.
