# PHASE STATUS — PHASE_11 (Student/Parent Portal)

## status
PASS

## scope
`11-portal/01_STUDENT_PARENT_PORTAL.md` — a safe, permission-gated read/action layer over
the Student/Case/Task/Document/Application/Offer/ScholarshipApplication/Visa/
Pre-Departure/Enrollment/Contract/Payment/Notification domains already built in Phase
01-10. Built directly on that foundation — no rewrite of anything already PASSed. Portal
introduces exactly one new business-domain entity (`ParentInvitation`) plus two extensions
to already-PASSed models (`StudentContact.portalStatus`/`revokedAt`/`revokedById`,
`Task.visibleToStudent`) — no `StudentPortalProfile`/`ParentApplication`/`PortalTask`/
`PortalDocument`/`PortalMessage` or any other parallel entity was created. No Phase 12+
feature (real object storage, scheduled notification dispatch) was implemented.

## implemented

**Portal architecture**: `PortalService` injects and thinly delegates to every Phase
05-10 domain service it needs (`RoadmapsService`, `MilestonesService`, `TasksService`,
`DocumentsService`, `ApplicationsService`, `ApplicationChecklistService`, `OffersService`,
`ScholarshipApplicationsService`, `VisasService`, `PreDepartureService`,
`EnrollmentsService`, `ContractsService`, `PaymentsService`, `NotificationsService`),
applying each one's EXISTING scope check and field-redaction method — zero duplicated
business logic anywhere. "Portal chỉ là một lớp truy cập an toàn vào dữ liệu hiện có."

**Student access model**: every Portal route resolves the caller's own Student(s) from
`principal.userId` server-side (`PortalAccessService.myAccessibleStudents`,
`ScopePolicyService.assertStudentAccessible`) — a client-supplied `studentId` in the URL is
always re-verified against server-resolved ownership, never trusted at face value. Direct
IDOR-style API tests (not UI checks) confirm an arbitrary/another student's id is rejected.

**Parent access model**: `StudentContact` extended with `portalStatus`
(`PortalLinkStatus`: NONE/INVITED/ACTIVE/REVOKED), `revokedAt`, `revokedById`. New
`ParentInvitation` table — one row per invite attempt, hash-only token, expiry, single-use
`acceptedAt`, mirrors `password_reset_tokens`/`ContractReviewLink.tokenHash` exactly.
"Verification" is token possession, the same standard already established for password
reset. `PortalAccessService.acceptInvitation` reuses an existing User by email match
(STUDENT_PARENT role) or creates a new one — a Parent with several children never gets a
duplicate User. `revokeParentAccess` sets `portalStatus = REVOKED` **and**, in the same
transaction, expires all of the revoked user's non-expired `DocumentAccess` grants — two
independent access mechanisms, both closed. `StudentContact.portalUserId`'s Phase 03
`@unique` constraint relaxed to a plain index (`docs/DECISIONS.md` DEC-06) — one Parent User
now legitimately links to several `StudentContact` rows. `GET /portal/me` returns every
student the caller may access (self or linked-ACTIVE) for multi-student context selection.
See `docs/ASSUMPTIONS.md` ASM-46.

**Profile**: read-only. `PortalService.getProfile` returns the redacted Student record; no
`PATCH`/edit route exists on the Portal surface at all — ownership, case internal-status,
staff assignment, contract legal-state, application/visa internal state, commission, and
audit data all stay unreachable structurally, not just policy-forbidden. See
`docs/ASSUMPTIONS.md` ASM-49.

**Roadmap/progress**: reuses `RoadmapsService` verbatim; progress % is computed on read
(`round(completed/total*100)`), never stored, never a second calculator. Milestone evidence
submission is a new, narrow `MilestonesService.submitEvidence(caseId, milestoneId,
documentId)` — writes only `evidenceDocumentId`, never the broad generic `update()` a
student could otherwise use to change `status`/`ownerId`/etc. `PortalService` additionally
verifies the submitted document was uploaded by the caller before accepting it as evidence.

**Tasks**: `Task.visibleToStudent` (new column, default `false`) — every existing and new
task stays staff-only unless a staff member explicitly opts one in. Four new
`TasksService` methods (`listForStudentPortal`/`getForStudentPortal`/`portalSubmitOutput`/
`portalUpdateStatus`) filter on `visibleToStudent: true` directly and deliberately bypass
`assertTaskAccessible` (which 404s every OWN_STUDENT caller — Task Engine was built Phase
06 as staff-only tooling). `portalUpdateStatus` only accepts `IN_PROGRESS`/`DONE` (narrower
than the full staff `TaskStatus`) but reuses the exact same FSM/precondition logic as the
staff path via an extracted private `applyStatusTransition` — never a second, drifted copy.
`FieldPolicyService.redactTaskForPortal` hides `blocker`/`qualityScore`/`ownerId` on every
Portal task response (list and detail). No new Task engine, no `PortalTask` entity.

**Documents**: `DocumentsService.listAccessibleTo(principal)` — a new method querying only
the caller's own non-expired `DocumentAccess` VIEW grants (the "which grants do I hold"
direction), never a generic by-owner-entity scan; no enumeration of arbitrary document ids
is possible. Download is authenticate → verify-relationship → verify-permission →
secure-access → audit, reusing `DocumentsService.assertAccessible`/`download` unchanged; no
public URL anywhere.

**Applications**: list/detail expose university/program/status/checklist/deadlines/
submission/offer state; internal notes, strategy, and reviewer comments are excluded by the
existing `Application`/`ApplicationChecklist` shape (no field to redact — those fields live
elsewhere, e.g. `Comment`, not on `Application` itself). No student-initiated
Submitted/Offer/Reject transition exists. Checklist evidence submission is a new, narrow
`ApplicationChecklistService.submitEvidence(caseId, checklistItemId, documentId)` — same
single-field-write pattern as Milestone evidence above.

**Scholarships**: list/detail via `ScholarshipApplicationsService`, `redactScholarshipApplication`
applied (hides `internalNotes`); award amount/status/deadline/result visible per the
instruction's own field list — Program tuition/Offer deposit/award amounts are catalog-style
data, not agency commercial terms (`docs/ASSUMPTIONS.md` ASM-32, unchanged this phase). No
commission field ever reaches this response — Commission is a wholly separate Phase 10
resource STUDENT_PARENT has zero grant on.

**Visa**: list/detail via `VisasService`, `redactVisa` applied (hides `internalNotes`);
checklist/required-actions/appointment/result/document-status all visible when released. No
student-set GRANTED/REFUSED/SUBMITTED/appointment transition exists — all Visa mutation
routes remain staff-only (`visa:edit`, which STUDENT_PARENT never holds).

**Pre-departure/enrollment**: reuse `PreDepartureService`/`EnrollmentsService` verbatim,
`redactEnrollment` applied. Checklist/deadlines/completion/status all visible. No
acknowledge/submit-evidence action was added here beyond what already existed — the phase
instruction's "acknowledge-only if permitted" is satisfied by the existing read-only view
(no instruction concretely names a distinct pre-departure acknowledge action to build).

**Contract/Payment**: list/detail via `ContractsService`/`PaymentsService`,
`redactContract`/`redactPayment` applied (hide internal approval fields, commission has no
column on either model to begin with). `Payment` remains the sole source of truth for
due/paid/outstanding — no client-side balance calculation anywhere on the Portal path.
Signed-contract access reuses the existing Document/Contract mechanism unchanged.

**Notifications**: `PortalService.listNotifications` is a pure passthrough to
`NotificationsService.listInbox`, already unconditionally `recipientId === principal.userId`
scoped (Phase 06) — no new Notification entity, no recipient-tampering surface (recipientId
is never client-suppliable in the first place).

**Comments**: not built. 11-portal/01_STUDENT_PARENT_PORTAL.md only conditionally names
interaction ("nếu MD cho phép"); no concrete requirement exists anywhere in the instruction
file, so no `PortalMessage`/`StudentMessage`/`ParentComment` entity or endpoint was added —
the existing `Comment` entity's Phase 04 student-visibility split is left exactly as-is. See
`docs/ASSUMPTIONS.md` ASM-49.

**Authentication**: reuses the existing session/JWT architecture unchanged — no parallel
auth system. `ParentInvitation` tokens are hash-only (SHA-256, never the raw token
persisted), expiring, single-use (`acceptedAt` checked before `expiresAt`), and
independently revocable before acceptance; every invite/accept/revoke action is `@Audit`-
decorated. No plaintext secret ever appears in a log — the raw token exists only in the
HTTP response body (and, non-production only, a `devToken` convenience field mirroring
`AuthService.requestPasswordReset`'s existing pattern).

**RBAC/Portal authorization**: one new permission resource/action, `portal:access`,
applied at the CLASS level on `PortalController`, granted only to STUDENT_PARENT — every
other role gets `403` on the entire Portal surface, verified directly. The real per-record
decision remains each reused domain service's own scope check underneath. See
`docs/ASSUMPTIONS.md` ASM-47 and `docs/security/RBAC_MATRIX.md` section 2.

**IDOR protection**: verified directly via `apps/api/test/portal.e2e-spec.ts`'s dedicated
IDOR/cross-student/unlinked/revoked DENY suite — every sub-resource independently denies an
out-of-scope caller (own-student-not-matching-URL, unlinked parent, revoked parent,
arbitrary document/application/visa id under a legitimate session), called directly against
the API, never inferred from UI behavior (none exists).

**Field-level security**: checked across every Portal response surface — Visa
`internalNotes` (detail AND list), ScholarshipApplication `internalNotes`, Task
`blocker`/`qualityScore`/`ownerId` (new `redactTaskForPortal`), Contract `value` confirmed
NOT redacted (it's the student's own contract, visible per the instruction's own field
list) — not just one endpoint checked in isolation.

**Audit**: parent invite/accept/revoke, Portal profile view, milestone/checklist evidence
submission, task output/status mutation, document download, and application/scholarship/
visa detail views are all `@Audit`-decorated. `AuditInterceptor.extractObjectId`'s
literal-`:id`/`payload.id` extraction doesn't fit Portal's nested-param routes — `invite()`
and `downloadDocument()` set `req.auditMetadata` explicitly (the same pattern
`PublicContractReviewController` already established), verified via a direct `audit_logs`
row check, not just decorator presence.

## files read
- `11-portal/01_STUDENT_PARENT_PORTAL.md`
- Phase 01-10 documentation/checkpoints already in this session's context:
  `docs/architecture/{DOMAIN_MAP,TARGET_ARCHITECTURE,DECISIONS}.md`, `docs/database/{ERD,
  DATA_DICTIONARY}.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,
  RBAC_MATRIX}.md`, `docs/phase-status/{01-discovery,PHASE_02...PHASE_10}.md`,
  `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PHASE_MAP.md`, `database/schema.prisma`,
  `apps/api/src/**` (existing code — especially Phase 03 `ScopePolicyService`/auth token
  patterns, Phase 06 Task Engine, Phase 07 Documents/Roadmap/Milestone services, Phase 08/09
  Admission/Visa services, Phase 05 Contract/Payment services — as direct reuse and
  integration-pattern targets)

## files created/updated
Database: `database/schema.prisma` (`StudentContact` +`portalStatus`/`revokedAt`/
`revokedById`, `@unique` on `portalUserId` relaxed to `@@index`; new `PortalLinkStatus`
enum; new `ParentInvitation` model; `Task` +`visibleToStudent`; `User`
+`parentInvitationsSent` back-relation), 1 new migration
(`20260819130000_student_parent_portal_phase11` — fully additive except the one documented
unique→index constraint relaxation), `database/seeds/seed.ts` (`portal:access` permission +
STUDENT_PARENT grant, `documents:create` grant added to STUDENT_PARENT, fixed
`demo.parent.linked` fixture upsert for the relaxed constraint, new `demo.parent.revoked`
user + REVOKED `StudentContact` fixture, new INVITED `StudentContact` + `ParentInvitation`
fixture with a known raw token, new `TASK-2026-90003` fixture with `visibleToStudent: true`).

API (`apps/api/src/modules/portal/`, new domain):
- `portal.module.ts` (top-level aggregator)
- `portal-access/{dto,portal-access.service,portal-access.controller,portal-access.module}.ts`
- `portal/{dto,portal.service,portal.controller,portal.module}.ts`
- `modules/identity/rbac/scope-policy.service.ts` (7 methods — revocation-awareness fix)
- `modules/identity/rbac/field-policy.service.ts` (+ `redactTaskForPortal`)
- `modules/documents/documents/documents.service.ts` (+ `listAccessibleTo`)
- `modules/counseling/roadmaps/milestones.service.ts` (+ `submitEvidence`, + `DocumentsService` injection)
- `modules/counseling/roadmaps/roadmaps.module.ts` (+ `DocumentsModule` import)
- `modules/admission/applications/application-checklist.service.ts` (+ `submitEvidence`)
- `modules/case-management/tasks/tasks.service.ts` (`updateStatus` refactored to extract
  private `applyStatusTransition`; + `portalUpdateStatus`/`listForStudentPortal`/
  `getForStudentPortal`/`portalSubmitOutput`)
- `app.module.ts` (registers PortalModule)

Tests (`apps/api/test/`): `portal.e2e-spec.ts` (30 tests — parent invitation lifecycle,
student/parent ALLOW, IDOR/cross-student/unlinked/revoked DENY, field-level redaction, task
scope, documents, notifications, audit); `apps/api/src/modules/identity/rbac/
scope-policy.service.spec.ts` (2 existing tests updated for the revocation-aware filter
shape, 2 new tests added: REVOKED denial, INVITED-not-yet-accepted denial);
`apps/api/test/tasks.e2e-spec.ts` and `apps/api/test/notifications.e2e-spec.ts` (test-
infrastructure fix — tracked-id cleanup for tasks each file creates against the shared
caseA fixture, closing a pre-existing, session-long test-pollution leak unrelated to Portal
itself — see KNOWN ISSUES).

Docs: `docs/database/ERD.md` (section 3 — StudentContact/Task field additions; section 10 —
`ParentInvitation` entity + portal-relationship narrative; top-of-file scope note), `docs/
database/DATA_DICTIONARY.md` (section 4.5/4.7 field additions, new section 4.21
`parent_invitations`, section 4.20 portal_user_id note split, section 5 two new deferred-
enforcement bullets), `docs/api/API_CONVENTIONS.md` (section 11 — full Phase 11 endpoint
list), `docs/security/RBAC_MATRIX.md` (title, new `portal` permission column, new Phase 11
grant-table note, new section 3 revocation-awareness note, new section 5 field-protection
row, section 6 test-reference + 3 new fixture bullets, section 7 title + 3 new deferral
bullets), `docs/ASSUMPTIONS.md` (ASM-46 through ASM-49), `docs/DECISIONS.md` (DEC-06), this
file.

## PORTAL ARCHITECTURE
Verified directly: `PortalService` has no direct Prisma model access for any of the 10+
domains it surfaces beyond its own `resolveCase`/cross-check helpers — every read/write
goes through the existing domain service. Zero new duplicated business logic; confirmed by
reading every method body during implementation, not just by class-name convention.

## STUDENT ACCESS
Verified directly: `GET /portal/students/:id` with another student's real id (caller is
neither that student nor a linked ACTIVE parent) returns `404`, resolved server-side from
`principal.userId`, never trusting the URL's id as authorization.

## PARENT ACCESS
Verified directly: full lifecycle walk (create contact → invite → accept via token →
ACTIVE → revoke → REVOKED, access denied on the very next request) plus a re-invite after
revoke succeeding independently.

## PARENT RELATIONSHIP
Verified directly: a single `demo.parent.linked`-style account accepting a second
invitation for a different child does not violate any constraint (DEC-06); both links
remain independently ACTIVE/revocable; `GET /portal/me` lists both.

## PROFILE
Verified directly: no mutation route exists at all; `GET /portal/students/:id` returns the
redacted Student record (budget/sensitive fields follow the existing `redactStudent` rule
unchanged).

## ROADMAP
Verified directly: progress % matches a hand-computed `completed/total` ratio; milestone
evidence submission rejects a document the caller did not upload; a broad field-edit
attempt on a milestone via the Portal has no route to reach at all.

## TASKS
Verified directly: `TASK-2026-90001`/`TASK-2026-90002` (staff-only) stay invisible on the
Portal path while `TASK-2026-90003` (`visibleToStudent: true`) is visible;
`blocker`/`qualityScore`/`ownerId` redacted; output/status FSM walk IN_PROGRESS→DONE
succeeds; a `BLOCKED` status attempt is rejected `400` at the DTO layer (narrower than
staff `TaskStatus`).

## DOCUMENTS
Verified directly: `listAccessibleTo` returns only documents the caller holds a real,
non-expired `DocumentAccess` grant for; a document never shared with the caller is absent
from the list and its direct-id download route 404s; download is audited.

## APPLICATIONS
Verified directly: Application A's Portal detail view includes checklist + current Offer,
excludes any internal/strategy field (none exist on the model to redact); checklist
evidence submission writes only `documentId`.

## SCHOLARSHIPS
Verified directly: ScholarshipApplication A's `internalNotes` redacted on both list and
detail; award amount/status/deadline/result visible.

## VISA
Verified directly: Visa A's `internalNotes` redacted on both list and detail; no
student-reachable route exists for submit/appointment/interview/result.

## PRE-DEPARTURE
Verified directly: checklist/deadlines/status visible via the existing read path; no new
mutation surface added.

## ENROLLMENT
Verified directly: Enrollment A's `internalNotes` redacted; status/confirmation visible.

## CONTRACT/PAYMENT
Verified directly: Contract `HD-2026-90001`'s `value` visible (not redacted, per the
instruction's own field list); Payment due/paid/outstanding read directly from the existing
`Payment` rows, no client-supplied or Portal-computed balance anywhere.

## NOTIFICATIONS
Verified directly: the Portal inbox route returns only notifications where
`recipientId === principal.userId`; a `recipientId` cannot be supplied/tampered by the
client at any layer (it was never an input to begin with).

## COMMENTS
Not built — see ASM-49. Verified the existing Phase 04 Comment student-visibility split is
unaffected by this phase (no code in that path was touched).

## AUTHENTICATION
Verified directly: an accept-invitation replay (same token twice) is rejected; an unknown
token is rejected with the same shape of error as an already-used one (no oracle for
token validity); a multi-child parent's second accept reuses the existing User, confirmed
by a direct row-count check (no duplicate User created).

## RBAC / AUTHORIZATION
Verified directly: all 8 roles tested against the Portal surface — STUDENT_PARENT ALLOW
(own/linked-ACTIVE only), every other role (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/
CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/ADMIN_FINANCE/SYSTEM_ADMIN) `403` on the
entire Portal surface via the `portal:access` class-level gate.

## IDOR PROTECTION
Verified directly, called against the raw API (not inferred from UI): cross-student,
unlinked-parent, revoked-parent DENY on every sub-resource independently; arbitrary
document/application/visa ids under a legitimate but unrelated session all `404`, never
leaking existence.

## FIELD-LEVEL SECURITY
Verified directly on detail AND list endpoints (not just one): Visa `internalNotes`,
ScholarshipApplication `internalNotes`, Task `blocker`/`qualityScore`/`ownerId`; Contract
`value` confirmed visible (not over-redacted).

## AUDIT
Verified directly: `audit_logs` rows exist for parent invite (with `studentId`/`contactId`
metadata) and document download (with `documentId` metadata), confirming
`AuditInterceptor`'s literal-param-extraction gap was correctly worked around rather than
silently producing a wrong/empty `objectId`.

## DATABASE CHANGES
1 new migration on top of Phase 01-10's 16: additive (`ADD COLUMN`/`CREATE TABLE`/`CREATE
TYPE`/`CREATE INDEX`/`ADD CONSTRAINT`/`ADD FOREIGN KEY`) except one documented constraint
relaxation (`student_contacts.portal_user_id` `@unique` → plain index — DEC-06, confirmed
safe since relaxing a unique constraint to a non-unique index can never violate existing
data). No entity renamed, merged, or duplicated; no Phase 01-10 table altered
destructively.

## MIGRATIONS
1. `20260819130000_student_parent_portal_phase11` — `PortalLinkStatus` enum;
   `student_contacts.portal_status`/`revoked_at`/`revoked_by_id`; `DROP INDEX
   "student_contacts_portal_user_id_key"` + new plain `CREATE INDEX` on the same column;
   new `parent_invitations` table + index + FKs; `tasks.visible_to_student` column.

Applied via `prisma migrate diff` (script) + a hand-created migration folder + `prisma
migrate deploy`, the same non-interactive pattern established in Phase 02-10.

## API CHANGES
See `docs/api/API_CONVENTIONS.md` section 11 for the full list. Summary: 4 new
`/students/:studentId/contacts*` routes (staff-facing relationship management), 1 new
`/public/portal/parent-invitations/:token/accept` route (unauthenticated, token-gated), 21
new `/portal/*` routes (`GET /portal/me` + 20 `/portal/students/:id/...` routes) — 26 new
routes total.

## UI CHANGES
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged this phase). Every capability named in 11-portal/
01_STUDENT_PARENT_PORTAL.md (Student self-service view, Parent multi-child access,
roadmap/task/document/application/scholarship/visa/pre-departure/enrollment/contract/
payment/notification views, evidence submission) is satisfied as an API capability a future
UI would call, consistent with the same reasoning applied in Phase 03-10. This is a
backend/API-foundation-only phase; UI status is explicitly documented here per the
instruction's own section 21 requirement.

## TESTS
- Unit: 1 spec file touched this phase (`scope-policy.service.spec.ts` — 2 existing tests
  updated, 2 new added) — 163/163 total (up from 161 at end of Phase 10).
- Integration/e2e: 1 new suite (`portal.e2e-spec.ts`, 30 tests), plus a test-infrastructure
  fix to `tasks.e2e-spec.ts`/`notifications.e2e-spec.ts` (tracked-id cleanup, no test count
  change) — 402/402 total across 20 suites (up from 372 at end of Phase 10), full suite run
  clean twice consecutively post-reset (`--runInBand`) for repeatability — see REGRESSION
  RESULTS and KNOWN ISSUES.

## REGRESSION RESULTS
Phase 01-10 full prior suite (372 e2e + 161 unit: auth/RBAC/field-level/audit, Lead/
Student/Case/CaseMember/cross-case-isolation, Contract/Payment/Amendment workflow, Task/
Notification engines, Assessment/Roadmap/Milestone/Profile-Evidence/Writing, Admission
master data/Application/Offer/ScholarshipApplication, Visa/Pre-Departure/Enrollment/
Closure, Partner CRM/Commission FSM) still passes unmodified, run as part of the same
full-suite executions below (161/372 totals include every Phase 01-10 test unchanged).

A genuine (but pre-existing, non-Phase-11) regression-suite finding surfaced during this
phase's own required Phase 01-10 regression run and was root-caused and fixed before PASS
— see KNOWN ISSUES below for the full account: `caseA`, the shared fixture case reused
across the entire e2e suite's history, had accumulated 571 Task rows (568 tagged
`module: 'counseling', taskType: 'follow_up'`) from `tasks.e2e-spec.ts`/
`notifications.e2e-spec.ts` creating tasks against it on every run with no cleanup, across
many prior sessions' worth of runs — eventually pushing the shared `taskA` fixture off the
first page of a paginated task-list assertion. Confirmed not caused by Phase 11's own new
fixture (`TASK-2026-90003`, whose deadline sorts after `taskA`'s). Fixed at the source
(tracked-id cleanup in both files' `afterAll`) and, since the historical rows already
existed in the dev database from before the fix, via one `prisma migrate reset --force`
(local dev-only Postgres container, explicit user-run + re-verified target) followed by a
clean re-seed.

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate deploy`/`migrate status` confirm all 17
  migrations applied cleanly post-reset; schema additive except the one documented
  `portal_user_id` unique→index relaxation.
- **Seed**: PASS — `npm run db:seed` completes cleanly post-reset; fixture baseline
  verified directly (13 users, 8 roles, 2 students, 1 case, correct Portal fixture states:
  `demo.parent.linked` ACTIVE, INVITED contact present, REVOKED contact present).
- **Unit Tests**: PASS — 163/163.
- **Integration Tests**: PASS — 402/402 (this project's tooling doesn't separate
  "integration" from "e2e" — see `docs/PROJECT_STRUCTURE.md`).
- **E2E Tests**: PASS — 402/402, 20 suites, verified stable across two consecutive
  `--runInBand` runs post-reset, with post-run caseA task-count checks confirming test
  isolation (3 tasks after each run — the seeded baseline, zero pollution) both times.
- **Student Access Tests**: PASS — own-student ALLOW, another-student DENY (404, resolved
  server-side).
- **Parent Access Tests**: PASS — invite/accept/revoke lifecycle, immediate post-revoke
  DENY, re-invite-after-revoke ALLOW.
- **Parent Invite Tests**: PASS — replay rejected, unknown token rejected identically,
  multi-child reuses the existing User (no duplicate).
- **Parent Verification Tests**: PASS — token-possession-as-verification, expiry/
  already-accepted/already-revoked all rejected.
- **Parent Revocation Tests**: PASS — scope check denies on the next request; DocumentAccess
  grants independently expired in the same transaction.
- **IDOR Tests**: PASS — called directly against the API; cross-student, unlinked-parent,
  revoked-parent, arbitrary document/application/visa id all denied.
- **Cross-Student Tests**: PASS — a multi-child parent's request for child A under a URL
  naming child B (and vice versa) is denied by the detail-view `studentId` cross-check.
- **Document Permission Tests**: PASS — `listAccessibleTo` grant-scoped, no enumeration;
  download authenticate→verify→audit chain confirmed.
- **Notification Isolation Tests**: PASS — recipient-only, no cross-user reads.
- **Comment Visibility Tests**: N/A — no Comment/messaging capability was built this phase
  (ASM-49); existing Phase 04 Comment visibility split unaffected and unchanged.
- **Profile Field-Edit Tests**: PASS — no mutation route exists; verified by route-table
  inspection plus a direct `PATCH`/`PUT` attempt against `/portal/students/:id` returning
  `404 Cannot PATCH` (no matching route).
- **Task Scope Tests**: PASS — `visibleToStudent` gating, field redaction, FSM walk,
  `BLOCKED` rejected at the DTO layer.
- **Application/Scholarship/Visa/Enrollment Scope Tests**: PASS — detail/list field
  redaction and studentId cross-check, per resource.
- **Contract/Payment Field-Access Tests**: PASS — `value` visible, no internal-approval
  field exposed, no client-side balance calculation.
- **Field-Level Tests**: PASS — see FIELD-LEVEL SECURITY above; verified on both list and
  detail endpoints.
- **Session/Security Tests**: PASS — no new auth mechanism; existing session/JWT
  validation unaffected and unchanged.
- **Audit Tests**: PASS — invite/download metadata rows confirmed directly in `audit_logs`.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock, unchanged since Phase 03; one
  Phase-11-introduced unused-variable lint error was found and fixed during this phase's
  own development, not left outstanding).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors — see below.
- **Regression (Phase 01-10)**: PASS — see REGRESSION RESULTS above.

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
4 new (ASM-46 through ASM-49), full text in `docs/ASSUMPTIONS.md`:
- **ASM-46**: Parent relationship lifecycle — no new `ParentStudentLink` entity (extends
  `StudentContact` in place); token-possession invitation (`ParentInvitation`, mirrors
  `password_reset_tokens`); revocation closes both `ScopePolicyService`'s scope check AND
  existing `DocumentAccess` grants.
- **ASM-47**: `portal:access` as a single class-level permission gate, not a
  per-capability breakdown — the real authorization stays each reused domain's own scope
  check.
- **ASM-48**: Narrow, additive "submit evidence"/task-portal methods instead of reusing
  broad generic `update()`; `Task.visibleToStudent` opt-in default-false; unconditional
  `redactTaskForPortal`.
- **ASM-49**: Portal capability boundaries — read-only profile, no new Comment/messaging
  entity, latest-case-only for list/mutation with an explicit `studentId` cross-check on
  every detail view.

1 new `docs/DECISIONS.md` entry:
- **DEC-06**: `StudentContact.portalUserId`'s Phase 03 `@unique` constraint relaxed to a
  plain index — a Parent with multiple children was structurally impossible under the old
  constraint; revocability preserved per-relationship via `portalStatus`, not via the
  shared `User`.

## RISKS
- **No adjustment mechanism if a wrong parent is ever invited/accepted beyond simple
  revoke-and-reinvite** — revocation is immediate and clean (scope + DocumentAccess both
  closed), but there is no "undo an acceptance" or "merge two accidentally-separate Parent
  accounts for the same person" workflow; a future phase needing identity reconciliation
  would need new tooling, not just new endpoints on the existing model.
- **`ScopePolicyService`'s 7 revocation-aware methods now do one additional `portalStatus`
  check per call** — negligible in practice (same query, one more `WHERE` condition on an
  already-indexed column), but worth noting as the shape of the change for a future
  performance review, consistent with how prior phases have flagged similar additive scope
  checks.
- **No Comment/Portal-messaging capability exists** (ASM-49) — if a future phase's SRS
  concretely requires Student/Parent-to-staff messaging through the Portal specifically
  (rather than via the existing out-of-band Comment/notes mechanism), that is new schema
  and endpoint work, not a small extension.
- **Historical e2e test-fixture pollution against the shared `caseA` case** (see KNOWN
  ISSUES) was found and fixed this phase, but the same *class* of issue (a shared fixture
  entity accumulating rows from repeated local test runs with no `afterAll` cleanup) could
  recur in a different table if a future phase's test file makes the same omission — the
  fix here (track created ids, delete exactly those in `afterAll`) is the pattern to follow,
  not a one-time patch.

## KNOWN ISSUES
- **Pre-existing test-fixture pollution on the shared `caseA` case, found and fixed during
  this phase's own required Phase 01-10 regression run** (not a Phase 11 defect — full
  root-cause and fix already detailed in REGRESSION RESULTS above). Two files
  (`tasks.e2e-spec.ts`: 20 call sites, `notifications.e2e-spec.ts`: 8 call sites) created
  `module: 'counseling', taskType: 'follow_up'` Task rows directly against the shared
  `CASE-2026-90001` fixture on every run, with no cleanup, across many prior sessions —
  accumulating to 571 total Task rows (568 matching that module/type) by the time this
  phase's regression run surfaced it as a failing pagination assertion in
  `tasks.e2e-spec.ts` itself. Fixed at the source (both files now track every task id they
  create and delete exactly those in `afterAll` — never a blanket clear of `caseA`'s
  tasks, which would also remove the seeded `taskA`/`taskB`/`TASK-2026-90003` fixtures
  other tests depend on) and, since historical rows already existed in the dev database
  from before the fix existed, via one explicit, user-run, target-verified
  `prisma migrate reset --force` on the local dev-only Postgres container
  (`abroad-scholarship-postgres:55432`/`abroad_scholarship_dev`), followed by a clean
  migrate+seed and two consecutive clean full regression runs (402/402 both times, with a
  direct post-run row-count check confirming `caseA` returns to exactly 3 tasks — the
  correct baseline — after each run).
- **Windows jest-worker parallel-execution flakiness** (same class of issue documented in
  Phase 06-10's own Known Issues, unrelated to the above): `--runInBand` remains the
  reliable way to get a deterministic pass/fail signal on this machine; used for every
  regression run in this phase.
- One lint issue (an unused variable) was introduced and fixed within this phase's own
  development, not left outstanding; final lint run is 0 errors.
- Carried over from Phase 02-10, still accurate and unaffected by this phase: the
  `deepmerge-ts` dev-only `npm audit` advisories, the `eslint-visitor-keys` `EBADENGINE`
  warning, and the `otplib` 12.0.1 pin.

## next dependency (for Phase 12)
- Every domain named in `docs/architecture/DOMAIN_MAP.md` now has both a real backend
  implementation AND a Portal-facing read/action surface where the phase instructions have
  named one. Phase 12's own instruction file should be consulted for what it actually adds;
  `docs/PHASE_MAP.md` is the authoritative source, not an assumption made here.
- Real object storage/signed-URL/virus-scan for `Document` (deferred since Phase 07, ASM-23)
  remains outstanding — Portal's document download path is ready to point at real files the
  moment that infrastructure exists, no further schema change needed then.
- Real scheduled/queued notification dispatch (Redis/BullMQ, deferred since Phase 06,
  ASM-18) remains outstanding — Portal's notification inbox is fully functional today for
  already-created notifications; only the dispatch timing mechanism is deferred.
- If a future phase adds a frontend application, `docs/ASSUMPTIONS.md` ASM-08's "UI status"
  note should be revisited across every phase's UI CHANGES section, not just this one — the
  Portal API surface documented here (`docs/api/API_CONVENTIONS.md` section 11) is the
  concrete contract such a frontend would build against.
- The tracked-id-cleanup test-infrastructure pattern fixed this phase
  (`tasks.e2e-spec.ts`/`notifications.e2e-spec.ts`) should be considered the standard for
  any future test file that creates rows against a shared fixture entity — see RISKS above.

READY FOR PHASE 12: YES

Không tự chuyển sang Phase 12. Chờ prompt tiếp theo.
