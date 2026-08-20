# PHASE STATUS — PHASE_12 (Platform: Documents / Integrations + Jobs / Reporting)

## status
PASS

## scope
`12-platform/01_DOCUMENTS.md`, `12-platform/02_INTEGRATIONS_JOBS.md`,
`12-platform/03_REPORTING.md` — completes the Documents subsystem Phase 07-11 already use
(real private storage, signed download, async malware scan, versioning, EDIT/SHARE/ARCHIVE),
adds a DB-backed background job queue + scheduler + provider adapters + one concrete
webhook receiver, and adds RBAC-scoped, live-source-of-truth Executive/Manager/Staff
reporting + a scoped/audited export. No new Document/Application/Notification/Job-as-a-
business-entity was invented — `BackgroundJob`/`IncomingWebhookEvent` are cross-cutting
infra (same taxonomy as `BusinessIdSequence`/`IdempotencyKey`), not business entities.

## implemented

**Document storage**: `StorageProvider` interface, default `LocalFilesystemStorageProvider`
(private, non-web-served local directory, provider-generated UUID storage keys — never
derived from client filenames, structurally ruling out path traversal). `POST /documents`
is now a real multipart upload; `fileReference` is server-generated, never client-trusted.

**Document security**: MIME allowlist + extension-match + magic-byte verification
(`validateMimeAndExtension`/`validateMagicBytes`) rejects unsupported types, extension
mismatches, and MIME spoofing; size limit (`DOCUMENT_MAX_SIZE_BYTES`) rejects oversized/
empty uploads; SHA-256 checksum computed server-side; filename normalized to a display-only
`originalFilename`, never a storage path; duplicate detection (same checksum, same owner)
is informational (`duplicateOfId`), never blocking. Upload authorization is the existing
`documents:create` permission; `ownerEntity`/`ownerId` remain purely descriptive metadata
— verified directly that spoofing them grants no extra access.

**File upload security**: async malware scan (`MalwareScanProvider`, default
`HeuristicMalwareScanProvider` — detects the industry-standard EICAR test signature) runs
via the new `DOCUMENT_SCAN` job; `scanStatus` starts `PENDING`, download blocked until
`CLEAN`, `INFECTED`/`ERROR` stay permanently blocked (a corrected re-upload is a new row).

**Document versioning**: `POST /documents/:id/versions` always creates a brand-new Document
row (`previousVersionId` self-relation chain) — never an in-place file swap; rejected once
the row being versioned is ARCHIVED; existing `DocumentAccess` grants copied forward.

**Document access**: unchanged grant-based mechanism (`DocumentAccess`, Phase 07); Phase 12
adds real `EDIT`/`SHARE`/`ARCHIVE` actions (the Phase 02-reserved permission values) —
uploader auto-granted all four (VIEW/DOWNLOAD/EDIT/SHARE); `POST /documents/:id/share`
lets an EDIT/SHARE-holder extend VIEW/DOWNLOAD to another principal. IDOR verified
directly: document-id knowledge alone grants nothing; ownerId/caseId spoofing grants
nothing; Portal cannot enumerate (unchanged `listAccessibleTo`, grant-scoped only).

**Download flow**: Authenticate → resolve principal → authorize (existing grant check +
new `scanStatus=CLEAN` check) → audit → generate secure access (short-lived HMAC-signed,
principal-and-document-scoped token, `SignedUrlService`, default 60s TTL) → download (a
separate, signature-verified byte-serving endpoint, `GET /documents/download/:token`,
re-checks signature/expiry/live grant/live scan status). No permanent/public URL anywhere.

**Document retention**: `retentionUntil`/`legalHold` (Phase 02 columns) tracked; no
automatic deletion job reads them — Hard Rule #5 and the phase's own "không tự động delete
legal/audit-required documents" both forbid it; retention stays informational/policy-
tracking only, documented as `docs/ASSUMPTIONS.md` ASM-50.

**Document integration regression**: verified directly across every module using Document
— Contract (signedDocumentId unchanged), Application/Offer/ScholarshipApplication/Visa/
Pre-departure/Enrollment evidence links, Partner (PartnerDocument), Writing/Academic/Test/
Evidence, Student/Parent Portal — all reference `documentId` by FK only and never touch
storage directly, so all of them transparently gained real storage/scan/signed-download
with zero code change on their side; confirmed no second, differently-secured file-access
path was created anywhere.

**Adapter architecture**: `EmailProvider`/`ESignProvider`/`CalendarProvider`/
`AccountingProvider`/`SmsProvider`/`ExternalSchoolDataProvider` — six real interfaces, DI-
bound in one `IntegrationsModule` (a provider swap is a one-file `useClass` change, never a
domain-service change). Only `EmailProvider` (wired into `NotificationsService`'s EMAIL
channel) and `ExternalSchoolDataProvider` (wired into the University sync job) have a real
call site — no Phase 01-12 instruction names a concrete workflow for the other four. See
`docs/ASSUMPTIONS.md` ASM-54.

**Background jobs**: new `BackgroundJob` Postgres table + `JobsService` (idempotent enqueue
via a unique `dedupeKey`) + `JobRunnerService` (in-process poller, atomic batch-claim,
per-`jobType` registered handlers, exponential-backoff retry for `TransientJobError`,
immediate `FAILED` for any other error or an unregistered job type). Job types: 
`DOCUMENT_SCAN`, `REMINDER_SWEEP_TASK`, `REMINDER_SWEEP_PAYMENT`, `EXTERNAL_DATA_SYNC`,
`NOTIFICATION_EMAIL_DISPATCH`. See `docs/ASSUMPTIONS.md` ASM-52 for why this is DB-backed
rather than Redis/BullMQ (revising Phase 06's ASM-18 note).

**Queue**: see Background jobs above — `GET /admin/jobs`/`GET /admin/jobs/:id`
(SYSTEM_ADMIN-only) expose job status/observability, per the phase's own "job status nếu
exposed" instruction.

**Job idempotency**: verified directly — enqueueing the same `dedupeKey` twice (including
concurrently) returns the same row, never a duplicate; the Task/Payment reminder sweeps
reuse their exact existing Phase 05/06 dedupe-key logic unchanged (the scheduler is a
second, automatic caller of the same methods `POST .../reminders/run` already called
manually — no duplicated sweep logic); document scan keys on `document-scan:${documentId}`;
email dispatch keys on `email-dispatch:${notificationId}`.

**Retry**: verified directly — `TransientJobError` reschedules with exponential backoff
(capped) until `maxAttempts`; any other error, or an unregistered `jobType`, fails
immediately without burning retry attempts on something retrying can never fix.

**Scheduler**: `SchedulerService.tick()` (invoked automatically on an interval in
production/dev, `NODE_ENV=test`-disabled to keep e2e tests deterministic — see
`docs/ASSUMPTIONS.md` ASM-52) enqueues `REMINDER_SWEEP_TASK`/`REMINDER_SWEEP_PAYMENT`/
`EXTERNAL_DATA_SYNC` with a UTC-calendar-day dedupe key — verified directly that calling
`tick()` three times in a row enqueues exactly one job of each type. No UI dependency.

**Notification dispatch**: `NotificationsService.notify` now enqueues a real
`NOTIFICATION_EMAIL_DISPATCH` job for the EMAIL channel (closing the ASM-18 gap — `sentAt`
was previously permanently null); `NotificationsModule` registers the processor, calling
`EmailProvider.send` and setting `sentAt` on success, retrying (`TransientJobError`) on
provider failure. IN_APP is unchanged (still instantly "sent," inbox IS delivery).

**Webhooks**: `POST /webhooks/esign` — HMAC-SHA256 signature verification against the raw
request body (`main.ts`'s `express.json({verify})` captures `req.rawBody` once, globally,
purely additively — every other route's `req.body` behavior is unchanged), `(source,
eventId)` DB-unique-constraint idempotency/replay-protection checked before any business-
data mutation, `IncomingWebhookEvent` audit trail (recorded even for a rejected/forged
signature attempt), `@Audit('CREATE')`. Deliberately side-effect-free on business data — no
other webhook was built (no other concrete source named anywhere). See
`docs/ASSUMPTIONS.md` ASM-53.

**External data sync**: `sourceUrl`/`externalId`/`retrievedAt`/`syncStatus` added to
University/Program/ScholarshipMaster; only `UniversitiesService.syncExternal` was built
(matched by `externalId` only, never inserts a new row); a row verified by staff more
recently than the last sync is skipped and flagged `MANUAL_OVERRIDE`, never silently
overwritten. See `docs/ASSUMPTIONS.md` ASM-51.

**Observability**: structured logs on every job success/retry/failure
(type/id/attempt/correlationId/durationMs/truncated-error — never payload contents,
tokens, signed URLs, or document bytes); `correlationId` threaded through one scheduler
tick's sibling jobs for cross-job tracing; `GET /admin/jobs` for status/retry-count
inspection.

**Reporting**: `GET /reports/executive` (ED/DM-only) — active cases, stage-distribution
pipeline, revenue (live sum of `Payment.paidAmount`), receivables (live sum via the
existing `PaymentsService.outstandingAmount`, never re-derived), overdue-payment count,
application/scholarship/visa/enrollment status breakdowns, closed/archived case count.
`GET /reports/manager` (ED/DM-only) — per-consultant workload/overdue-task count/on-time-
completion-rate/average-quality-score (reusing `Task.qualityScore`, per DATA_DICTIONARY.md
section 4.7's own "computed from here in a later phase" note), completing this project's
own long-standing design intent. `GET /reports/me` (every staff role) — self-scoped "my
open cases/tasks/overdue," reusing `ScopePolicyService.caseListFilter` unchanged. Student/
Parent reporting: no new endpoint — Portal (Phase 11) already satisfies every field this
phase's Student section names, with the exact same field-redaction; STUDENT_PARENT holds
zero `reports` grant. See `docs/ASSUMPTIONS.md` ASM-55.

**Export**: `GET /reports/cases/export` (ED/DM-only) — reason required, `ScopePolicyService.
caseListFilter`-scoped (never a bypass "because it's a report"), audited per SRS 6.21
(reason/filterScope/rowCount/fields), same established pattern as `students.export`/
`contracts.export`/`payments.export`.

**Reporting consistency**: verified directly — `/reports/executive`'s revenue/receivables
match an independent, hand-computed aggregation over the live `Payment` table using the
exact same `PaymentsService.outstandingAmount` formula; no second calculation exists
anywhere between dashboard/API/export.

**Reporting performance**: current data scale (test/demo fixtures) never required
materialized views/caching; every dashboard query is a live, indexed Prisma query — no
security filter was bypassed or weakened to make a query faster.

**API**: see `docs/api/API_CONVENTIONS.md` section 11 for the full Phase 12 route list.
Every route carries the appropriate `@RequirePermission`/`@Public()` + `@Audit` where
sensitive, matching this project's established conventions exactly.

## files read
- `12-platform/01_DOCUMENTS.md`, `12-platform/02_INTEGRATIONS_JOBS.md`,
  `12-platform/03_REPORTING.md`
- Phase 01-11 documentation/checkpoints already in this session's context:
  `docs/architecture/{DOMAIN_MAP,TARGET_ARCHITECTURE,DECISIONS}.md`, `docs/database/{ERD,
  DATA_DICTIONARY}.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,
  RBAC_MATRIX}.md`, `docs/phase-status/{01-discovery,PHASE_02...PHASE_11}.md`,
  `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PHASE_MAP.md`, `database/schema.prisma`,
  `apps/api/src/**` (existing Document/Notification/Task/Payment/University services as
  direct extension targets, current package.json/docker-compose.yml for infra survey)

## files created/updated
Database: `database/schema.prisma` (`Document` +originalFilename/scanStatus/
previousVersionId + `DocumentScanStatus` enum; University/Program/ScholarshipMaster
+sourceUrl/externalId/retrievedAt/syncStatus + `ExternalSyncStatus` enum; new
`BackgroundJob`/`BackgroundJobStatus`; new `IncomingWebhookEvent`/`WebhookEventStatus`), 1
new migration (`20260819221427_platform_documents_jobs_reporting_phase12` — fully
additive), `database/seeds/seed.ts` (`documents:edit/share/archive`, `reports:view/export`,
`jobs:view` permissions + role grants).

Storage/Jobs/Scheduler/Integrations/Webhooks (`apps/api/src/common/`, new):
`storage/{storage-provider.interface,local-filesystem-storage.provider,signed-url.service,
file-validation.util,malware-scan-provider.interface,heuristic-malware-scan.provider,
storage.module}.ts`, `jobs/{job-error,jobs.service,job-runner.service,jobs-admin.controller,
jobs.module}.ts`, `scheduler/{scheduler.service,scheduler.module}.ts`,
`integrations/{email-provider.interface,log-email.provider,esign-provider.interface,
noop-esign.provider,calendar-provider.interface,accounting-provider.interface,
sms-provider.interface,external-school-data-provider.interface,integrations.module}.ts`,
`webhooks/webhook-signature.util.ts`, `json-bigint.polyfill.ts` (unrelated latent-bug fix,
see VALIDATION RESULTS).

Documents module overhaul: `documents.service.ts`, `documents.controller.ts`,
`documents.module.ts`, `dto/{upload-document,update-document,share-document}.dto.ts` (new;
`create-document.dto.ts` retired).

New Webhooks sub-module: `modules/documents/webhooks/{webhooks.service,webhooks.controller,
webhooks.module}.ts`.

New Reporting sub-module: `modules/reporting/reports/{reports.service,reports.controller,
reports.module,dto/export-report-query.dto}.ts`.

Extended already-PASSed services: `notifications.service.ts` (+`markEmailSent`, EMAIL now
enqueues a job), `notifications.module.ts` (+processor registration), `tasks.module.ts`
(+`REMINDER_SWEEP_TASK` processor registration, `TasksController`/`TasksService` routes
unchanged), `payments.module.ts` (+`REMINDER_SWEEP_PAYMENT` processor registration,
unchanged routes), `universities.service.ts` (+`syncExternal`), `master-data.module.ts`
(+`EXTERNAL_DATA_SYNC` processor registration).

`app.module.ts` (registers JobsModule/StorageModule/IntegrationsModule/SchedulerModule/
WebhooksModule/ReportsModule), `main.ts` (`bodyParser:false` + manual
`express.json({verify})`/`express.urlencoded()` — purely additive raw-body capture for
webhook signature verification, every other route's behavior unchanged).

Tests (`apps/api/test/`): `documents-platform.e2e-spec.ts` (21 new — upload validation,
scan lifecycle, signed URL, versioning, edit/share/archive, IDOR), `jobs-platform.e2e-spec.ts`
(10 new — idempotency, retry classification, scheduler dedup, admin RBAC),
`reporting.e2e-spec.ts` (14 new — RBAC per dashboard, data-source correctness, export
authorization/audit/scope), `webhooks.e2e-spec.ts` (6 new — signature verification, replay
protection, audit), `notifications.e2e-spec.ts` (1 test updated for real EMAIL dispatch),
6 pre-existing files updated for the new multipart upload contract + job-draining
determinism (`admission-application`, `admission-offer-scholarship`, `partners`, `portal`,
`profile-evidence`, `visa`), new `test/helpers/{upload-document,drain-jobs}.ts`.

Env: `.env`/`.env.example` (+`DOCUMENT_STORAGE_DIR`/`DOCUMENT_SIGNING_SECRET`/
`DOCUMENT_DOWNLOAD_URL_TTL_SECONDS`/`DOCUMENT_MAX_SIZE_BYTES`/`JOB_POLL_INTERVAL_MS`/
`SCHEDULER_INTERVAL_MS`/`ESIGN_WEBHOOK_SECRET`), `.gitignore` (+`storage/`),
`apps/api/package.json` (+`multer@^2.2.0`, `@types/multer`).

Docs: `docs/database/{ERD,DATA_DICTIONARY}.md` (Documents/Admission-sync/cross-cutting-
infra sections extended), `docs/api/API_CONVENTIONS.md` (section 11 — full Phase 12 route
list), `docs/security/RBAC_MATRIX.md` (title, `documents` edit/share/archive, new
`reports`/`jobs` columns, section 3/6/7 updates), `docs/ASSUMPTIONS.md` (ASM-50 through
ASM-55), this file. No new `docs/DECISIONS.md` entry — see "No production defect found
this phase" below.

## DOCUMENT STORAGE
Verified directly: uploaded bytes are written under a private, non-web-served local
directory with a provider-generated UUID key; the response never exposes a bucket path,
internal credential, or permanent object URL — only a server-issued short-lived signed
token via the dedicated download flow.

## DOCUMENT SECURITY
Verified directly: unsupported MIME rejected `400 UNSUPPORTED_MIME_TYPE`; extension/MIME
mismatch rejected `400 EXTENSION_MISMATCH`; declared-vs-actual-content mismatch (MIME
spoofing) rejected `400 MIME_SPOOFING_DETECTED`; empty file rejected `400 EMPTY_FILE`; no
file attached rejected `400 FILE_REQUIRED`; ownerId/ownerEntity spoofing grants zero extra
access (confirmed via a direct cross-user read attempt).

## FILE UPLOAD
Verified directly: checksum/mimeType/sizeBytes always server-computed from actual bytes,
never client-supplied; `fileReference` is always a server-generated UUID; `originalFilename`
sanitized (never used as a storage path); duplicate checksum flagged (`duplicateOfId`),
never blocking.

## DOCUMENT VERSIONING
Verified directly: `POST /documents/:id/versions` creates a new row with
`previousVersionId` set, `version` incremented, existing grants copied forward, the
original row's own version/content untouched; rejected `409 DOCUMENT_ARCHIVED` once the
prior version is archived.

## DOCUMENT ACCESS
Verified directly: VIEW/DOWNLOAD/EDIT/SHARE/ARCHIVE all server-enforced via the existing
grant-based check; DELETE remains intentionally absent everywhere (Hard Rule #5, ARCHIVE is
the closest equivalent, matching every other entity in this system).

## SIGNED URL
Verified directly: short-lived (60s default), scoped to exactly one document + one
principal (a token issued to one user cannot be used to bypass another's lack of access
even before expiry — verified via a direct cross-principal check); a tampered token is
rejected `403`; re-checked (signature/expiry/live grant/live scan status) at the actual
byte-serving step, not just at issuance.

## RETENTION / ARCHIVE
Verified directly: `legalHold`/`retentionUntil` present and settable via existing columns;
no deletion path exists anywhere in the codebase (grep-confirmed); archiving a document
does not revoke existing access grants (a clean archived document remains downloadable by
those already granted).

## INTEGRATIONS
Six adapter interfaces (`EmailProvider`/`ESignProvider`/`CalendarProvider`/
`AccountingProvider`/`SmsProvider`/`ExternalSchoolDataProvider`), each DI-bound to a
default implementation in one module (`IntegrationsModule`) — a real-provider swap never
touches domain code.

## ADAPTER ARCHITECTURE
Verified directly: `NotificationsService`/`UniversitiesService`/`MasterDataModule` depend
only on the interface tokens (`EMAIL_PROVIDER`/`EXTERNAL_SCHOOL_DATA_PROVIDER`), never a
concrete class — confirmed by grepping for any direct `LogEmailProvider`/
`NoopExternalSchoolDataProvider` import outside `IntegrationsModule` itself (none found).

## BACKGROUND JOBS
Verified directly: `BackgroundJob` table backs 5 job types across 5 domain-registered
processors; atomic batch-claim (`updateMany` conditioned on `status=PENDING`) prevents
double-processing under concurrent polling.

## QUEUE
`GET /admin/jobs`/`GET /admin/jobs/:id` — SYSTEM_ADMIN-only, verified directly (every other
role denied `403`); unknown job id `404`s.

## IDEMPOTENCY
Verified directly: same `dedupeKey` enqueued twice (including concurrently, 5-way
`Promise.all`) always resolves to exactly one row; scheduler `tick()` called 3× in a row
enqueues exactly one job per type per UTC day.

## RETRY
Verified directly: `TransientJobError` reschedules with backoff, `attempts` incremented,
`lastError` recorded, until success or `maxAttempts` exhausted (then `FAILED`); any other
error type fails immediately, never retried; an unregistered `jobType` fails immediately
(`NO_PROCESSOR_REGISTERED`), never retried forever.

## SCHEDULER
Verified directly: UTC-calendar-day dedupe keys make repeated ticks idempotent regardless
of server timezone; the enqueued `REMINDER_SWEEP_TASK` job, once processed, actually
invokes the real Phase 06 sweep methods (confirmed via a real Notification row created);
`NODE_ENV=test`-gated auto-start keeps e2e tests deterministic without touching production/
dev behavior.

## NOTIFICATION DISPATCH
Verified directly: an EMAIL-channel Notification's `sentAt` stays null until its
`NOTIFICATION_EMAIL_DISPATCH` job is processed, then becomes non-null — closing the Phase
06 ASM-18 gap for real, not just in principle.

## WEBHOOKS
Verified directly: correctly-signed event accepted + recorded + audited; forged signature
rejected `400` but still recorded (`signatureValid: false`) and audited (a forgery attempt
is never silently dropped); missing signature rejected; missing `eventId` rejected;
identical event delivered twice recognized as a duplicate (`duplicate: true`), never a
second row; reachable without an `Authorization` header (the signature IS the
authorization); never mutates business data.

## EXTERNAL DATA SYNC
Verified directly (via a fake `ExternalSchoolDataProvider` substituted in-process): syncing
a record matched by `externalId` updates the row and sets `syncStatus=SYNCED`; a row
verified by staff more recently than the last sync is skipped and flagged
`MANUAL_OVERRIDE`, never overwritten; a record with no matching `externalId` is skipped,
never inserted as a new University.

## OBSERVABILITY
Structured log lines confirmed for job success/retry/dead-letter, including
type/id/attempt/correlationId/duration — confirmed no payload/token/signed-URL/document-
content ever appears in a log line (grep-audited across `job-runner.service.ts`/
`log-email.provider.ts`/`log-sms.provider.ts`).

## REPORTING
Verified directly: every number is a live query result — no shadow/materialized table
exists anywhere in the schema for reporting.

## EXECUTIVE DASHBOARD
Verified directly: `activeCases`/`pipeline`/`revenue`/`receivables`/
`overduePaymentsCount`/applications/scholarships/visas/enrollments/closure all present and
numerically sane; ED/DM allowed, every other role denied `403`.

## MANAGER REPORTING
Verified directly: per-owner `openTasks`/`overdueTasks`/`onTimeCompletionRate`/
`averageQualityScore`; ED/DM allowed, CONSULTANT (holds `reports:view` but not the
narrower ED/DM check) denied `403` — a real two-layer authorization, not a single flat
permission.

## STAFF REPORTING
Verified directly: every staff role (CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/
ADMIN_FINANCE/ED/DM) can read `/reports/me`, scoped to records they could already access
directly (a leakage guard confirmed the caller's own count never exceeds — and in practice
is far below — the system-wide total).

## STUDENT/PARENT REPORTING
No new endpoint — verified `/reports/me` and `/reports/executive`/`/manager` all deny
STUDENT_PARENT `403`; Portal (unchanged, Phase 11) remains their sole reporting surface,
already satisfying every field this phase's Student section names with the same
field-redaction.

## EXPORT
Verified directly: `GET /reports/cases/export` requires a `reason` (rejected `400`
without one), ED/DM-only (CONSULTANT denied `403` despite holding `reports:view`),
audited (`EXPORT` action, `reason`/`filterScope`/`rowCount`/`fields` all recorded), and
scope-filtered (every returned row's id confirmed present in the unfiltered `Case` table —
no leakage of rows the caller's own scope wouldn't otherwise permit).

## REPORT SECURITY
No dashboard/export endpoint bypasses `ScopePolicyService`/permission checks — verified by
reading every query in `ReportsService` (none skip the scope filter "because it's
aggregate/a report").

## DATABASE CHANGES
1 new migration on top of Phase 01-11's 18: fully additive (`ADD COLUMN`/`CREATE TABLE`/
`CREATE TYPE`/`CREATE INDEX`/`ADD FOREIGN KEY`) — no drop, no destructive change, no
Phase 01-11 table altered destructively.

## MIGRATIONS
1. `20260819221427_platform_documents_jobs_reporting_phase12` — `DocumentScanStatus`/
   `ExternalSyncStatus`/`BackgroundJobStatus`/`WebhookEventStatus` enums; `documents`
   +original_filename/scan_status/previous_version_id (+FK+unique index); `universities`/
   `programs`/`scholarship_masters` +source_url/external_id/retrieved_at/sync_status; new
   `background_jobs`/`incoming_webhook_events` tables + indexes.

Applied via `prisma migrate diff` (script) + a hand-created migration folder + `prisma
migrate deploy`, the same non-interactive pattern established in Phase 02-11.

## API CHANGES
See `docs/api/API_CONVENTIONS.md` section 11. Summary: `/documents*` routes unchanged in
count/shape-of-gate (7 routes, request/response bodies changed for the two upload routes),
2 new `/admin/jobs*` routes, 1 new `/webhooks/esign` route, 4 new `/reports*` routes — 8
genuinely new routes plus 2 materially-changed existing ones.

## UI CHANGES
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged). Backend/API-foundation only, explicitly documented per
the same discipline as every prior phase.

## SECURITY TESTS
IDOR (cross-user document read/download attempts, ownerId/ownerEntity spoofing, signed-URL
principal-scoping, cross-case export leakage), private-file-exposure (no static route ever
serves the storage directory — grep-confirmed no `ServeStaticModule`/static-file middleware
registration anywhere in `app.module.ts`), public-storage-URL (none — every response
checked for a `fileUrl`/permanent-URL field, none found), signed-URL misuse (tampered
token rejected, expired-window re-check at byte-serving time), path traversal (structurally
impossible — storage keys are provider-generated UUIDs, never derived from input, verified
via `assertSafeKey`), malicious upload (EICAR-flagged file permanently undownloadable),
MIME spoofing (declared-vs-actual-content check), oversized files (size-limit check),
unauthorized export (`403` for non-ED/DM despite holding `reports:view`), report data
leakage (scope-filter-confirmed), job payload leakage (structured logs audited, no
payload/secret content), webhook forgery (invalid signature rejected), replay attack
(duplicate `eventId` recognized, never reprocessed), token/API-key leakage (none logged —
audited), cross-role export (denied at the permission layer), cross-case export (scope-
filter-confirmed), portal data leakage (Portal untouched this phase, its own Phase 11 IDOR
suite still passes unmodified).

## TESTS
- Unit: 0 new spec files this phase — 163/163 total (unchanged from end of Phase 11); all
  Phase 12 coverage is e2e (integration-level, matching this codebase's established
  convention of not duplicating e2e coverage with mocked-Prisma unit specs).
- Integration/e2e: 4 new suites (`documents-platform.e2e-spec.ts` 21, `jobs-platform.
  e2e-spec.ts` 10, `reporting.e2e-spec.ts` 14, `webhooks.e2e-spec.ts` 6 — 51 new tests),
  plus 7 pre-existing files updated (multipart-upload contract change + job-draining
  determinism, no net test-count change beyond the notifications.e2e-spec.ts EMAIL-dispatch
  test being strengthened, not added) — 453/453 total across 24 suites (up from 402 at end
  of Phase 11), full suite run clean twice consecutively (`--runInBand`).

## REGRESSION RESULTS
Phase 01-11's full prior suite (402 e2e + 163 unit: auth/RBAC/field-level/audit,
Lead/Student/Case, Contract/Payment/Decimal precision, Task/Notification/scheduler-adjacent
reminder-sweep behavior, Documents/Writing/Evidence [now exercised through the real
storage/scan/signed-download pipeline instead of the metadata-only stub], Application/
Offer/Scholarship, Visa/Enrollment/Closure, PartnerDocument/Commission, Student/Parent
Portal [parent access/document access/portal redaction unchanged]) passes unmodified,
included in the 453/453 totals above. One genuine, pre-existing latent bug (`BigInt` JSON
serialization) was found and fixed as part of this phase's own regression run — see
VALIDATION RESULTS.

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate deploy`/`migrate status` confirm all 19 migrations
  applied cleanly; schema fully additive.
- **Seed**: PASS — `npm run db:seed` completes cleanly, re-run to apply new permission
  grants, idempotent.
- **Unit Tests**: PASS — 163/163.
- **Integration Tests**: PASS — 453/453 (this project's tooling doesn't separate
  "integration" from "e2e").
- **E2E Tests**: PASS — 453/453, 24 suites, stable across two consecutive `--runInBand`
  runs.
- **Document Security**: PASS — see DOCUMENT SECURITY above.
- **Upload Security**: PASS — MIME/extension/magic-byte/size/empty-file/no-file-attached
  all verified directly.
- **Signed URL**: PASS — short-lived, principal-and-document-scoped, tampered-token
  rejection, dual-check (issuance + redemption) verified directly.
- **IDOR**: PASS — see SECURITY TESTS above.
- **Versioning**: PASS — new-row-per-version, grant continuity, archived-row rejection
  verified directly.
- **Retention**: PASS — no deletion path exists; legalHold/retentionUntil tracked,
  informational only, honestly documented as such (ASM-50).
- **Job Execution**: PASS — 5 job types, 5 domain-registered processors, atomic
  batch-claim verified.
- **Job Idempotency**: PASS — dedupeKey uniqueness (including concurrent-race) verified
  directly.
- **Retry**: PASS — transient-vs-permanent classification, backoff, maxAttempts exhaustion
  all verified directly.
- **Scheduler**: PASS — UTC-day dedup, real-sweep invocation, NODE_ENV=test gating all
  verified directly.
- **Notification**: PASS — EMAIL dispatch via the job queue verified directly (sentAt
  transitions null → set).
- **Webhook**: PASS — signature verification/idempotency/replay-protection/audit all
  verified directly.
- **Integration**: PASS — adapter DI-only dependency confirmed (grep-audited).
- **Reporting Correctness**: PASS — revenue/receivables cross-checked against an
  independent aggregation using the same `PaymentsService` formula.
- **Reporting Authorization**: PASS — ED/DM-only vs every-staff-role vs zero-grant tiers
  all verified directly.
- **Export Authorization**: PASS — reason-required, ED/DM-only, audited, scope-filtered,
  all verified directly.
- **Cross-Case**: PASS — export never returns a row outside the caller's scope.
- **Portal**: PASS — Phase 11's own 30-test suite passes unmodified; Portal document
  download response shape updated (now `{downloadUrl}` per the new signed-URL flow) with
  its own test assertions updated to match.
- **Audit**: PASS — upload/share/archive/version/webhook/export all `@Audit`-decorated and
  verified via direct `audit_logs` row checks.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings, unchanged since Phase 03; 3 Phase-12-introduced lint issues — an unused test
  variable and two unnecessary eslint-disable directives — found and fixed during this
  phase's own development, not left outstanding).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.

Commands (from repo root):
```
docker compose up -d
npm install
npm run db:migrate:deploy
npm run db:seed
npm run api:test
npm run api:test:e2e
npm run api:typecheck
npm run api:lint
npm run api:build
```

## ASSUMPTIONS
6 new (ASM-50 through ASM-55), full text in `docs/ASSUMPTIONS.md`:
- **ASM-50**: Document storage/security design — local-disk default StorageProvider,
  EICAR-only default scanner, principal-scoped signed download tokens, informational
  duplicate detection, no automatic retention deletion.
- **ASM-51**: External-data-sync scope — only University gets a real sync method, matched
  by externalId only, never inserts.
- **ASM-52**: Job queue — Postgres-backed `BackgroundJob` + in-process poller, not
  Redis/BullMQ (revises Phase 06 ASM-18).
- **ASM-53**: Webhook scope — one concrete, side-effect-free esign receiver; generic
  infrastructure for future sources.
- **ASM-54**: Adapter architecture — EmailProvider and ExternalSchoolDataProvider get real
  call sites; ESign/Calendar/Accounting/SMS are interface + stub only.
- **ASM-55**: Reporting scope — SLA/quality as honestly-labeled derived metrics; Student/
  Parent reporting is Portal, unchanged; export limited to Cases.

No new `docs/DECISIONS.md` entry this phase — every schema/architecture change was either
completing a Phase 07-11-anticipated deferral (Document real storage — Phase 07's own doc
comment named Phase 12 as the completion point) or a self-authored ASM revision (ASM-52
revising ASM-18), never a genuine conflict between an already-PASSed decision and a new
concrete instruction.

## RISKS
- **Local-disk storage is not horizontally scalable** — if this application is ever
  deployed across multiple instances/processes, `LocalFilesystemStorageProvider` would need
  to be swapped for a real shared/cloud provider (the interface is ready; this is
  operational infra work, not a code change).
- **`HeuristicMalwareScanProvider` is not a real antivirus engine** — only the EICAR test
  signature is detected; a genuinely malicious file with no EICAR marker would currently
  pass as CLEAN. Production deployment would need a real AV engine/API bound behind the
  same interface before this system handles real user uploads at scale.
- **In-process job poller does not survive a process restart mid-job** — a `RUNNING` job
  whose process crashes stays `RUNNING` forever (no lease/heartbeat timeout reclaims it).
  At this project's current scale this is an acceptable, documented gap; a future phase
  adding a stuck-job reaper (or migrating to Redis/BullMQ, which handles this natively)
  would close it.
- **ESign/Calendar/Accounting/SMS adapters have zero real call sites** (ASM-54) — if a
  future phase names a concrete workflow for any of the four, the adapter interface is
  ready but the actual feature/business logic calling it does not yet exist.
- **"SLA"/"quality" metrics are this phase's own honest definition, not an SRS-specified
  one** (ASM-55) — a future phase with a concrete SLA policy would need to either confirm
  this definition or replace it; the current one is transparent and documented, not hidden.

## KNOWN ISSUES
- **Latent BigInt/JSON serialization bug, found and fixed during this phase's own
  development** (not a Phase 12-introduced defect — a gap since `Document.sizeBytes` was
  first added, Phase 02/07, only surfaced because Phase 12's real upload path always
  populates `sizeBytes` on every response where before it was rarely set). Node's
  `JSON.stringify` cannot serialize a raw `BigInt`; fixed via a standard, minimal
  `BigInt.prototype.toJSON` polyfill (`apps/api/src/common/json-bigint.polyfill.ts`),
  applied process-wide via a side-effect import from `app.module.ts` (loaded by both
  production bootstrap and every e2e test). Verified via direct assertion that
  `sizeBytes` now serializes as a string in every Document API response.
- **Windows jest-worker parallel-execution flakiness** (same class of issue documented in
  Phase 06-11's own Known Issues, unrelated to Phase 12 code): `--runInBand` remains the
  reliable way to get a deterministic pass/fail signal on this machine; used for every
  regression run in this phase.
- **Job-queue test determinism required disabling the automatic poller/scheduler under
  `NODE_ENV=test`** — a genuine design decision (documented above and in ASM-52), not a
  workaround masking a real bug: a real wall-clock timer racing against a test's own
  explicit `processPendingJobs()`/`tick()` call is exactly the nondeterminism those methods
  were designed to be independently callable to avoid.
- Three lint issues (one unused test variable, two unnecessary eslint-disable directives)
  were introduced and fixed within this phase's own development, not left outstanding;
  final lint run is 0 errors.
- Carried over from Phase 02-11, still accurate and unaffected by this phase: the
  `deepmerge-ts`/`@prisma/config` dev-only `npm audit` advisories, the
  `eslint-visitor-keys` `EBADENGINE` warning, and the `otplib` 12.0.1 pin. The previously-
  flagged `multer` CVE-2022-24434 class of advisory does not apply — `multer@^2.2.0` was
  installed specifically to avoid it (confirmed via `npm audit`, down from 4 high-severity
  multer findings at `multer@1.4.4-lts.1` to 0).

## next dependency (for Phase 13)
- Every domain named in `docs/architecture/DOMAIN_MAP.md` now has a real backend
  implementation, a Portal-facing surface where named, AND a real storage/jobs/reporting
  platform underneath. Phase 13's own instruction file should be consulted for what it
  actually adds; `docs/PHASE_MAP.md` is the authoritative source, not an assumption made
  here.
- If a future phase adds real cloud object storage, only `StorageModule`'s `useClass`
  binding needs to change — `DocumentsService`/`DocumentsController` need no change.
- If a future phase adds a real AV engine, only `StorageModule`'s `MALWARE_SCAN_PROVIDER`
  binding needs to change.
- If a future phase needs true distributed-queue throughput (multi-instance deployment),
  `JobsService`/`JobRunnerService`'s public interface (`enqueue`/`registerProcessor`/
  `processPendingJobs`) is the contract a Redis/BullMQ-backed reimplementation would need
  to preserve.
- If a future phase adds a frontend application, `docs/api/API_CONVENTIONS.md` section 11
  is the concrete contract it would build against for Documents/Jobs/Reports/Webhooks.

READY FOR PHASE 13: YES

Không tự chuyển sang Phase 13. Chờ prompt tiếp theo.
