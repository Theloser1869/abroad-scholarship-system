# Disaster Recovery — Phase 14

Scope: PostgreSQL (the system's only stateful dependency — see `docs/production/SECURITY_BASELINE.md` "Storage" for the separate, lower-stakes local-disk document-storage caveat) and the application's ability to start cleanly from a restored backup.

**Status note**: the missing off-host automated backup this document flags (see "Backup strategy" below and `docs/ASSUMPTIONS.md` ASM-61) was confirmed, in a subsequent go-live pre-flight attempt, as one of the specific conditions blocking go-live — see `docs/production/GO_LIVE_REPORT.md` blocker #2. Resolving it is a prerequisite for go-live, not merely a nice-to-have.

## RPO / RTO

**No business-specified RPO/RTO exists anywhere in the SRS or any Phase 00-13 instruction file.** Per this phase's own instruction ("Nếu RPO/RTO chưa được business xác định: ghi assumption thay vì tự tuyên bố SLA chính thức"), the numbers below are an **assumption**, not a committed SLA — see `docs/ASSUMPTIONS.md` ASM-60. Business/ops must confirm or override these before they're treated as binding.

| | Assumed target | Basis |
|---|---|---|
| **RPO** (max acceptable data loss) | ≤ 24 hours | Matches a once-daily backup cadence, the minimum defensible baseline for a system holding financial (Payment/Contract) and legal (signed Contract, Document) records — SRS §12 NFR-SEC-07 "Backup encrypted; test restore định kỳ" names the *practice*, not a number. |
| **RTO** (max acceptable downtime to restore) | ≤ 4 hours | Based on this phase's actual timed drill (below): dump→restore→verify→app-boot took under 5 minutes end-to-end against the current data volume (~1,300 students, ~18,000 audit rows); 4 hours leaves generous headroom for a production-scale dataset, provisioning a replacement host, and human coordination. |

## Backup strategy

- **What**: full logical dump of the PostgreSQL database (`pg_dump -Fc`, custom/compressed format — supports selective and parallel restore, unlike plain SQL).
- **Frequency**: daily, at minimum (matches the assumed 24h RPO). A production deployment should additionally enable PostgreSQL WAL archiving / continuous archiving (e.g. via the managed database provider's point-in-time-recovery feature) if a sub-24h RPO is ever required — not built here, since no such requirement exists yet.
- **Retention**: no business retention policy exists for backups specifically (distinct from the application-level document/audit retention already covered by `docs/ASSUMPTIONS.md` ASM-50). Recommended default until specified: 30 daily backups + 12 monthly backups, encrypted at rest.
- **Encryption**: the dump file itself carries no encryption from `pg_dump` — the storage location (S3/cloud storage bucket, or equivalent) must provide encryption at rest (SRS NFR-SEC-02/NFR-SEC-07). Not configured in this repository since no cloud backup target exists in this environment (same "no cloud credentials in this environment" constraint noted throughout Phase 12-14 for object storage).
- **Storage location**: off-host, distinct failure domain from the primary database (a local-disk-only backup does not survive a host failure). Not provisioned in this environment.

### Backup command (verified)

```bash
docker exec <postgres-container> pg_dump -U abroad_app -d abroad_scholarship_dev -Fc -f /tmp/backup.dump
docker cp <postgres-container>:/tmp/backup.dump ./backup-$(date +%Y%m%d).dump
```

(A managed production Postgres would instead use its provider's native backup/snapshot mechanism — the command above is the local-Docker equivalent used for this phase's drill.)

## Restore procedure (verified — real drill performed 2026-08-20)

This phase performed a real, complete restore drill against the local development Postgres — not a description of an untested procedure.

1. **Backup taken**: `pg_dump -Fc` against the live dev database (`abroad_scholarship_dev`) — produced a 2.53 MB dump.
2. **Fresh target database created**: `CREATE DATABASE abroad_scholarship_restore_drill`.
3. **Restored**: `pg_restore --no-owner --role=abroad_app` into the fresh database.
4. **Row-count verification** — 8 key tables, source vs. restored, exact match on every one:

   | Table | Source | Restored |
   |---|---|---|
   | students | 1,293 | 1,293 |
   | cases | 1,252 | 1,252 |
   | documents | 301 | 301 |
   | audit_logs | 18,360 | 18,360 |
   | users | 141 | 141 |
   | payments | 254 | 254 |
   | contracts | 430 | 430 |
   | background_jobs | 1,666 | 1,666 |

5. **Migration/schema consistency verification** — `prisma migrate status` against the restored database reported all 19 (now 20) migrations applied and **"Database schema is up to date!"** — the restored database's own `_prisma_migrations` history table survived the dump/restore intact and matches the current schema exactly.
6. **Application-boot verification** — the compiled API (`node dist/main.js`) was started with `DATABASE_URL` pointed at the restored database. `GET /health/ready` returned `200 {"status":"ok","database":"ok"}` — the application connects, and Prisma's client operates correctly, against the restored data with zero special-casing.
7. **Cleanup**: drill database dropped after verification (`DROP DATABASE abroad_scholarship_restore_drill`).

### Restore command reference

```bash
# 1. Create the target database (skip if restoring in-place onto a fresh instance)
docker exec <postgres-container> psql -U abroad_app -d postgres -c "CREATE DATABASE <target_db>;"

# 2. Restore
docker exec <postgres-container> pg_restore -U abroad_app -d <target_db> --no-owner --role=abroad_app /tmp/backup.dump

# 3. Verify migration history matches the current schema
DATABASE_URL="postgresql://abroad_app:<password>@<host>:5432/<target_db>?schema=public" \
  npx prisma migrate status --schema=database/schema.prisma

# 4. Point the application at the restored database and confirm readiness
DATABASE_URL="postgresql://abroad_app:<password>@<host>:5432/<target_db>?schema=public" \
  node apps/api/dist/main.js
curl http://localhost:3000/health/ready   # expect {"status":"ok","database":"ok"}
```

## What restore does NOT cover

- **Document storage** (`storage/documents/` on local disk, per `LocalFilesystemStorageProvider`) is a *separate* backup target from the database — a database-only restore recovers `Document` metadata rows (including `checksumSha256`) but not the underlying file bytes unless the storage directory is backed up on the same or a coordinated schedule. See `docs/production/SECURITY_BASELINE.md` "Storage" for this subsystem's own production-readiness classification and migration path to object storage (which would carry its own, provider-native backup/versioning).
- **In-flight background jobs** (`BackgroundJob` rows with `status=RUNNING` at backup time) restore in a state that the job runner's own claim/retry logic already handles safely on restart (a `RUNNING` row with no live worker holding it is functionally equivalent to a crashed worker — the existing retry/backoff logic, not a DR-specific mechanism, resolves it). No special DR handling required.

## Verification procedure (ongoing, not just this one drill)

- **Cadence**: this drill should be re-run at minimum quarterly against a real backup artifact (not just the dev database used for this phase's proof) once a production backup schedule exists, and after any migration that changes a large/critical table's shape.
- **Pass criteria**: row counts match (or a documented, explained delta for tables with expected drift between backup-time and restore-time), `prisma migrate status` reports schema up to date, and the application's `/health/ready` returns 200 against the restored database.
- **Responsible role**: System Admin / Infrastructure owner (the same role SRS §3 gives "Hạ tầng ứng dụng" — infrastructure — scope over). No named individual exists in this project's fixtures; a real deployment must assign one.

## Assumptions

See `docs/ASSUMPTIONS.md` ASM-60 for the RPO/RTO assumption and ASM-61 for the "no off-host backup storage provisioned in this environment" note.
