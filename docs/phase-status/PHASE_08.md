# PHASE STATUS — PHASE_08 (Admission)

## status
PASS

## scope
Phase 08A (Master Data, `08-admission/01_MASTER_DATA.md`) + Phase 08B (Application,
`08-admission/02_APPLICATION.md`) + Phase 08C (Offer + Scholarship,
`08-admission/03_OFFER_SCHOLARSHIP.md`). Built directly on the Phase 01-07 foundation
(architecture, DB schema, API conventions, auth, RBAC, audit, Lead/Student/Case,
Contract/Payment, Task Engine + Notification Engine, Counseling/Profile Evidence/Writing,
Documents module) — no rewrite of anything already PASSed except one genuine pre-existing
requirements conflict found and resolved by this phase's own design work (see DEC-05
below). Admission's foundation-slice entities (University, Program, ScholarshipMaster,
Application — schema-only since Phase 02, never wired to a real service) got their first
real controller/service/workflow this phase, the same "schema waited, this phase builds
it" pattern Phase 07 already established for the Documents module. No Phase 09+ feature
(Visa, pre-departure/enrollment, real object storage) was implemented.

## implemented

**University master**: name/country/city/campus/website/admissions URL/status/owner/
source/last_verified_at all present. GLOBAL, permission-gated only (no per-record scope
check) — same treatment as `ContractTemplate`/`TaskTemplate`. Duplicate prevention:
service-layer check on (official_name, country_code), case-insensitive, `409
DUPLICATE_UNIVERSITY`. A dedicated `verify` action (its own `admission_master:verify`
permission, distinct from `edit`) stamps `last_verified_at` only — "Source/verification
fields có thể có permission riêng." No University/Program/ScholarshipMaster business-ID
format is defined in `00-context/00_MASTER_CONTEXT.md`; `UNI`/`PRG`/`SCHM` prefixes were
invented and documented (`docs/ASSUMPTIONS.md` ASM-26).

**Program master**: must belong to exactly one University (real FK, never a duplicated
university-name string) — degree level/major/duration/intake/tuition/application
fee/eligibility/requirements/source all present. Duplicate prevention on (university,
degree, major, intake). Application references Programs by ID only.

**Scholarship master**: kept fully separate from `ScholarshipApplication` (the
per-student transaction, built this phase too) — one master row referenced by many
ScholarshipApplication rows via FK, never copied per applicant. Ties to a University
and/or a Program (both nullable FKs — "program/university"). Duplicate prevention on
(provider, name, university, program).

**University Choice**: student/program/Reach-Match-Safety tier/rationale/status/owner/
review-information all present. Deliberately NOT stored on University/Program master
("Không đưa Reach/Match/Safety vào University hoặc Program master"). `caseId` stays
nullable — School Selection may start before a Case formally exists, matching the
instruction file's own field list (no Case named); scope resolves via whichever FK is set
(`assertCaseAccessible`/`assertStudentAccessible`, no new scope map — `docs/ASSUMPTIONS.md`
ASM-28). One choice per (student, program); a dedicated `review` action stamps
`reviewedById`/`reviewedAt` without touching tier/status.

**Application**: links Student + Case (now required, tightened from Phase 02's nullable
shape — see DEC-05) + University (via Program) + Program. Never creates a Student/Case —
`studentId` is derived from the Case, never a separately client-supplied field that could
disagree with it. Workflow FSM (Planning→Preparing→Ready for Review→Submitted→{Offer,
Waitlist,Reject}→Withdrawn) fully server-side (`ApplicationsService`); `SUBMITTED` reachable
only via a dedicated `submit` action (checklist precondition), `OFFER` reachable only via
creating a real Offer record — never a bare status PATCH for either.

**Application checklist**: title/required/owner/deadline/status/document/notes all
present, one row per item, real FK into the Document subsystem (`documentId`) — no
separate ApplicationFile/storage model. Mandatory-item completion (`required=true AND
status NOT IN (DONE,WAIVED)`) checked server-side before SUBMITTED, `409
CHECKLIST_INCOMPLETE` otherwise.

**Duplicate application**: "Prevent duplicate active applications... unless business rule
explicitly allows it" enforced at the service layer
(`ApplicationsService.assertNoActiveDuplicate`) on `(studentId, programId,
intendedIntake)`, scoped to non-terminal statuses only — a genuine reapplication after
REJECT/WITHDRAWN creates a brand-new row with its own history, never overwriting the
prior one. This required relaxing Phase 02's original DB-level `@@unique([studentId,
programId])`, a real conflict between an already-PASSed schema decision and this phase's
explicit instruction — recorded as `docs/DECISIONS.md` DEC-05, not silently resolved.

**Offer**: type/date/acceptance-deadline/deposit/conditions/status/evidence all present.
Belongs to exactly one Application; an Application may carry multiple Offer rows over time
(a revised/renegotiated offer is a NEW row, never overwriting history). "Current offer" is
a computed read (ACCEPTED first, else most recent non-expired RECEIVED —
`OffersService.getCurrent`), not a stored flag. A RECEIVED offer past its
`acceptanceDeadline` is lazily synced to EXPIRED on read, mirroring `Payment.status`'s
OVERDUE sweep. Accept/decline is a dedicated `respond` action, RECEIVED-only, idempotent
against a second response (`409`).

**Scholarship application**: kept fully separate from ScholarshipMaster; links
Student+Case+ScholarshipMaster, optionally Application (FK only, never copying
program/university data onto the row). Eligibility/deadline/documents/essay/interview/
result/award/conditions all present. No exact status list was given by the instruction
file (only a field list) — a minimal FSM (Planning→Submitted→UnderReview→Interview→
{Awarded,Rejected}→Withdrawn) was designed and documented as an assumption where the
instruction was silent. "Kiểm tra eligibility trước các bước yêu cầu" — SUBMITTED blocked
(`409 ELIGIBILITY_NOT_CONFIRMED`) until a dedicated `confirm-eligibility` action runs.
"Essay" reuses the Phase 07 Writing subsystem (`essayArtifactId` → WritingArtifact,
`type: "Scholarship Essay"`) instead of a duplicate content field; "documents" reuses
`Document`'s pre-existing polymorphic `ownerEntity`/`ownerId` — neither required a new
entity (`docs/ASSUMPTIONS.md` ASM-29).

**Scholarship result**: AWARDED/REJECTED reachable only via their own dedicated actions
(`award`/`reject`), never the generic status PATCH, since a real award carries required
extra data. `award` records amount/currency/coverage/period/acceptance-deadline/evidence
together, atomically. Deliberately never linked to Contract/Payment/CommissionTransaction —
no shared FK/column anywhere — "Không trộn: scholarship amount / student contract fee /
tuition payment / partner commission."

**Application ↔ Offer ↔ Scholarship**: relationships designed with real FKs throughout
(never copied program/university/student data); a Student can have many UniversityChoice/
Application/Offer/ScholarshipApplication rows, never a duplicate Student/University/
Program/ScholarshipMaster.

**Task integration**: Phase 06's own instruction file (`06-operations/01_TASK.md`) named
"application"/"scholarship" as auto-generation triggers, deliberately deferred in Phase 06
(ASM-16) since neither entity existed yet. This phase extends `TaskTemplateTrigger` with
exactly two new values — `APPLICATION_SUBMITTED` (fires once at Application→SUBMITTED) and
`SCHOLARSHIP_AWARDED` (fires once at ScholarshipApplication→AWARDED) — mirroring the
"significant milestone, not every transition" scoping already used for
`CONTRACT_ACTIVATED`/`ROADMAP_APPROVED`, reusing `TaskGenerationService.generateForEvent`
unchanged (same `(templateId, sourceEntityType, sourceEntityId)` idempotency guarantee, no
new dedup logic, no new Task entity).

**Notification integration**: the same two trigger points additionally notify every
current CaseMember (in-app + email, `notifyBothChannels`) with minimal, non-sensitive
payloads (reference ids only, never award amounts/tuition/deposit figures). Deadline-based
reminder cadences for Application/ScholarshipApplication were not built — no
08-admission instruction file asks for one (unlike Task/Payment's explicit 30/14/7/3/1-day
requirement).

**Document integration**: every evidence field (`Application.evidenceDocumentId`,
`ApplicationChecklist.documentId`, `Offer.evidenceDocumentId`,
`ScholarshipApplication.evidenceDocumentId`) is a real FK into the existing Document
subsystem — no ApplicationFile/OfferFile/ScholarshipFile model. Setting one calls
`DocumentsService.grantCaseAccess` immediately after, the identical Phase 07 pattern —
grant-based, download-gated, never a public URL.

**RBAC/scope**: master data (`admission_master`) is GLOBAL, permission-only. School
Selection/Application/Offer/ScholarshipApplication reuse the existing Student/Case
`ROLE_SCOPE` (`assertCaseAccessible`/`assertStudentAccessible`, no new scope map — ASM-20
precedent extended). Five new grouped permission resources (`admission_master`,
`university_choices`, `applications` — covers ApplicationChecklist too,
`offers`, `scholarship_applications`) mirroring each instruction file's own entity
grouping. CONSULTANT gets `admission_master:view` only (curation is ED/DM-only — "Consultant
có thể sử dụng Program nhưng không nhất thiết được chỉnh tuition") but full
`view/create/edit` on the four transaction resources (its counseling-execution domain).
DOCUMENT_SPECIALIST gets full `view/create/edit` on `applications` only (its actual
document-processing domain) and `view` on the rest — "không mặc nhiên có quyền tài chính
hoặc counseling nội bộ." SALES_MARKETING gets `admission_master:view` only (public catalog
data, not student-linked) and zero on the four transaction resources — "không mặc nhiên
được xem application/visa-sensitive data." STUDENT_PARENT is view-only across all five, own
case only — no self-service accept/decline/confirm in this phase. ADMIN_FINANCE/
SYSTEM_ADMIN get zero grant, consistent with their Phase 07 treatment.

**Field-level security**: `ScholarshipApplication.internalNotes` (staff-only
strategy/interview commentary) is redacted from STUDENT_PARENT
(`FieldPolicyService.redactScholarshipApplication`), same pattern as LOR's
`internalNotes`. Program tuition, Offer deposit, and ScholarshipApplication award amounts
are deliberately NOT subject to Contract/Payment-style redaction — those are third-party/
catalog figures a university or provider publishes itself, not the agency's own
commercial terms (`docs/ASSUMPTIONS.md` ASM-32). No university-portal-login credential
storage was built at all — no instruction file asks for one, so the correct response was
not building the feature, not a "safe" workaround (`docs/ASSUMPTIONS.md` ASM-27).

**No production defect found this phase** — the one architecture-level issue this phase's
own design work surfaced (Phase 02's `Application` unique constraint conflicting with this
phase's explicit reapplication requirement) is a genuine requirements conflict between an
already-PASSed schema decision and new instruction text, not a bug in previously-shipped
code — recorded as `docs/DECISIONS.md` DEC-05, following the same "found and fixed,
documented, not silently resolved" standard as DEC-03/DEC-04.

## files read
- `08-admission/01_MASTER_DATA.md`, `08-admission/02_APPLICATION.md`,
  `08-admission/03_OFFER_SCHOLARSHIP.md`
- Phase 01-07 documentation/checkpoints already in this session's context:
  `docs/architecture/{DOMAIN_MAP,TARGET_ARCHITECTURE}.md`, `docs/database/{ERD,
  DATA_DICTIONARY}.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,
  RBAC_MATRIX}.md`, `docs/phase-status/{01-discovery,PHASE_02...PHASE_07}.md`,
  `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PHASE_MAP.md`,
  `database/schema.prisma`, `apps/api/src/**` (existing code, especially the Phase 07
  Counseling/Documents modules and Phase 06 Task/Notification engines as direct reuse
  targets)

## files created/updated
Database: `database/schema.prisma` (`University` +campus/ownerId/source; `Program`
+requirements/source; `ScholarshipMaster` +universityId/percentage/source; new
`UniversityChoiceTier`/`UniversityChoiceStatus` enums + `UniversityChoice`; `Application`
+intendedIntake/submissionChannel/submissionReference/evidenceDocumentId, `caseId` tightened
to required, `@@unique([studentId,programId])` relaxed to a plain index; new
`ChecklistItemStatus` enum + `ApplicationChecklist`; new `OfferStatus` enum + `Offer`; new
`ScholarshipApplicationStatus` enum + `ScholarshipApplication`; `TaskTemplateTrigger`
+APPLICATION_SUBMITTED/SCHOLARSHIP_AWARDED; `Document`/`Student`/`Case`/`WritingArtifact`
back-relations), 2 new migrations
(`20260819063747_admission_master_application_offer_scholarship_phase08`,
`20260819064205_scholarship_application_case_required_phase08` — the second a same-phase
correction before any dependent code was written, not a rewrite of already-shipped work),
`database/seeds/seed.ts` (16 new permission rows + per-role grants for `admission_master`/
`university_choices`/`applications`/`offers`/`scholarship_applications`; Admission
fixtures — universityA, programA, scholarshipMasterA, one UniversityChoice, applicationA
(SUBMITTED) + one ApplicationChecklist item + one Offer (RECEIVED), one
ScholarshipApplication (UNDER_REVIEW, internalNotes set)).

API (`apps/api/src/modules/admission/`, new domain):
- `admission.module.ts`
- `master-data/{dto,universities.service,programs.service,scholarship-masters.service,
  master-data.controller,master-data.module}.ts`
- `university-choices/{dto,university-choices.service,university-choices.controller,
  university-choices.module}.ts`
- `applications/{dto,applications.service,application-checklist.service,
  applications.controller,applications.module}.ts`
- `offers/{dto,offers.service,offers.controller,offers.module}.ts`
- `scholarship-applications/{dto,scholarship-applications.service,
  scholarship-applications.controller,scholarship-applications.module}.ts`
- `modules/identity/rbac/field-policy.service.ts` (+ `redactScholarshipApplication`)
- `modules/case-management/tasks/dto/create-task-template.dto.ts` (`TRIGGER_EVENTS`
  +APPLICATION_SUBMITTED/SCHOLARSHIP_AWARDED)
- `app.module.ts` (registers AdmissionModule)

Tests (`apps/api/test/`): `admission-master-data.e2e-spec.ts` (19 tests),
`admission-application.e2e-spec.ts` (24 tests), `admission-offer-scholarship.e2e-spec.ts`
(21 tests) — 64 new e2e tests total. `assessment-roadmap.e2e-spec.ts` (Phase 07) also
touched — no assertions changed, only additive `afterAll` teardown added; see KNOWN
ISSUES below for why.

Docs: `docs/security/RBAC_MATRIX.md` (5 new permission columns, VERIFY action row, EDIT/
CREATE row updates, field-level protection row, record-scope notes, Phase 08 fixture
description, section 7 deferral updates), `docs/database/{ERD,DATA_DICTIONARY}.md`
(Admission domain fully expanded, table reference renumbered 4.11→4.19),
`docs/api/API_CONVENTIONS.md` (section 11 — all new Phase 08 endpoints),
`docs/ASSUMPTIONS.md` (ASM-26 through ASM-32), `docs/DECISIONS.md` (DEC-05), this file.

## UNIVERSITY MASTER
Name/country/city/campus/website/admissions-URL/status/owner/source/last_verified_at all
present. Verified directly: duplicate (name, country) rejected `409`; invalid ISO country
code rejected `400`; `verify` action stamps `lastVerifiedAt` only and requires its own
`admission_master:verify` permission (CONSULTANT gets `403`).

## PROGRAM MASTER
University/degree/major/duration/intake/tuition/fee/eligibility/requirements/source all
present, real FK to University (never a duplicated name). Verified directly: creating a
Program against a non-existent University `404`s; duplicate (university, degree, major,
intake) rejected `409`; invalid ISO4217 tuition currency rejected `400`; list filters by
`universityId`.

## SCHOLARSHIP MASTER
Provider/name/university-or-program/eligibility/coverage/amount-or-percentage/currency/
deadline/requirements/conditions/source all present, kept structurally separate from
ScholarshipApplication. Verified directly: duplicate (provider, name, university, program)
rejected `409`.

## UNIVERSITY CHOICE
Student/program/Reach-Match-Safety/rationale/status/owner/review-information all present.
Verified directly: not stored on University/Program master; duplicate (student, program)
rejected `409`; a `review` action stamps reviewer info without touching tier/status;
STUDENT_PARENT can view but not create (`403`).

## APPLICATION
Student/Case/University(via Program)/Program all linked, never creates a Student/Case.
Verified directly: `studentId` always matches the parent Case's student; DOCUMENT_SPECIALIST
has full view/create/edit (its document-processing domain); ADMIN_FINANCE has zero grant.

## APPLICATION WORKFLOW
Planning→Preparing→Ready for Review→Submitted→{Offer,Waitlist,Reject}→Withdrawn, fully
server-side. Verified directly: an illegal Planning→Submitted jump is rejected `400`
(SUBMITTED excluded from the generic transition DTO); SUBMITTED reachable only via the
dedicated `submit` action, blocked by an incomplete mandatory checklist (`409
CHECKLIST_INCOMPLETE`); OFFER reachable only via `POST .../offers`, never the generic
status PATCH (`400`); WITHDRAWN freezes further generic edits (`409
APPLICATION_WITHDRAWN`).

## APPLICATION CHECKLIST
Title/required/owner/deadline/status/document/notes all present, real FK into Document.
Verified directly: a WAIVED required item satisfies the submission gate the same as DONE;
linking a Document to a checklist item grants case-member/student access.

## DUPLICATE APPLICATION
Verified directly: a second active application for the same (student, program, intake) is
rejected `409 ACTIVE_APPLICATION_EXISTS`; a genuine reapplication after WITHDRAWN succeeds
as a brand-new row (the withdrawn row's own history untouched); a different intended
intake for the same (student, program) is not treated as a duplicate.

## OFFER
Type/date/acceptance-deadline/deposit/conditions/status/evidence all present. Verified
directly: creating an Offer before SUBMITTED is rejected `409
OFFER_REQUIRES_SUBMITTED_APPLICATION`; creating one transitions the parent Application to
OFFER; multiple offers on one Application coexist without overwriting each other's history.

## OFFER LIFECYCLE
Verified directly: accepting sets ACCEPTED + `respondedAt`, a second response is rejected
`409`; the "current offer" rule prefers ACCEPTED over merely RECEIVED; a RECEIVED offer
past its `acceptanceDeadline` is lazily marked EXPIRED on read.

## SCHOLARSHIP APPLICATION
Kept structurally separate from ScholarshipMaster (real FK, never copied program/
university data onto the row). Verified directly: `GET` response has no `universityName`/
`programName` field, only `scholarshipMasterId`.

## SCHOLARSHIP ELIGIBILITY
Verified directly: SUBMITTED is blocked (`409 ELIGIBILITY_NOT_CONFIRMED`) until
`confirm-eligibility` runs; an illegal status jump (e.g. straight to INTERVIEW) is
rejected `409`.

## SCHOLARSHIP RESULT
Verified directly: `award` records amount/currency/coverage/period/acceptance-deadline
together and is reachable only via its own dedicated action (a direct `status: AWARDED`
PATCH is rejected `400`); the awarded response carries no `contractId`/`paymentId` field;
a REJECTED application cannot be edited further (`409`).

## APPLICATION ↔ OFFER ↔ SCHOLARSHIP
Relationship design verified via the fixture graph and fresh-entity tests: one Student
carries multiple UniversityChoice/Application/Offer/ScholarshipApplication rows; no
duplicate Student/University/Program/ScholarshipMaster created anywhere across the whole
test suite.

## DOCUMENT INTEGRATION
Every evidence field verified to grant case-member/student access on link (via
`DocumentsService.grantCaseAccess`) and to gate download (`404` for a non-granted user,
never a public URL — no `fileUrl` field ever present in a response body).

## TASK INTEGRATION
`APPLICATION_SUBMITTED`/`SCHOLARSHIP_AWARDED` verified idempotent — repeat-fire (an
Application submitted once, a ScholarshipApplication awarded once) produces exactly one
generated task per active template, matching `(templateId, sourceEntityId)`, with the
template deactivated in a `finally` block after each test to avoid leaking into other
suites (the exact class of test-fixture-hygiene bug Phase 06 documented and fixed for
itself).

## NOTIFICATION INTEGRATION
Verified directly: `APPLICATION_SUBMITTED` notifies every current CaseMember on both
channels (IN_APP + EMAIL, ≥2 notification rows per submission); payload never carries
award/tuition/deposit amounts.

## RBAC / AUTHORIZATION
Every Phase 08 entity's scope check reuses `assertCaseAccessible`/`assertStudentAccessible`
(ASM-20/ASM-28) — verified with the same cross-case DENY pattern established in Phase
03-07: a Consultant not on the Case's member list gets `404`, not `403`, on every route.
Master-data-vs-transaction permission separation (CONSULTANT view-only on
`admission_master`, full CRUD on the four transaction resources) verified directly.

## FIELD-LEVEL SECURITY
`FieldPolicyService.redactScholarshipApplication` — new, verified live on every
`scholarship-applications` response for STUDENT_PARENT (`internalNotes` null,
non-sensitive fields like `scholarshipApplicationCode` still visible).

## AUDIT
Every mutating Phase 08 route is `@Audit`-decorated (CREATE/EDIT/VIEW as appropriate);
verified directly for `GET /applications/:id` and `GET /scholarship-applications/:id`.

## DATABASE CHANGES
2 new migrations on top of Phase 01-07's 11: additive only (`ADD COLUMN`/`CREATE TABLE`/
`CREATE TYPE`/`ALTER TYPE ... ADD VALUE`/`CREATE INDEX`), confirmed by inspecting the
generated SQL (`prisma migrate diff`) before applying each. The one non-additive statement
across both — `DROP INDEX applications_student_id_program_id_key` (replacing Phase 02's
hard unique constraint with a plain index) — is the deliberate, documented DEC-05 fix, not
an accidental drop; confirmed zero `applications` rows existed at migration time before
applying (no data loss possible). No entity renamed, merged, or duplicated.

## MIGRATIONS
1. `20260819063747_admission_master_application_offer_scholarship_phase08` —
   `UniversityChoiceTier`/`UniversityChoiceStatus`/`ChecklistItemStatus`/`OfferStatus`/
   `ScholarshipApplicationStatus` enums, `TaskTemplateTrigger`
   `+APPLICATION_SUBMITTED`/`+SCHOLARSHIP_AWARDED`, `applications.case_id` tightened to
   NOT NULL + `intended_intake`/`submission_channel`/`submission_reference`/
   `evidence_document_id` columns, `programs.requirements`/`source`,
   `scholarship_masters.percentage`/`source`/`university_id`,
   `universities.campus`/`owner_id`/`source`, new `university_choices`,
   `application_checklist_items`, `offers`, `scholarship_applications` tables.
2. `20260819064205_scholarship_application_case_required_phase08` — a same-phase
   correction, applied before any service code depended on the nullable shape: tightens
   `scholarship_applications.case_id` to NOT NULL per ASM-28's linkage requirement.

Applied via `prisma migrate diff` (script) + a hand-created migration folder +
`prisma migrate deploy`, the same non-interactive pattern established in Phase 02-07.

## API CHANGES
See `docs/api/API_CONVENTIONS.md` section 11 for the full list. Summary: 15 new
`/universities*`/`/programs*`/`/scholarship-masters*` routes, 5 new
`/students/:studentId/university-choices*`/`/university-choices*` routes, 7 new
`/applications*` routes, 3 new checklist routes, 5 new `/offers*` routes, 7 new
`/scholarship-applications*` routes — 42 new routes total.

## UI CHANGES
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged this phase). Every workflow named in 08-admission/01-03
(University/Program/Scholarship master browsing, University Choice/shortlist,
Application list/detail, Checklist, Offer tracking + "comparison/decision UI," Scholarship
tracking) is satisfied as an API capability a future UI would call, consistent with the
same reasoning applied in Phase 03-07 — the Offer "comparison/decision UI" specifically is
the `GET /applications/:id/offers` (full history) + `GET .../offers/current` (the
computed active one) pair a frontend would render side-by-side.

## TESTS
- Unit: 0 new spec files this phase — 161/161 total (unchanged from end of Phase 07).
  `UniversitiesService`/`ProgramsService`/`ScholarshipMastersService`/
  `UniversityChoicesService`/`ApplicationsService`/`ApplicationChecklistService`/
  `OffersService`/`ScholarshipApplicationsService`'s business logic (duplicate detection,
  FSM transitions, eligibility gate, task/notification integration) is covered by e2e, not
  a separate mocked-Prisma unit spec — consistent with the established codebase
  convention (only the stateless RBAC-policy layer, `FieldPolicyService`, gets unit specs,
  and its `redactScholarshipApplication` addition follows the same e2e-only precedent
  already set for `redactLor` in Phase 07).
- Integration/e2e: 3 new suites (`admission-master-data.e2e-spec.ts` 19 tests,
  `admission-application.e2e-spec.ts` 24 tests, `admission-offer-scholarship.e2e-spec.ts`
  21 tests) — 295/295 total across all 16 suites (up from 231), full suite run clean
  twice consecutively for repeatability.

## REGRESSION RESULTS
Phase 01-07 full prior suite (161 unit + 231 e2e: auth/RBAC/field-level/audit,
Lead/Student/Case/CaseMember/cross-case-isolation/duplicate-detection, Contract
workflow/Amendment/Payment/partial-payment/refund/waive/overdue/idempotency, Task
workflow/dependency/generation/overdue, Notification fan-out/dedup/recipient-scoping,
Assessment/Roadmap/Milestone versioning+approval+dependency, Profile Evidence
history/attempts/evidence-linkage, Writing versioning/review/LOR redaction) still passes
unmodified, run as part of the same full-suite executions below (161/295 totals include
every Phase 01-07 test unchanged).

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate deploy` applied cleanly (both migrations); schema
  additive except the one documented DEC-05 constraint relaxation, confirmed via the
  generated SQL before applying.
- **Seed**: PASS — `npm run db:seed` completes, verified idempotent (run twice
  consecutively, no error/duplication); grant/prune verified (5 new resources correctly
  scoped per role, including CONSULTANT-master-view-only, DOCUMENT_SPECIALIST-
  applications-only, SALES_MARKETING-catalog-view-only, STUDENT_PARENT-view-only).
- **Unit Tests**: PASS — 161/161.
- **Integration Tests**: PASS — 295/295 (this project's tooling doesn't separate
  "integration" from "e2e" — see `docs/PROJECT_STRUCTURE.md`).
- **E2E Tests**: PASS — 295/295, 16 suites, verified stable across two consecutive runs.
- **Master Data Tests**: PASS — University/Program/ScholarshipMaster CRUD, verify action,
  currency/country-code validation.
- **Duplicate Tests**: PASS — University (name+country), Program (university+degree+
  major+intake), ScholarshipMaster (provider+name+university+program), UniversityChoice
  (student+program), Application (student+program+intake, active-only per DEC-05).
- **University/Program relationship Tests**: PASS — Program requires a real University;
  no duplicate Program created just because multiple Applications reference it.
- **Scholarship master/application separation Tests**: PASS — one master row referenced
  by an application via FK, never copied; the two entities' fields never conflated.
- **UniversityChoice Tests**: PASS — tier/rationale/status/review all verified; not
  leaking into University/Program master.
- **Application Workflow Tests**: PASS — full FSM walk, illegal-jump rejection,
  SUBMITTED/OFFER's dedicated-action-only reachability, WITHDRAWN immutability.
- **Application Checklist Tests**: PASS — mandatory-item gate, WAIVED-satisfies-gate,
  Document linkage.
- **Duplicate Application Tests**: PASS — see Duplicate Tests above; reapplication-after-
  WITHDRAWN and different-intake-is-not-duplicate both verified.
- **Submission Tests**: PASS — submission fields (channel/reference/evidence) recorded
  together, atomically, on the READY_FOR_REVIEW→SUBMITTED transition.
- **Offer Tests**: PASS — creation precondition, multiple-offers-no-overwrite, respond
  idempotency.
- **Offer Lifecycle Tests**: PASS — accept/decline, current-offer computation, lazy
  expiry sweep.
- **Scholarship Eligibility Tests**: PASS — see above.
- **Scholarship Application Tests**: PASS — separation from master, essay reuse (Writing
  subsystem), documents reuse (Document polymorphism), illegal-transition rejection.
- **Scholarship Result Tests**: PASS — award-action-only AWARDED reachability, full field
  set recorded, no Contract/Payment linkage, REJECTED immutability.
- **Document Permission Tests**: PASS — grant propagation on every Phase 08 evidence link,
  download gated, cross-case denial, no public URL.
- **Task Integration Tests**: PASS — both new triggers idempotent.
- **Notification Integration Tests**: PASS — fan-out verified, payload minimality
  verified.
- **Cross-Case Tests**: PASS — every Phase 08 entity denies (404) a Consultant/user not on
  the target Case, across all read and write routes.
- **Field-Level Authorization Tests**: PASS — `internalNotes` redacted for STUDENT_PARENT,
  real values for staff roles.
- **Audit Tests**: PASS — CREATE/EDIT/VIEW rows verified for representative mutations.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock, unchanged from Phase 03-07).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.
- **Regression (Phase 01-07)**: PASS — see REGRESSION RESULTS above.

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
7 new (ASM-26 through ASM-32), full text in `docs/ASSUMPTIONS.md`:
- **ASM-26**: Master-data business-ID formats invented (`UNI`/`PRG`/`SCHM`, master context
  silent); Offer/UniversityChoice/ApplicationChecklist get no business code (plain UUID,
  sub-record precedent).
- **ASM-27**: `ownerId` fields are FK-less plain string pointers (RoadmapMilestone
  precedent); no university-portal-credential storage was built (not requested, not
  worked around).
- **ASM-28**: `UniversityChoice.caseId` stays nullable (School Selection may predate a
  Case); `ScholarshipApplication.caseId` is required (explicit cross-cutting linkage
  requirement).
- **ASM-29**: `ApplicationChecklist` stays Application-only, not polymorphic;
  ScholarshipApplication's "documents"/"essay" reuse Document's existing polymorphism and
  the Phase 07 Writing subsystem instead of duplicating either concept.
- **ASM-30**: Task/Notification trigger extension — `APPLICATION_SUBMITTED`/
  `SCHOLARSHIP_AWARDED` fire at the significant milestone, not every status change,
  mirroring `CONTRACT_ACTIVATED`/`ROADMAP_APPROVED`.
- **ASM-31**: Phase 08 RBAC grant matrix — master-data curation separated from
  case-scoped transaction permissions.
- **ASM-32**: Program tuition / Offer deposit / Scholarship award amounts are NOT subject
  to Contract/Payment-style redaction — third-party/catalog money, not the agency's own
  commercial terms.

1 new architecture/decision record in `docs/DECISIONS.md`:
- **DEC-05**: Application's Phase 02 `@@unique([studentId, programId])` relaxed to a
  service-layer "at most one active" check — a genuine requirements conflict between an
  already-PASSed schema decision and this phase's explicit reapplication requirement,
  found and fixed at the schema level, not silently resolved as an assumption. Zero
  `applications` rows existed at migration time (confirmed) — no data loss possible.

## RISKS
- `ApplicationsService.assertNoActiveDuplicate`'s service-layer check (replacing a DB
  constraint) is, like every service-layer uniqueness rule in this codebase (Case's
  at-most-one-active, University/Program/ScholarshipMaster's duplicate checks), subject to
  a narrow TOCTOU race under concurrent requests that a DB unique index would have closed
  automatically — accepted as consistent with the codebase's existing precedent (Case
  itself has carried the identical class of risk since Phase 04) rather than solved with a
  partial/conditional unique index this phase didn't build.
- `ScholarshipApplicationStatus`'s FSM was designed, not specified — a future phase
  revisiting scholarship workflow should treat it as a documented assumption
  (`docs/ASSUMPTIONS.md` ASM-29's status-list note), not a fixed requirement, if a more
  detailed workflow is later specified.
- Program tuition/application fee sharing one currency column
  (`tuitionCurrency`, no separate `applicationFeeCurrency`) is a Phase 02 shape kept
  as-is; if a future university genuinely charges its application fee in a different
  currency than tuition, this will need a real schema change, not just a new assumption.

## KNOWN ISSUES
- **Fixed during this phase's own test development, not left outstanding**: while
  iteratively writing this phase's own e2e tests (which, like the pre-existing Phase 07
  `assessment-roadmap.e2e-spec.ts`, call `createCaseForConsultant()` to add
  `demo.consultant.a` as a fresh Case's OWNER member), `demo.consultant.a`'s accumulated
  case-membership count exceeded `apps/api/test/rbac.e2e-spec.ts`'s `limit: 100` twice
  during development, breaking that unrelated (Phase 03) test — root cause: none of the
  three files calling this helper ever cleaned up the CaseMember rows it created, and this
  dev database is never reset between suite runs, so the count grows by ~35-40 every full
  e2e run. Root-caused via direct row-count query (not guessed). Fixed at the source, not
  worked around: `admission-application.e2e-spec.ts`, `admission-offer-scholarship.
  e2e-spec.ts` (this phase), and `assessment-roadmap.e2e-spec.ts` (Phase 07 — touched here
  because the same leak lived there too, a compelling, concrete technical reason per this
  project's own "don't rewrite already-PASSed work" rule) now track every case they create
  via the helper and delete `demo.consultant.a`'s membership on those specific cases in
  `afterAll` — additive teardown only, no assertion in any file was changed. Verified
  directly: `demo.consultant.a`'s membership count returns to exactly 1 (the seed fixture)
  after a full e2e run, instead of accumulating. The two `prisma migrate reset`s performed
  while diagnosing this (against the verified local dev-only Postgres container, with the
  user's informed, conditional consent obtained and re-verified each time) cleared the
  pollution already accumulated before the fix landed; they are not the fix itself. Full
  regression re-confirmed green twice consecutively after the fix, with the leak
  confirmed closed.
- Two Windows-environment blockers were hit and resolved mid-phase, unrelated to any
  code: Docker Desktop had stopped between turns (relaunched); the dev Postgres
  container's host port (55432) fell into a Hyper-V/WSL2 dynamic-port-exclusion range
  after a Desktop restart, requiring an elevated `net stop winnat && net start winnat`
  (performed by the user, outside this agent's privilege level) before the container could
  bind the port again. Documented here since a future session on this same machine may
  hit the identical port issue after any Docker Desktop restart.
- A Windows-specific `jest-worker` teardown flake (`Error: kill EPERM` during forced
  worker exit, or the benign "A worker process has failed to exit gracefully" warning),
  identical to the one already documented in Phase 06/07's Known Issues — observed
  intermittently again this phase; when it doesn't occur, all 295 tests pass consistently.
  Not a Phase 08 regression.
- Carried over from Phase 02-07, still accurate and unaffected by this phase: the
  `deepmerge-ts` dev-only `npm audit` advisories, the `eslint-visitor-keys` `EBADENGINE`
  warning, and the `otplib` 12.0.1 pin.

## next dependency (for Phase 09)
- `AdmissionOutcomeService`-equivalent hook: Phase 09 (Visa) needs to know "đã chọn nơi
  nhập học" — an accepted Offer / awarded Scholarship on a given Case — per
  `docs/architecture/DOMAIN_MAP.md` domain 5's own stated expose-point
  ("AdmissionOutcomeService dùng bởi visa"). This phase did not build that service (no
  Visa consumer exists yet to call it) — Phase 09 should add a narrow read-only query
  against `Offer`/`ScholarshipApplication` rather than duplicating admission-outcome
  state onto a new Visa-owned table.
- `TaskTemplateTrigger`/notification event set remain designed to be extended, not
  replaced — Phase 09 adding Visa workflow logic should add new enum values / event
  strings there (as this phase did with `APPLICATION_SUBMITTED`/`SCHOLARSHIP_AWARDED`)
  rather than inventing a parallel mechanism. `visa appointment`/`document request`
  notification events and the `visa` Task trigger remain the last three named-but-deferred
  items from Phase 06's own instruction files.
- `docs/security/RBAC_MATRIX.md` section 2's grant table is the pattern to extend for
  whatever resource(s) Phase 09 introduces — follow the same grant-and-prune seed
  discipline (DEC-02), and weigh the same grouped-vs-per-entity resource judgment call
  documented in ASM-21/ASM-31 before defaulting to one resource per entity.
- Real object storage/signed-URL/virus-scan for `Document` (deferred since Phase 07,
  ASM-23) remains Phase 12 — Phase 08's evidence links are ready to point at real files the
  moment that infrastructure exists, no schema change needed then.

READY FOR PHASE 09: YES

Không tự chuyển sang Phase 09. Chờ prompt tiếp theo.
