# Go-Live Checklist

Attempt date: 2026-08-20. Starting status per `docs/phase-status/PHASE_14.md`: **PRODUCTION CANDIDATE**.

**Result: GO-LIVE BLOCKED at PRE-FLIGHT.** No production infrastructure exists in this environment — every item below that requires a real production target (database, domain, TLS, CI platform, off-host backup, email provider, monitoring) cannot be verified, because that target does not exist to verify against. This is not a partial/soft failure: per this task's own instructions, three independent, explicit STOP conditions are triggered (§5 no off-host backup, §6 no verified TLS, §12 no connected CI/CD), any one of which alone halts go-live.

No database command, deployment command, or infrastructure-provisioning command was run against anything represented as production, because no such target exists. The only database reachable from this environment is the local development database (see DATABASE VERIFICATION below) — it was not touched as though it were production.

## GO-LIVE PRECHECK

- [ ] production database verified — **FAIL.** No production database exists. Only reachable database: `localhost:55432/abroad_scholarship_dev` (local Docker Compose, development). See DATABASE VERIFICATION below.
- [ ] backup verified — **FAIL (no production target to back up).** The backup *procedure* was verified for real in Phase 14 (`docs/production/DISASTER_RECOVERY.md`) against the dev database; there is no production database for a production backup to exist.
- [ ] off-host backup verified — **FAIL.** No off-host backup storage or scheduled backup job is provisioned anywhere (`docs/ASSUMPTIONS.md` ASM-61). This alone is an explicit STOP-GO-LIVE condition per this task's §5.
- [ ] restore capability verified — **PASS (procedure only, against dev data).** Real restore drill performed in Phase 14: dump → restore → row-count match on 8 tables → migration-consistency confirmed → application booted against the restored database. The *mechanism* is proven; it has never been exercised against a production backup because none exists.
- [ ] TLS verified — **FAIL.** No hostname/domain, no certificate, no reverse proxy exists anywhere in this project. No real HTTPS request could be made because there is no HTTPS endpoint. Explicit STOP-GO-LIVE condition per this task's §6.
- [ ] domain verified — **FAIL.** No domain/DNS record exists.
- [ ] secrets verified — **PARTIAL PASS (mechanism), FAIL (real production secrets).** The boot-time config validator (`assertProductionConfigSafe()`) and the seed script's `BOOTSTRAP_ADMIN_PASSWORD` requirement are real, implemented, and verified (Phase 14). No actual production secret values exist (there is no production secret manager, no production JWT/MFA/document-signing/webhook secrets have ever been generated) because there is no production deployment target to hold them.
- [ ] storage verified — **N/A / FAIL for any multi-instance scenario, unverifiable for single-instance production** since no production instance exists to verify persistence/restart-survival against. `docs/production/SECURITY_BASELINE.md`'s classification stands: local-disk storage is accepted-for-single-instance / blocker-for-multi-instance, but "accepted" still requires an actual persistent volume in a real deployment to point at — none exists here.
- [ ] multi-instance safety verified — **N/A.** No instances (single or multiple) are running in production, so this is moot until a target exists; documented requirement (Redis-backed rate-limit storage + object storage before scaling out) carries forward from Phase 14 unchanged.
- [ ] CI/CD verified — **FAIL.** `.github/workflows/ci.yml` exists (authored Phase 14) but no git remote/CI platform is connected anywhere in this project (`.git` does not exist). It has never executed as a real CI run. Explicit STOP-GO-LIVE condition per this task's §12.
- [ ] monitoring verified — **FAIL.** No metrics/monitoring infrastructure exists (`docs/phase-status/PHASE_14.md` OBSERVABILITY section, unchanged since Phase 14).
- [ ] alerting verified — **FAIL.** No alerting exists for any condition (DB down, queue failing, backup failure, storage failure, auth anomaly, high error rate).
- [ ] worker verified — **PASS (mechanism, local).** The in-process job runner's retry/backoff/dead-letter/idempotency behavior is real and re-verified via the full e2e suite this session (466/466 passing, including `jobs-platform.e2e-spec.ts`). Not exercised against production traffic — none exists.
- [ ] scheduler verified — **PASS (mechanism, local).** Same basis as worker — dedupe-keyed, e2e-verified, never run against production.
- [ ] email verified — **FAIL.** No real email provider is configured. The bound implementation (`LogEmailProvider`) only logs to console — it is an explicitly-documented stand-in (`docs/ASSUMPTIONS.md` ASM-54), not a real SMTP/provider integration. No test email was sent to a controlled recipient because there is no real provider to send through; sending one now would only prove the console-logging stub logs correctly, not that production email delivery works.
- [ ] webhook verified where applicable — **NOT READY.** No external e-signature (or other) provider is actually connected. `ESIGN_WEBHOOK_SECRET` in this environment is a documented dev-only placeholder. The webhook *endpoint* itself (signature verification, replay protection, idempotency, audit-even-on-rejection) is real and e2e-verified (`webhooks.e2e-spec.ts`) against synthetic, locally-signed requests — but no live external provider has ever called it.
- [ ] migration verified — **PASS (mechanism), N/A (no production database to apply to).** `prisma migrate deploy` was verified this session and in Phase 14 to apply cleanly from a fresh schema history (via a scratch database), and the dev database's migration history is confirmed up to date. No migration was run against any production target because none exists.
- [ ] smoke tests passed — **PASS (against local Docker build only, not production).** See `docs/phase-status/PHASE_14.md` "PRODUCTION SMOKE TEST" — real Docker build/boot/health-check/graceful-shutdown, verified this session's predecessor. Not re-attempted against a production target in this task since none exists to deploy to.
- [ ] RBAC smoke tests passed — **PASS (via existing e2e suite, not a live production smoke test).** RBAC ALLOW/DENY coverage is exhaustively verified via `rbac.e2e-spec.ts` and the full Phase 13 security audit — 466/466 e2e tests pass as of this session. This is test-suite verification, not a post-deployment production smoke test (there is no deployment).
- [ ] document security smoke tests passed — **PASS (via existing e2e suite), not a live production check.** Same basis — `documents-platform.e2e-spec.ts` covers upload/MIME/malware-scan/download-authorization exhaustively.
- [ ] portal smoke tests passed — **PASS (via existing e2e suite), not a live production check.** `portal.e2e-spec.ts` covers linked/unlinked/revoked parent access exhaustively.
- [ ] audit smoke tests passed — **PASS (via existing e2e suite), not a live production check.** `audit.e2e-spec.ts` covers representative sensitive actions appearing in the audit log, including the Phase 13 guard-level-denial fix.
- [ ] rollback plan verified — **PASS (documented procedure), N/A (nothing has been deployed to roll back).** `docs/production/PRODUCTION_RUNBOOK.md` §7 documents the rollback strategy (redeploy previous image tag; migrations are additive-only project-wide, confirmed by re-reading every migration file, so code rollback alongside a superset schema is safe; never hand-edit `_prisma_migrations` or run a destructive command). Never exercised against a real deployment because none exists yet.

## Summary

19 checklist items. **0 fully PASS against real production infrastructure** (several "PASS" markings above are explicitly qualified as "mechanism verified in a non-production context" — every one of those qualifications is intentional, not an oversight). **8 hard FAIL** (production database, off-host backup, TLS, domain, CI/CD, monitoring, alerting, email). Any single hard FAIL blocks go-live; there are eight.

## Decision

**GO-LIVE = BLOCKED.**

No production deployment was attempted. See `docs/production/GO_LIVE_REPORT.md` for the full report, exact blockers, and remediation steps required before this checklist can be re-run against a real target.
