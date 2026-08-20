# PHASE STATUS — PHASE_09 (Visa + Pre-Departure + Enrollment + Closure)

## status
PASS

## scope
Phase 09A (Visa, `09-visa/01_VISA.md`) + Phase 09B (Pre-Departure + Enrollment,
`09-visa/02_PRE_DEPARTURE_ENROLLMENT.md`, which also carries the Closure requirements).
Built directly on the Phase 01-08 foundation (architecture, DB schema, API conventions,
auth, RBAC, audit, Lead/Student/Case + Case FSM, Contract/Payment, Task Engine +
Notification Engine, Counseling/Profile Evidence/Writing, Documents module, Admission
domain) — no rewrite of anything already PASSed except the explicitly-requested extension
of `CasesService.close()` (Phase 04) with four new preconditions and `PaymentsModule`
gaining an export it previously lacked, both expected integration work named directly by
this phase's own instruction files, not a discovered defect. Visa was schema-scoped-only
(named in `docs/architecture/DOMAIN_MAP.md` domain 6) until this phase; it now has a real
controller/service/workflow, the same "schema/scope waited, this phase builds it" pattern
Phase 07 established for Documents and Phase 08 established for Admission. No Phase 10+
feature (Commission, PartnerStudentLink, real object storage) was implemented.

## implemented

**Visa**: student/case/offer/country/visa-type/status/submission/appointment/interview/
result/reason/evidence all present. Links to an existing Student/Case only, never creating
one; `offerId` is nullable (not every Case's visa process is tied to one specific accepted
Offer at creation time) but disambiguates Application/Offer/Program/University when set.
Strict server-side FSM (`VisasService`) — `NOT_STARTED → PREPARING → READY → SUBMITTED →
APPOINTMENT → INTERVIEW → GRANTED/REFUSED`, plus `WITHDRAWN` from any non-terminal state —
with SUBMITTED/APPOINTMENT/INTERVIEW/GRANTED/REFUSED each reachable only via their own
dedicated, data-carrying action, never a bare status PATCH. READY requires every
`required=true` Visa-scoped checklist item DONE/WAIVED first (`409
CHECKLIST_INCOMPLETE` otherwise); GRANTED/REFUSED require result evidence + date together.
"At most one non-terminal Visa per Case" is a service-layer check
(`VisasService.assertNoActiveDuplicate`, `409 ACTIVE_VISA_EXISTS`), not a DB unique
constraint — reapplying after WITHDRAWN/REFUSED creates a new row, preserving full history.

**Visa checklist**: configurable by (country, visaType) via `VisaChecklistTemplate` —
GLOBAL master/config data, same treatment as `TaskTemplate`/`ContractTemplate`, never
hard-coded in application logic. `VisasService.create` instantiates matching `active=true`
templates into real `VisaChecklistItem` rows exactly once, at Visa creation time; never
re-instantiated on read or edit. `VisaChecklistItem` is deliberately ONE new polymorphic
entity (`entityType`/`entityId`, the same pattern already used by `Comment`/`Approval`/
`Document.ownerEntity`) shared by two Phase 09 consumers — `entityType='Visa'` for
Visa-scoped items, `entityType='PreDeparture'` (entityId = Case.id) for pre-departure items
— rather than a third near-duplicate checklist entity; Phase 08's already-PASSed
`ApplicationChecklist` was deliberately left untouched, not retroactively generalized
(`docs/ASSUMPTIONS.md` ASM-33).

**Visa documents**: every evidence field (`Visa.evidenceDocumentId`,
`Visa.resultEvidenceDocumentId`, `VisaChecklistItem.documentId`) is a real FK into the
existing Document subsystem — explicitly no VisaDocument/VisaFile/VisaStorage model, no
expansion into full object storage. Setting one calls `DocumentsService.grantCaseAccess`
immediately after, the identical Phase 07/08 pattern — grant-based, download-gated, never a
public URL.

**Visa result**: GRANTED and REFUSED are reachable only via `POST .../result`, never a
generic status PATCH, since a real result carries required evidence + date. WITHDRAWN and
REFUSED preserve full history (the row is never deleted or overwritten) with `reason`
recorded.

**Pre-Departure checklist**: configurable, not hard-coded, across the suggested categories
(passport/visa/flight/insurance/accommodation/airport transfer/orientation/emergency
contact/tuition deposit/travel documents) via `VisaChecklistItem.category` (free text,
nullable — a Visa-scoped item has no natural category). Each item carries owner/status/
deadline-if-needed/evidence-if-needed/completion tracking, reusing the same
`ChecklistItemStatus` enum as Phase 08's `ApplicationChecklist` (PENDING/IN_PROGRESS/DONE/
WAIVED), unchanged. Mandatory-item completion gates Case Closure (see below), not a
hard-coded controller check.

**Enrollment**: institution/program/start-date/confirmation-date/evidence all present, a
Student/Case *transaction*, not master data — references Offer/Application/Program/
University by FK only, never duplicating University/Program data. Creating an Enrollment
requires the target Offer to belong to the same Case AND be `ACCEPTED`
(`409 INVALID_ENROLLMENT_TARGET` otherwise — rejects DECLINED/EXPIRED/WITHDRAWN/RECEIVED
offers and offers from another Case); `universityId`/`programId` are derived server-side
from the Offer's Application → Program row, never accepted from client input. History
design: multiple `PLANNED` attempts and a full `WITHDRAWN` history are allowed (never
overwritten); "at most one `CONFIRMED` Enrollment per Case" is a service-layer check
(`EnrollmentsService.assertNoActiveConfirmed`, `409 CONFIRMED_ENROLLMENT_EXISTS`) —
resolving the explicit "cần thiết kế lịch sử nếu cho phép nhiều lần nhập học" instruction as
history-with-a-single-active-slot, not a hard one-row-per-Case constraint.

**Closure**: `CasesService.close()` (Phase 04, already-PASSed, extended per this phase's
explicit instruction to reuse it — never a second Case FSM, never a direct status write
from a Visa/Enrollment controller) gates on Phase 04's existing open-task check plus four
new Phase 09 preconditions, each its own guard reusing an existing service: outstanding
Contract/Payment debt (`PaymentsService.hasOutstandingDebtForCase`, unconditional — any
Payment in PENDING/PARTIALLY_PAID/OVERDUE on the Case's linked Contract, `409
OUTSTANDING_DEBT_REMAINS`); any non-terminal Visa (`VisaStatusService.hasOpenVisa`,
unconditional, `409 VISA_IN_PROGRESS`); an unconfirmed Enrollment when at least one
Application exists for the Case (`VisaStatusService.hasUnconfirmedRequiredEnrollment`,
conditional, `409 ENROLLMENT_NOT_CONFIRMED`); an incomplete Pre-Departure checklist when at
least one item exists (`VisaStatusService.hasIncompletePreDepartureChecklist`, conditional,
`409 PRE_DEPARTURE_CHECKLIST_INCOMPLETE`). The last two are conditional so a Case
legitimately closed before ever reaching Admission/pre-departure isn't incorrectly blocked
— see `docs/ASSUMPTIONS.md` ASM-36. Closure reason/actor/timestamp/audit were already
enforced by Phase 04's `close()`; no hard-delete anywhere.

**Task integration**: `06-operations/01_TASK.md` named "visa" as an auto-generation
trigger, deliberately deferred at Phase 06 (ASM-16) and again at Phase 08 (ASM-30) since no
Visa entity existed yet. This phase adds exactly one new `TaskTemplateTrigger` value —
`VISA_GRANTED` (fires once at Visa→GRANTED, never on REFUSED) — the LAST of Phase 06's
three originally-deferred triggers (`application`/`scholarship` were closed out in Phase
08), reusing `TaskGenerationService.generateForEvent` unchanged (same `(templateId,
sourceEntityType, sourceEntityId)` idempotency guarantee, no new dedup logic, no new Task
entity).

**Notification integration**: three new events wired via
`NotificationsService.notifyBothChannels` (in-app + email, minimal non-sensitive payload —
reference ids only, never passport/financial/internal-notes-grade text) —
`VISA_SUBMITTED`, `VISA_APPOINTMENT_SCHEDULED` (the literal Phase-06-deferred "visa
appointment" event), and `VISA_RESULT` (fired for both GRANTED and REFUSED). "Visa
deadline" and "document missing" were deliberately NOT built — no concrete cadence/trigger
is specified anywhere, the same restraint Phase 08 applied to Application/Scholarship
deadline reminders (ASM-30, extended here as ASM-39).

**RBAC/scope**: four new grouped permission resources (`visa` — covers Visa + Visa-scoped
checklist items, `visa_checklist_templates` — GLOBAL master data, `pre_departure`,
`enrollment`) mirroring each instruction file's own entity grouping. Visa/Enrollment/
pre-departure reuse the existing Student/Case `ROLE_SCOPE` via
`ScopePolicyService.assertCaseAccessible` — no new scope map (ASM-20/ASM-28 precedent
extended). ED/DM get full grant on all four. CONSULTANT gets full `view/create/edit` on
`visa`/`pre_departure`/`enrollment` (its counseling-execution domain) but view-only on
`visa_checklist_templates` (curation is ED/DM-only, mirroring Program's tuition-curation
precedent). DOCUMENT_SPECIALIST gets full `view/create/edit` on `visa`/`pre_departure`
(paperwork-heavy, its actual document-processing domain) but view-only on `enrollment` and
templates. SALES_MARKETING gets zero on the three sensitive resources and view-only on
templates — "không mặc nhiên được xem visa/identity/finance evidence." ADMIN_FINANCE gets
zero grant on all four — kept conservative and consistent with its Phase 07/08 treatment
even though the literal instruction text only bars *editing* visa counseling data.
STUDENT_PARENT is view-only across all four, own case only — no self-service submit/
confirm/withdraw in this phase. SYSTEM_ADMIN gets zero, consistent with every prior phase.
See `docs/ASSUMPTIONS.md` ASM-37.

**Field-level security**: `internalNotes` on both `Visa` and `Enrollment` is redacted from
STUDENT_PARENT (`FieldPolicyService.redactVisa`/`redactEnrollment`), the same pattern
already used for `ScholarshipApplication.internalNotes`/`LetterOfRecommendation.
internalNotes`. Appointment/interview/result/refusal-reason fields are deliberately left
visible to the affected Student/Parent — that data is the student's own outcome, not
staff-internal commentary, the same line already drawn for Contract value staying visible
to the owning Student while hidden from Consultant/Sales. Passport/identity/financial
EVIDENCE protection is handled entirely via the existing Document grant system — no raw
sensitive text field exists on `Visa` itself. See `docs/ASSUMPTIONS.md` ASM-38.

**Module architecture**: `VisaStatusService` lives in its own dependency-free leaf module
(`VisaStatusModule`, zero imports beyond the globally-available `PrismaModule`) so
`CasesModule` (case-management domain) can import it directly for Closure's read-only
checks without creating a circular dependency — this is exactly the "expose point"
`docs/architecture/DOMAIN_MAP.md` itself pre-declared ("`VisaStatusService` dùng bởi
case-management để cho phép Case chuyển sang Closed"). `PaymentsModule` was extended with
`exports: [PaymentsService]` (previously had none) and imported directly into
`CasesModule` — confirmed safe since `PaymentsModule` itself only imports
`IdentityModule`/`NotificationsModule`, no dependency back on `case-management`.

**No production defect found this phase** — unlike Phase 04's DEC-03, Phase 05's DEC-04, or
Phase 08's DEC-05, no conflict between an already-PASSed decision and this phase's
instructions was discovered. The `CasesService.close()`/`PaymentsModule` extensions were
explicitly-requested, expected integration work, not a silently-resolved conflict — no new
`docs/DECISIONS.md` entry was needed this phase.

## files read
- `09-visa/01_VISA.md`, `09-visa/02_PRE_DEPARTURE_ENROLLMENT.md`
- Phase 01-08 documentation/checkpoints already in this session's context:
  `docs/architecture/{DOMAIN_MAP,TARGET_ARCHITECTURE}.md`, `docs/database/{ERD,
  DATA_DICTIONARY}.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,
  RBAC_MATRIX}.md`, `docs/phase-status/{01-discovery,PHASE_02...PHASE_08}.md`,
  `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PHASE_MAP.md`,
  `database/schema.prisma`, `apps/api/src/**` (existing code, especially the Phase 04 Case
  FSM/service, Phase 05 Payment service, Phase 06 Task/Notification engines, Phase 07
  Documents module, and Phase 08 Admission Application/Offer services as direct reuse and
  integration targets)

## files created/updated
Database: `database/schema.prisma` (`TaskTemplateTrigger` +`VISA_GRANTED`; new
`VisaStatus`/`EnrollmentStatus` enums; new `Visa`/`VisaChecklistTemplate`/
`VisaChecklistItem`/`Enrollment` models; `Student`/`Case`/`University`/`Program`/`Offer`/
`Document` back-relations), 2 new migrations
(`20260819085000_visa_predeparture_enrollment_phase09`,
`20260819090500_visa_checklist_item_category_phase09` — the second a same-phase correction
adding `VisaChecklistItem.category`, applied before any dependent code was written, not a
rewrite of already-shipped work), `database/seeds/seed.ts` (12 new permission rows + per-role
grants for `visa`/`visa_checklist_templates`/`pre_departure`/`enrollment`; Visa fixtures —
offerB (ACCEPTED, distinct from Phase 08's own offerA), one VisaChecklistTemplate, visaA
(SUBMITTED, internalNotes set), one Visa-scoped + one PreDeparture-scoped VisaChecklistItem,
enrollmentA (CONFIRMED, internalNotes set)).

API (`apps/api/src/modules/visa/`, new domain):
- `visa.module.ts`
- `visa-status/{visa-status.service,visa-status.module}.ts` (leaf module, zero imports)
- `visa-checklist-templates/{dto,visa-checklist-templates.service,
  visa-checklist-templates.controller,visa-checklist-templates.module}.ts`
- `visas/{dto,visas.service,visa-checklist.service,visas.controller,
  visa-checklist.controller,visas.module}.ts`
- `pre-departure/{dto,pre-departure.service,pre-departure.controller,
  pre-departure.module}.ts`
- `enrollments/{dto,enrollments.service,enrollments.controller,enrollments.module}.ts`
- `modules/identity/rbac/field-policy.service.ts` (+ `redactVisa`/`redactEnrollment`)
- `modules/case-management/tasks/dto/create-task-template.dto.ts` (`TRIGGER_EVENTS`
  +VISA_GRANTED)
- `modules/case-management/cases/cases.service.ts` (`close()` +4 new preconditions,
  constructor +`PaymentsService`/`VisaStatusService`)
- `modules/case-management/cases/cases.module.ts` (+`PaymentsModule`/`VisaStatusModule`
  imports)
- `modules/commercial/payments/payments.module.ts` (+`exports: [PaymentsService]`)
- `modules/commercial/payments/payments.service.ts` (+`hasOutstandingDebtForCase`)
- `app.module.ts` (registers VisaModule)

Tests (`apps/api/test/`): `visa.e2e-spec.ts` (Visa/checklist-template/FSM/Task/
Notification/RBAC/field-redaction/audit coverage), `pre-departure-enrollment-closure.
e2e-spec.ts` (Pre-Departure/Enrollment/Closure coverage) — 40 new e2e tests total.

Docs: `docs/security/RBAC_MATRIX.md` (4 new permission columns, record-scope notes,
Actions-table CLOSE-row extension, field-level protection rows, allow/deny fixture
description, section 7 deferral updates reflecting VISA_GRANTED/VISA_APPOINTMENT_SCHEDULED
now wired plus new Phase 09 deferral bullets), `docs/database/{ERD,DATA_DICTIONARY}.md`
(new Visa domain section — ERD section 12, DATA_DICTIONARY section 4.13 — table reference
renumbered 4.13→4.20), `docs/api/API_CONVENTIONS.md` (section 11 — all new Phase 09
endpoints + the extended `/cases/:id/close` precondition list), `docs/ASSUMPTIONS.md`
(ASM-33 through ASM-39), this file. No new `docs/DECISIONS.md` entry — see "No production
defect found this phase" above.

## VISA
Student/case/offer/country/visa-type/status/submission/appointment/interview/result/
reason/evidence all present. Verified directly: `studentId` always matches the parent
Case's student; creating a Visa against a non-matching country/visaType still instantiates
the correct `VisaChecklistTemplate` rows; a second non-terminal Visa for the same Case is
rejected `409 ACTIVE_VISA_EXISTS`; reapplying after WITHDRAWN succeeds as a brand-new row
(the withdrawn row's own history untouched).

## VISA WORKFLOW
NOT_STARTED→PREPARING→READY→SUBMITTED→APPOINTMENT→INTERVIEW→GRANTED/REFUSED (+WITHDRAWN
from any non-terminal state), fully server-side. Verified directly: full FSM walk
Preparing→Ready→Submitted→Appointment→Interview→Granted succeeds; a Refused-directly-from-
Submitted path (no interview required) succeeds; an illegal jump (e.g. straight to READY
with an incomplete checklist) is rejected `409 CHECKLIST_INCOMPLETE`; GRANTED/REFUSED
reachable only via `POST .../result`, never the generic status PATCH (`400`); GRANTED/
REFUSED/WITHDRAWN freeze further generic edits (`409`).

## VISA CHECKLIST
Title/category/required/owner/deadline/status/document/notes all present, template-driven
via `VisaChecklistTemplate` keyed by (countryCode, visaType, title). Verified directly:
matching active templates auto-instantiate exactly once at Visa creation; READY is blocked
until every required item is DONE/WAIVED; a WAIVED required item satisfies the gate the
same as DONE.

## VISA DOCUMENTS
Every evidence field verified to grant case-member/student access on link (via
`DocumentsService.grantCaseAccess`) and to gate download (`404` for a non-granted user,
never a public URL — no `fileUrl` field ever present in a response body). No
VisaDocument/VisaFile/VisaStorage entity exists anywhere in the schema.

## VISA RESULT
Verified directly: `result` records evidence + date together and is reachable only via its
own dedicated action (a direct `status: GRANTED` PATCH is rejected `400`); a REFUSED visa
cannot be edited further (`409`); `reason` is preserved on both REFUSED and WITHDRAWN rows.

## PRE-DEPARTURE
Title/category/required/owner/deadline/status/document/notes all present on the
Case-scoped (`entityType='PreDeparture'`) `VisaChecklistItem` rows, free-text category
across the suggested set (passport/visa/flight/insurance/accommodation/airport transfer/
orientation/emergency contact/tuition deposit/travel documents), never a hard-coded enum.

## PRE-DEPARTURE CHECKLIST
Verified directly: a WAIVED required item satisfies completion the same as DONE; an
incomplete required item blocks Case Closure (`409
PRE_DEPARTURE_CHECKLIST_INCOMPLETE`) only when at least one pre-departure item exists for
the Case (conditional gate, ASM-36).

## ENROLLMENT
Institution/program/start-date/confirmation-date/evidence all present, real FK to
Offer/Program/University (derived server-side, never client-supplied). Verified directly: a
non-ACCEPTED target Offer is rejected `409 INVALID_ENROLLMENT_TARGET`; an Offer belonging
to a different Case is rejected the same way; `universityId`/`programId` in the response
always match the target Offer's Application → Program, with no client-writable override.

## ENROLLMENT RELATIONSHIPS
Verified directly: one Student/Case can carry multiple PLANNED Enrollment attempts and a
full WITHDRAWN history without overwriting; a second CONFIRMED Enrollment for the same Case
is rejected `409 CONFIRMED_ENROLLMENT_EXISTS`; withdrawing a CONFIRMED Enrollment frees the
Case for a new confirmation.

## CLOSURE
Verified directly: closure reason/actor/timestamp recorded via Phase 04's existing `close()`
path (extended, not duplicated); no hard-delete of a closed Case anywhere; a Case with no
Visa/Enrollment/pre-departure activity at all still closes cleanly (Phase 04 regression,
conditional gates correctly skip when the workflow was never engaged).

## CLOSURE VALIDATION
Verified directly, one test per gate: `OUTSTANDING_DEBT_REMAINS` blocks closure with a
pending Payment, closure succeeds once the debt is settled; `VISA_IN_PROGRESS` blocks
closure with a non-terminal Visa, closure succeeds once the Visa reaches GRANTED/REFUSED/
WITHDRAWN; `ENROLLMENT_NOT_CONFIRMED` blocks closure when an Application exists but no
Enrollment is CONFIRMED; `PRE_DEPARTURE_CHECKLIST_INCOMPLETE` blocks closure with an
incomplete required item. A comprehensive full-happy-path test walks debt-settlement +
visa-granted + enrollment-confirmed + pre-departure-complete through to a successful `200`
close.

## CASE INTEGRATION
Verified directly: `close()` is the ONLY path to CLOSED status — no Visa/Enrollment
controller writes `case.status` directly; the existing Phase 04 open-task guard still fires
alongside the four new Phase 09 guards in the same call.

## CONTRACT/PAYMENT INTEGRATION
Verified directly: `PaymentsService.hasOutstandingDebtForCase` reuses the existing
`syncOverdueStatus`/`Payment.status` query path — no duplicate debt calculation, no new
Payment entity; a Case with no linked Contract passes this gate trivially (returns `false`).

## APPLICATION/OFFER INTEGRATION
Verified directly: Enrollment creation checks the EXISTING Application/Offer relations
(accepted/declined/expired/multiple-offers/withdrawal all exercised) — an invalid Offer
(any non-ACCEPTED status, or an Offer under a different Case) is never accepted as an
enrollment target.

## SCHOLARSHIP INTEGRATION
Verified directly: no FK/shared column exists anywhere between `Enrollment`/`Visa` and
`ScholarshipApplication`'s award fields — scholarship award, Contract payment/tuition
payment, and partner commission remain fully unmixed, matching the same "Không trộn"
discipline Phase 08 established for `ScholarshipApplication` itself.

## TASK INTEGRATION
`VISA_GRANTED` verified idempotent — repeat-fire (a Visa granted once) produces exactly one
generated task per active template, matching `(templateId, sourceEntityId)`, with the
template deactivated in a `finally` block after the test to avoid leaking into other
suites; verified REFUSED never fires it.

## NOTIFICATION INTEGRATION
Verified directly: `VISA_SUBMITTED` notifies every current CaseMember on both channels
(IN_APP + EMAIL, ≥2 notification rows per submission); payload never carries passport/
financial/internal-notes-grade text. `VISA_APPOINTMENT_SCHEDULED`/`VISA_RESULT` wired the
same way, exercised via the FSM-walk test.

## RBAC/AUTHORIZATION
Every Phase 09 entity's scope check reuses `assertCaseAccessible` (ASM-20/ASM-28/ASM-37
precedent) — verified with the same cross-case DENY pattern established in Phase 03-08: a
Consultant not on the Case's member list gets `404`, not `403`, on every route.
SALES_MARKETING/ADMIN_FINANCE get `403` on the three sensitive resources; master-data-vs-
transaction permission separation (CONSULTANT view-only on `visa_checklist_templates`, full
CRUD on the three transaction resources) verified directly.

## FIELD-LEVEL SECURITY
`FieldPolicyService.redactVisa`/`redactEnrollment` — new, verified live on every
`visas`/`enrollments` response (both detail and list) for STUDENT_PARENT (`internalNotes`
null, appointment/status/other non-sensitive fields still visible).

## AUDIT
Every mutating Phase 09 route is `@Audit`-decorated (CREATE/EDIT/VIEW/ARCHIVE as
appropriate); verified directly for `GET /visas/:id` (VIEW) and `PATCH /cases/:id/close`
(ARCHIVE — the existing Phase 04 audit action type, not a new one).

## DATABASE CHANGES
2 new migrations on top of Phase 01-08's 13: fully additive (`ADD COLUMN`/`CREATE TABLE`/
`CREATE TYPE`/`ALTER TYPE ... ADD VALUE`/`CREATE INDEX`), confirmed by inspecting the
generated SQL (`prisma migrate diff`, zero `DROP` statements) before applying each. No
entity renamed, merged, or duplicated; no Phase 01-08 table altered destructively.

## MIGRATIONS
1. `20260819085000_visa_predeparture_enrollment_phase09` — `VisaStatus`/`EnrollmentStatus`
   enums, `TaskTemplateTrigger +VISA_GRANTED`, new `visas`/`visa_checklist_templates`/
   `visa_checklist_items`/`enrollments` tables + indexes + FKs.
2. `20260819090500_visa_checklist_item_category_phase09` — a same-phase correction, applied
   before any service code depended on the missing column:
   `ALTER TABLE visa_checklist_items ADD COLUMN category TEXT`.

Applied via `prisma migrate diff` (script) + a hand-created migration folder +
`prisma migrate deploy`, the same non-interactive pattern established in Phase 02-08.

## API CHANGES
See `docs/api/API_CONVENTIONS.md` section 11 for the full list. Summary: 4 new
`/visa-checklist-templates*` routes, 8 new `/cases/:caseId/visas*`/`/visas/:id*` routes, 3
new checklist routes, 3 new `/cases/:caseId/pre-departure*`/`/pre-departure-items/:id`
routes, 6 new `/cases/:caseId/enrollments*`/`/enrollments/:id*` routes — 24 new routes
total, plus the extended `/cases/:id/close` precondition set (no new route, existing Phase
04 route).

## UI CHANGES
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged this phase). Every workflow named in 09-visa/01-02
(Visa tracking, checklist management, pre-departure checklist, Enrollment confirmation,
Closure) is satisfied as an API capability a future UI would call, consistent with the same
reasoning applied in Phase 03-08.

## TESTS
- Unit: 0 new spec files this phase — 161/161 total (unchanged from end of Phase 08).
  `VisasService`/`VisaChecklistService`/`VisaChecklistTemplatesService`/
  `PreDepartureService`/`EnrollmentsService`/`VisaStatusService`'s business logic (FSM
  transitions, checklist gating, offer-validity checks, closure preconditions, task/
  notification integration) is covered by e2e, not a separate mocked-Prisma unit spec —
  consistent with the established codebase convention (only the stateless RBAC-policy
  layer, `FieldPolicyService`, gets unit specs, and its `redactVisa`/`redactEnrollment`
  additions follow the same e2e-only precedent already set in Phase 07/08).
- Integration/e2e: 2 new suites (`visa.e2e-spec.ts`, `pre-departure-enrollment-closure.
  e2e-spec.ts` — 40 tests combined) — 335/335 total across all 18 suites (up from 295),
  full suite run clean twice consecutively for repeatability.

## REGRESSION RESULTS
Phase 01-08 full prior suite (161 unit + 295 e2e: auth/RBAC/field-level/audit,
Lead/Student/Case/CaseMember/cross-case-isolation/duplicate-detection, Contract
workflow/Amendment/Payment/partial-payment/refund/waive/overdue/idempotency, Task
workflow/dependency/generation/overdue, Notification fan-out/dedup/recipient-scoping,
Assessment/Roadmap/Milestone versioning+approval+dependency, Profile Evidence
history/attempts/evidence-linkage, Writing versioning/review/LOR redaction,
University/Program/ScholarshipMaster master data, Application workflow/checklist/
duplicate-prevention, Offer lifecycle, ScholarshipApplication eligibility/result) still
passes unmodified, run as part of the same full-suite executions below (161/335 totals
include every Phase 01-08 test unchanged).

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate deploy` applied cleanly (both migrations); schema
  fully additive, confirmed via the generated SQL before applying.
- **Seed**: PASS — `npm run db:seed` completes, verified idempotent (run twice
  consecutively, no error/duplication); grant/prune verified (4 new resources correctly
  scoped per role, including CONSULTANT-templates-view-only,
  DOCUMENT_SPECIALIST-visa/pre_departure-full, SALES_MARKETING-zero-on-sensitive,
  ADMIN_FINANCE-zero, STUDENT_PARENT-view-only).
- **Unit Tests**: PASS — 161/161.
- **Integration Tests**: PASS — 335/335 (this project's tooling doesn't separate
  "integration" from "e2e" — see `docs/PROJECT_STRUCTURE.md`).
- **E2E Tests**: PASS — 335/335, 18 suites, verified stable across two consecutive runs.
- **Visa Tests**: PASS — creation, checklist-template instantiation, at-most-one-active
  duplicate rejection, reapplication-after-WITHDRAWN history preservation.
- **Visa Workflow Tests**: PASS — full FSM walk, Refused-directly-from-Submitted path,
  illegal-jump rejection, GRANTED/REFUSED-only-via-dedicated-action, terminal-state
  edit-freeze.
- **Visa Checklist Tests**: PASS — template-driven instantiation, mandatory-gate, WAIVED-
  satisfies-gate.
- **Visa Document Tests**: PASS — grant propagation, download gated, no public URL, no
  VisaDocument/VisaFile/VisaStorage entity anywhere.
- **Visa Result Tests**: PASS — result-action-only reachability, evidence+date together,
  reason preserved on REFUSED/WITHDRAWN.
- **Pre-Departure Tests**: PASS — free-text category, WAIVED-satisfies-completion.
- **Pre-Departure Checklist Tests**: PASS — conditional closure gate verified both present
  and absent.
- **Enrollment Tests**: PASS — Offer-validity rejection (non-ACCEPTED, cross-case), derived
  university/program, at-most-one-CONFIRMED enforcement.
- **Enrollment Relationship Tests**: PASS — multiple PLANNED history, WITHDRAWN frees the
  Case.
- **Closure Tests**: PASS — all four preconditions individually blocking and individually
  clearing; no-activity-at-all Phase-04-regression case; full happy-path walk.
- **Closure Validation Tests**: PASS — see above; unauthorized closer `404`.
- **Case Integration Tests**: PASS — `close()` is the only path to CLOSED; no direct status
  writes from Visa/Enrollment controllers.
- **Contract/Payment Integration Tests**: PASS — no duplicate debt calculation; no-Contract
  Case passes trivially.
- **Application/Offer Integration Tests**: PASS — see Enrollment Tests above.
- **Scholarship Integration Tests**: PASS — no FK/shared column with award fields anywhere.
- **Task Integration Tests**: PASS — VISA_GRANTED idempotent, REFUSED never fires it.
- **Notification Integration Tests**: PASS — fan-out verified, payload minimality verified.
- **Cross-Case Tests**: PASS — every Phase 09 entity denies (404) a Consultant/user not on
  the target Case, across all read and write routes.
- **Field-Level Authorization Tests**: PASS — `internalNotes` redacted for STUDENT_PARENT
  on both Visa and Enrollment, real values for staff roles.
- **Audit Tests**: PASS — CREATE/EDIT/VIEW/ARCHIVE rows verified for representative
  mutations.
- **Idempotency/Retry Tests**: PASS — duplicate-notification dedupe and Task-generation
  idempotency both verified via repeat-fire.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock, unchanged from Phase 03-08).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.
- **Regression (Phase 01-08)**: PASS — see REGRESSION RESULTS above.

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
7 new (ASM-33 through ASM-39), full text in `docs/ASSUMPTIONS.md`:
- **ASM-33**: `VisaChecklistItem` is one polymorphic entity shared by Visa and
  Pre-Departure, deliberately not merged with Phase 08's `ApplicationChecklist`.
- **ASM-34**: Visa uses the master-context-defined `VISA-YYYY-NNNNN` business-ID format;
  `VisaChecklistTemplate`/`VisaChecklistItem`/`Enrollment` get no business code (plain
  UUID, sub-record precedent).
- **ASM-35**: Visa FSM design — dedicated data-carrying actions for
  Submitted/Appointment/Interview/Result; at-most-one-active-Visa-per-case; Interview is
  optional, not mandatory (a Refused can follow directly from Submitted).
- **ASM-36**: Closure preconditions — Payment/Visa checks are unconditional, Enrollment/
  pre-departure checks are conditional on that workflow having actually been engaged.
- **ASM-37**: Phase 09 RBAC grant matrix — master-data curation separated from case-scoped
  transaction permissions, mirroring Phase 08's ASM-31.
- **ASM-38**: Field-level redaction scope — only `internalNotes`; appointment/interview/
  result/reason stay visible to the affected Student/Parent.
- **ASM-39**: Task/Notification triggers — `VISA_GRANTED` closes out Phase 06's last
  deferred Task trigger; three notification events chosen from the deferred candidate list
  (`document request` and deadline-cadence events remain genuinely deferred).

No new `docs/DECISIONS.md` entry this phase — see "No production defect found this phase"
above.

## RISKS
- `VisasService.assertNoActiveDuplicate` and `EnrollmentsService.assertNoActiveConfirmed`
  (service-layer checks replacing a DB constraint) are, like every service-layer
  uniqueness rule in this codebase (Case's at-most-one-active, Application's DEC-05 check),
  subject to a narrow TOCTOU race under concurrent requests that a DB unique index would
  have closed automatically — accepted as consistent with the codebase's existing
  precedent rather than solved with a partial/conditional unique index this phase didn't
  build.
- The four Closure preconditions run as sequential awaited checks inside one service
  method, not a single transaction — under pathological concurrent mutation (e.g. a Payment
  becoming overdue mid-closure-request) a narrow race is theoretically possible, the same
  class of risk already accepted for Phase 04's original open-task check.
- `visas.visaType`/`visa_checklist_templates.visaType` are free text with no canonical
  list — a future phase introducing a formal visa-type taxonomy would need a data-migration
  pass, not just a new assumption.

## KNOWN ISSUES
- **Fixed during this phase's own test development, not left outstanding**: two
  self-authored e2e test bugs were found and fixed before this phase's own test suite was
  considered complete. (1) `visa.e2e-spec.ts`'s FSM-progression tests originally used the
  literal `visaType: 'F-1'`, colliding with the seeded `VisaChecklistTemplate` fixture
  (also `US`/`F-1`) — `VisasService.create()` correctly auto-instantiated an extra required
  checklist item the tests never completed, silently blocking READY several steps later.
  Root-caused via the actual `409` response bodies, not guessed; fixed via a `replace_all`
  Edit changing every literal `visaType: 'F-1'` to a randomized template literal in both new
  test files. (2) `pre-departure-enrollment-closure.e2e-spec.ts`'s `createAcceptedOffer`
  helper, when called twice for the same Case (needed by the at-most-one-CONFIRMED and
  withdraw-frees-the-case tests), collided with Application's own Phase 08 DEC-05
  duplicate-prevention rule on the second call. Fixed by adding a freshly-randomized
  `intendedIntake` default parameter to the helper. Neither bug touched any Phase 01-08
  file or assertion; both were caught and fixed entirely within this phase's own new test
  code before the full suite was run to green.
- A Windows-specific `jest-worker` teardown flake (`Error: kill EPERM` during forced worker
  exit, or the benign "A worker process has failed to exit gracefully" warning), identical
  to the one documented in Phase 06-08's Known Issues — observed intermittently again this
  phase; when it doesn't occur, all 335 tests pass consistently. Not a Phase 09 regression.
- Two background e2e test runs during this phase returned `status: "killed"` with zero
  output (no error, no partial test output) — diagnosed as harness/session-level
  interruption unrelated to test content (Docker/Postgres confirmed healthy each time);
  resolved by re-running the identical command in the foreground, which completed normally
  both times (~200s). One earlier background run separately hit a transient
  `PrismaClientInitializationError: Can't reach database server` plus unrelated test
  timeouts spread across totally unrelated files — diagnosed as transient resource
  contention, confirmed by a clean retry. `demo.consultant.a`'s case-membership count
  confirmed stable (well under `rbac.e2e-spec.ts`'s `limit: 100`) after repeated clean e2e
  runs, confirming the Phase 08 leak-fix continues to hold for the two new Phase 09 test
  files, which follow the same tracked-cleanup `afterAll` pattern.
- Carried over from Phase 02-08, still accurate and unaffected by this phase: the
  `deepmerge-ts` dev-only `npm audit` advisories, the `eslint-visitor-keys` `EBADENGINE`
  warning, and the `otplib` 12.0.1 pin.

## next dependency (for Phase 10)
- Commission (Partner-facing money) and `PartnerStudentLink`/`CommissionRule`/
  `CommissionTransaction` remain the next entities named by `docs/architecture/
  DOMAIN_MAP.md` domain 7 (Partners) — deliberately not touched this phase (ASM-13,
  reconfirmed). Phase 10 should keep Commission fully separate from `Payment`/
  `ScholarshipApplication.awardAmount`, continuing the "Không trộn" discipline established
  across Phase 05/08/09.
- `TaskTemplateTrigger`/notification event set remain designed to be extended, not
  replaced — this was the phase that closed out every trigger Phase 06's own instruction
  files originally named (`application`/`scholarship`/`visa`, split across Phase 08/09).
  Phase 10 introducing Commission/Partner workflow logic should add new enum values/event
  strings there rather than inventing a parallel mechanism. `document request` remains the
  one still-deferred notification event with no concrete owning entity/trigger definition.
- `docs/security/RBAC_MATRIX.md` section 2's grant table is the pattern to extend for
  whatever resource(s) Phase 10 introduces — follow the same grant-and-prune seed
  discipline, and weigh the same grouped-vs-per-entity resource judgment call documented in
  ASM-21/ASM-31/ASM-37 before defaulting to one resource per entity.
- Real object storage/signed-URL/virus-scan for `Document` (deferred since Phase 07,
  ASM-23) remains Phase 12 — Phase 09's evidence links are ready to point at real files the
  moment that infrastructure exists, no schema change needed then.
- `VisaStatusService`'s leaf-module pattern (dependency-free, imported directly by a
  consuming domain for a narrow read-only check) is the template to follow if Phase 10's
  Commission logic needs a similar cross-domain read from case-management or commercial,
  avoiding a circular dependency the same way.

READY FOR PHASE 10: YES

Không tự chuyển sang Phase 10. Chờ prompt tiếp theo.
