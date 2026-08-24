# PHASE STATUS — F06 (Visa + Pre-departure + Enrollment + Partner Frontend)

## PHASE F06 STATUS: PASS

## READY FOR F07: YES

## SUMMARY

Built the Visa/Pre-departure/Enrollment/Partner frontend on top of F02–F05's foundation,
API-first against the real backend, reusing every prior primitive (API client, auth, RBAC, App
Shell, Query/cache, `Table`/`Dialog`/`Badge`/`Toast`/`Skeleton`/`Money`/`EvidenceDocumentLink`/
`ReasonDialog`/`DuplicateConflictNotice`/`StudentPicker`/`ProgramPicker`-style patterns)
unchanged. New routes are exactly the F01-mapped set: `/cases/[caseId]/visas`, `/visas/[id]`,
`/visa-checklist-templates`, `/cases/[caseId]/pre-departure`, `/cases/[caseId]/enrollments`,
`/enrollments/[id]`, `/partners`, `/partners/[id]`, `/partners/[partnerId]/commission-rules`,
`/commission-transactions`, `/commission-transactions/[id]` — 11 new routes, 42 total. One
backend fix (DEC-12, mirroring DEC-09/10/11 exactly, applied to four services at once — the
largest single-phase instance of this fix so far).

## VISA

`/cases/[caseId]/visas` (case-scoped list, status filter — no global `/visas` list exists) +
`/visas/[id]` (workspace: Header/Status → Submission → Appointment/Interview → Result →
Checklist → Actions). Full server-side FSM (NOT_STARTED → PREPARING → READY → SUBMITTED →
APPOINTMENT → INTERVIEW → GRANTED/REFUSED, WITHDRAWN from any open state) — the generic status
endpoint covers only `MANUAL_VISA_STATUSES` (NOT_STARTED/PREPARING/READY/WITHDRAWN); SUBMITTED,
APPOINTMENT, and INTERVIEW each go through their own dedicated, data-carrying action instead.
`409 ACTIVE_VISA_EXISTS` (at most one non-terminal Visa per Case) surfaced verbatim via the
shared `DuplicateConflictNotice`. `internalNotes` is redacted (`null`) for STUDENT_PARENT;
`interviewNotes`/`reason` are deliberately never redacted — they're the affected Student/Parent's
own outcome, not staff-internal commentary.

## VISA CHECKLIST

`VisaChecklistItem` — a real, shared Prisma model (see PRE-DEPARTURE below) — rendered as a
section on the Visa detail page. Completion is gated entirely server-side
(`VisasService.assertChecklistComplete`, `409 CHECKLIST_INCOMPLETE`) — re-checked independently
by both the generic status endpoint (targeting READY) and `submit()`; neither dialog
pre-computes eligibility from the loaded checklist, both only submit and reflect the server's own
response. `VisaChecklistTemplate` (GLOBAL master/config data, `/visa-checklist-templates`, no
`verify` action — a real difference from University/Program/ScholarshipMaster) is deliberately
kept structurally separate: matching active templates are instantiated into real
`VisaChecklistItem` rows when a Visa is created, but the template catalog itself is never
directly attached to a Visa.

## VISA RESULT

{SUBMITTED, APPOINTMENT, INTERVIEW} → {GRANTED, REFUSED}, both terminal. Recorded atomically via
`VisaResultDialog` (`result`/`resultDate`/`resultEvidenceDocumentId`/`reason`) — every action
(Sửa, Chuyển trạng thái, Nộp hồ sơ, Đặt lịch hẹn, Ghi nhận phỏng vấn, Ghi nhận kết quả) is hidden
once the Visa reaches a terminal status, confirmed by `VISA_TRANSITIONS[status].length === 0`.

## PRE-DEPARTURE

`/cases/[caseId]/pre-departure` — **not a separate model**: `VisaChecklistItem` is polymorphic
(`entityType: 'Visa' | 'PreDeparture'`), reused verbatim rather than duplicated
(`lib/pre-departure/types.ts`'s `PreDepartureItem` is a plain re-export of `VisaChecklistItem`).
`PreDepartureService.listForCase()` returns a plain array; the workspace page shows a
server-reported per-item progress count ("X/Y hạng mục đã hoàn tất hoặc miễn trừ") computed from
the loaded array, never a client-invented "overall complete" boolean or an overdue calculation
against the client clock. There is no "mark pre-departure complete" action anywhere —
completeness is enforced only at Case Closure (pre-existing F03/F04 `409
PRE_DEPARTURE_CHECKLIST_INCOMPLETE` scope, unchanged this phase). See ASM-69.

## ENROLLMENT

`/cases/[caseId]/enrollments` (list) + `/enrollments/[id]` (detail). Only two dedicated FSM
actions exist — `confirm` (PLANNED → CONFIRMED) and `withdraw` ({PLANNED, CONFIRMED} →
WITHDRAWN, no payload, so a plain confirm-then-mutate action, no dialog) — no generic
status-change endpoint at all. `universityId`/`programId` are derived server-side from the
target Offer's Application at create time (DEC-12's embed is display-only; the create form
collects only `offerId`, never an institution/program picker — see ASM-70). Offer "validity"
(must belong to the Case, must be ACCEPTED) is enforced at Enrollment-create time via `409
INVALID_ENROLLMENT_TARGET`, not a separate pre-check endpoint. `409
CONFIRMED_ENROLLMENT_EXISTS` (at most one CONFIRMED Enrollment per Case) surfaced verbatim with
the real `existingEnrollmentId`.

## PARTNER

`/partners` (list: search + country filter) + `/partners/[id]` (detail: contact info,
Commission Rules link-out, Programs/Documents/StudentLinks sections, Commission Transactions
section). GLOBAL master data, permission-gated only — same treatment as University/Program.
`internalNotes` redacts for **DOCUMENT_SPECIALIST**, a deliberate difference from every other
F04-F06 `internalNotes` redaction (all of which target STUDENT_PARENT) — confirmed directly
against `FieldPolicyService.redactPartner`. `409 DUPLICATE_PARTNER` (case-insensitive `name` +
`countryCode`) surfaced via `DuplicateConflictNotice` with a link to the real conflicting
record.

## PARTNER PROGRAM

No standalone route (F01's route map groups it inside the Partner detail cell, not its own
bracketed row — ASM-67) — create/edit is a Dialog on `/partners/[id]`'s Programs section.
`programId` is an OPTIONAL link into the real core Admission `Program` master via the reused
`ProgramPicker`, never a duplicated University/Program row. `409 DUPLICATE_PARTNER_PROGRAM` on
`(partnerId, name, degreeLevel, major, intake)` surfaced message-only (no link — no detail
route to link to).

## PARTNER DOCUMENT

No standalone route (ASM-67) — sections+Dialogs on `/partners/[id]`. Its own model wrapping a
REQUIRED `documentId` FK into the core Document subsystem (never a direct upload here — reuses
the existing 2-step signed-download flow via `EvidenceDocumentLink`). Editable only while DRAFT
(`409 PARTNER_DOCUMENT_NOT_EDITABLE` otherwise, confirmed by the row hiding Sửa/Kích hoạt once
ACTIVE) — a correction after signing is a whole new version row
(`@@unique([partnerId, type, version])`, auto-incremented), never an in-place edit. `activate`
atomically supersedes the prior ACTIVE row for the same `(partnerId, type)` → SUPERSEDED,
entirely server-decided.

## PARTNER STUDENT LINKS

No standalone route (ASM-67) — a section+Dialog on `/partners/[id]`, plus a read-only
"Đối tác liên kết" card on the Student detail page (`usePartnerStudentLinksForStudent` — the
second of two independent list contexts DEC-12 fixed together, reaching the identical rows as
the Partner-scoped list). A pure junction row (SRS 6.17) — never a duplicated Student/Case/
Application/Partner entity. No hard delete (Hard Rule #5) — archive stamps `endDate`, preserving
history; the archive action is hidden once already ARCHIVED. `409
DUPLICATE_PARTNER_STUDENT_LINK` on a repeat active `(partnerId, studentId, caseId,
applicationId)` tuple surfaced message-only.

## COMMISSION RULES

`/partners/[partnerId]/commission-rules` (list-only route, F01's own bracketed-route entry —
ASM-68; create/edit/activate/deactivate all via Dialogs, no detail route). Config data, never a
fact that happened (that's CommissionTransaction) — deliberately kept separate from
`Payment`/`Contract.value`/`ScholarshipApplication.awardAmount` (SRS 6.17, no shared FK/column
with any of the three, ever). The backend cross-validates `basis` vs
`percentageRate`/`fixedAmount` server-side (400 `FIXED_AMOUNT_REQUIRED`/etc.); the form mirrors
this as UX guidance (hiding the irrelevant field) but never substitutes for the real check.
Rule-matching/precedence (`selectRuleFor`) is 100% backend-internal, never exposed or previewed
client-side.

## COMMISSION TRANSACTIONS

`/commission-transactions` (global list, status filter) + `/commission-transactions/[id]`
(full-FSM workspace) — global-only routes, no partner-nested route despite the backend endpoint
existing (ASM-68); creation for a specific partner happens via a Dialog on the Partner detail
page. Full server-side FSM: PENDING → confirm-eligibility → ELIGIBLE → calculate → CALCULATED →
approve → APPROVED → mark-payable → PAYABLE → pay → PAID (terminal); cancel reachable from any
non-terminal state, also terminal. `409 PARTNER_STUDENT_LINK_REQUIRED` — a real, non-obvious
precondition (commission cannot be attributed to a partner with no active PartnerStudentLink to
the source student) — surfaced verbatim, never pre-checked client-side. `409
INVALID_COMMISSION_TRANSACTION_STATE` uses a prose message, not an `allowedTransitions` array
(a deliberate difference from Visa/Application/ScholarshipApplication, confirmed against the
live service) — rendered as the mapped text with no allowed-list UI. `sourceType`/`sourceId`/
`commissionRuleId`/`studentId`/`caseId`/`applicationId` are all manual UUID inputs on create — no
cross-domain picker exists for these yet, same "manual UUID for a narrow linkage field"
precedent F04/F05 established for evidence fields.

## RBAC

Every action button is gated by `usePermissions().can(resource, action)` against
`lib/permissions/rbac-data.ts` — never a role-name or FSM-state guess. All ten F06 resource
grant sets (`visa`/`visa_checklist_templates`/`pre_departure`/`enrollment`/`partner`/
`partner_programs`/`partner_documents`/`partner_student_links`/`commission_rules`/
`commission_transactions`) already existed in `rbac-data.ts` from F02 and were verified directly
against the live `@RequirePermission` decorators for every controller to match the backend
exactly — **no `rbac-data.ts` change was needed this phase either**. `PartnerStudentLinkFormDialog`
reuses `StudentPicker` directly (no new picker gap).

## FIELD SECURITY

`Visa.internalNotes`/`Enrollment.internalNotes` come back `null` when field-redacted for
STUDENT_PARENT, rendered exactly as returned, never a client workaround. `Partner.internalNotes`
redacts for DOCUMENT_SPECIALIST instead — a genuinely different role from every other F04-F06
redaction, confirmed directly against `field-policy.service.ts`, not assumed by pattern-matching
the other entities. `Visa.interviewNotes`/`Visa.reason` are deliberately NOT redacted (the
affected Student/Parent's own interview/result record, not staff-internal commentary).
PartnerProgram/PartnerDocument/PartnerStudentLink/CommissionRule/CommissionTransaction have
**no** field-level redaction at all, confirmed directly against `field-policy.service.ts`.

## CASE-RECORD SCOPE

Visa/Enrollment both resolve scope through the owning Case (`assertCaseAccessible`);
Pre-departure resolves through the Case directly (`entityId = caseId`, no intermediate Visa
hop). Partner/PartnerProgram/PartnerDocument/CommissionRule/CommissionTransaction are GLOBAL,
permission-gated only — confirmed against the live services, no case-scope check exists for any
of them. PartnerStudentLink is likewise GLOBAL/permission-gated (a pure junction row with
optional `caseId`/`applicationId` linkage fields, never the routing/authorization key) — a
deliberate parallel to F05's ASM-65 finding for UniversityChoice. A 404 on any scoped record —
whether it genuinely doesn't exist or the caller is simply out of scope — renders the exact
required copy ("Không tìm thấy hoặc bạn không có quyền truy cập.") via the shared
`QueryErrorState`, never distinguishing the two cases.

## DOCUMENT INTEGRATION

No new upload/browse UI. `Visa.evidenceDocumentId`/`Visa.resultEvidenceDocumentId`/
`VisaChecklistItem.documentId`/`Enrollment.evidenceDocumentId` are all manual UUID inputs paired
with the existing `EvidenceDocumentLink` component for read-side rendering, redeeming the same
2-step signed-download flow F04 established, never a direct R2/bucket URL. `PartnerDocument`
wraps a REQUIRED `documentId` FK the same way — its own model with type/version/status/
effective/expiry metadata, never literally Document rows, and never a second upload path. F06
does not rebuild any part of the Document subsystem (F07+ scope).

## QUERY / CACHE

`lib/api/query-keys.ts` gained `visas`/`visaChecklistTemplates`/`preDeparture`/`enrollments`/
`partners`/`partnerPrograms`/`partnerDocuments`/`partnerStudentLinks` (with separate
`listForPartner`/`listForStudent` sub-keys for its two independent list contexts)/
`commissionRules`/`commissionTransactions` (with separate `list`/`listForPartner` sub-keys)
namespaces, following the exact same factory pattern F03–F05 established. Every mutation
invalidates precisely the query keys it affects — e.g. confirming an Enrollment invalidates
both its own detail and the parent Case's enrollment list; activating a PartnerDocument
invalidates the Partner's document list (since `activate` also supersedes the prior ACTIVE row
server-side). No server state is duplicated into `useState` anywhere in this phase's code.

## FINANCIAL PRECISION

Every Decimal field across CommissionRule (`percentageRate`/`fixedAmount`)/CommissionTransaction
(`basisAmount`/`rate`/`calculatedAmount`) is typed `string`, never `number`, mirroring the
backend's own `Prisma.Decimal` serialization. `calculate()` performs authoritative
`basisAmount.times(percentageRate).toDecimalPlaces(2, ROUND_HALF_UP)` math **entirely
server-side** — the "Tính toán" action on the CommissionTransaction detail page only calls the
endpoint and renders whatever `calculatedAmount` comes back via the shared `Money` component,
confirmed by a dedicated test asserting no frontend recomputation occurs. `percentageRate` is
displayed as `Number(rate) * 100` purely for presentation (a fraction like `0.1000` → "10%"),
never used as an input to any further money math. Currency mismatches surface the real `409
CURRENCY_MISMATCH` verbatim (the F04-established message generalized this phase to cover both
Payment and CommissionTransaction contexts, since both now share the same error code).

## TESTS

225/225 passing (61 files: 174 carried over from F05 unchanged + 51 new F06 tests across 13 new
test files). Covers Visa list/detail/FSM-actions/checklist/result/redaction, VisaChecklistTemplate
GLOBAL-catalog list/create/duplicate-409, Pre-departure checklist/progress-count/read-only-role,
Enrollment list/detail/confirm/withdraw/terminal-state/redaction, Partner list/detail/create/
sub-sections, PartnerProgram create-via-Dialog, PartnerDocument DRAFT-only-editable/activate/
read-only-viewer, PartnerStudentLink render/archive/terminal-state/read-only-viewer,
CommissionRule list/FIXED-basis-create/activate-deactivate, CommissionTransaction list/detail/
full-FSM/PARTNER_STUDENT_LINK_REQUIRED/pay/cancel/terminal-state/STUDENT_PARENT-zero-visibility,
RBAC hidden-actions/forbidden/404-non-enumeration, and field redaction. Full breakdown:
`FRONTEND_BUILD_STATUS.md`.

## TYPECHECK

PASS — `npm run web:typecheck`, 0 errors.

## LINT

PASS — `npm run web:lint`, 0 errors, 0 warnings.

## BUILD

PASS — `npm run web:build` (Turbopack); all 11 new F06 routes compile alongside every F01–F05
route (42 total).

## BACKEND REGRESSION

PASS. Backend files touched: `enrollments.service.ts`, `partner-programs.service.ts`,
`partner-student-links.service.ts`, `commission-transactions.service.ts` (DEC-12 — each gained
`*_SUMMARY_SELECT` constant(s) + a `*WithRelations` type, added to list/detail paths only,
mirroring DEC-09/10/11 exactly — the largest single-phase instance of this fix so far, four
services at once), `field-policy.service.ts` (`redactEnrollment` made generic over
`T extends Enrollment`, same fix shape as DEC-10's `redactContract`/DEC-11's
`redactScholarshipApplication`), 4 new e2e assertions across
`pre-departure-enrollment-closure.e2e-spec.ts`/`partners.e2e-spec.ts` (×3, covering
PartnerProgram and both of PartnerStudentLink's and CommissionTransaction's two list contexts
each). `api:typecheck` PASS (0 errors), `api:lint` PASS (0 new warnings, same 7 pre-existing
baseline), unit **182/182 PASS** (unchanged from F05 — no unit test touches the four DEC-12
services' list/detail paths directly), targeted e2e (`pre-departure-enrollment-closure`,
`partners`, `visa` suites) **84/84 PASS**, full e2e suite **25 suites, 488/488 tests PASS** (484
baseline + 4 new DEC-12 assertions) run serially (`--runInBand`) against the local Docker
Postgres test database. Docker Desktop was not running at the start of this phase (had to be
started fresh); every test invocation used the same explicit `DATABASE_URL`/`DIRECT_URL`
shell-env-override discipline F04–F05 established — never the git-ignored root `.env`, which
still points at production (see the safety note in `FRONTEND_BUILD_STATUS.md`). The full-suite
run itself took three attempts due to unrelated Windows/environment instability (see RISKS) —
the final, successful run's one incidental failure (`portal.e2e-spec.ts`'s document-download
audit test) re-ran clean in isolation (30/30), confirming background-job timing flakiness, not a
regression (full detail in `FRONTEND_BUILD_STATUS.md`'s Backend regression check — Phase F06
section).

## FILES CREATED

`lib/visas/{types,api,hooks}.ts`, `lib/visa-checklist-templates/{types,api,hooks}.ts`,
`lib/pre-departure/{types,api,hooks}.ts`, `lib/enrollments/{types,api,hooks}.ts`,
`lib/partners/{types,api,hooks}.ts`, `lib/partner-programs/{types,api,hooks}.ts`,
`lib/partner-documents/{types,api,hooks}.ts`, `lib/partner-student-links/{types,api,hooks}.ts`,
`lib/commission-rules/{types,api,hooks}.ts`, `lib/commission-transactions/{types,api,hooks}.ts`,
`components/crm/visa-checklist-templates/visa-checklist-template-form-dialog.tsx`,
`components/crm/visas/{visa-form-dialog,visa-status-dialog,visa-submit-dialog,
visa-appointment-dialog,visa-interview-dialog,visa-result-dialog,visa-checklist-item-dialog,
visa-checklist-item-row}.tsx`,
`components/crm/pre-departure/{pre-departure-item-dialog,pre-departure-item-row}.tsx`,
`components/crm/enrollments/{enrollment-form-dialog,enrollment-confirm-dialog}.tsx`,
`components/crm/partners/partner-form-dialog.tsx`,
`components/crm/partner-programs/{partner-program-form-dialog,partner-program-row}.tsx`,
`components/crm/partner-documents/{partner-document-form-dialog,partner-document-row}.tsx`,
`components/crm/partner-student-links/{partner-student-link-form-dialog,
partner-student-link-row}.tsx`,
`components/crm/commission-rules/commission-rule-form-dialog.tsx`,
`components/crm/commission-transactions/{commission-transaction-create-dialog,
pay-commission-dialog}.tsx`,
`app/(staff)/visa-checklist-templates/page.tsx`, `app/(staff)/partners/page.tsx`,
`app/(staff)/partners/[id]/page.tsx`, `app/(staff)/partners/[partnerId]/commission-rules/page.tsx`,
`app/(staff)/commission-transactions/page.tsx`, `app/(staff)/commission-transactions/[id]/page.tsx`,
`app/(staff)/cases/[caseId]/visas/page.tsx`, `app/(staff)/visas/[id]/page.tsx`,
`app/(staff)/cases/[caseId]/pre-departure/page.tsx`,
`app/(staff)/cases/[caseId]/enrollments/page.tsx`, `app/(staff)/enrollments/[id]/page.tsx`, plus
13 new `*.test.tsx` files (one per route/component listed above that has interactive/
permission-sensitive behavior), and this phase-status file.

## FILES UPDATED

`lib/api/query-keys.ts` (added F06 namespaces), `lib/api/error-messages.ts` (added F06 error
codes, deduplicated 3 codes already defined by F04/F05, generalized `CURRENCY_MISMATCH`'s
Vietnamese text to cover both Payment and CommissionTransaction), `components/crm/status-badge.tsx`
(added Visa/Enrollment/PartnerDocument/PartnerStudentLink/CommissionTransaction variant+label
maps, reusing F05's `MASTER_DATA_STATUS_VARIANT`/`LABEL` and `CHECKLIST_ITEM_STATUS_VARIANT`/
`LABEL` rather than duplicating them), `components/shell/nav-config.ts` (Visa checklist
templates/Đối tác `implemented: true`, added the Giao dịch hoa hồng nav item),
`app/(staff)/cases/[id]/page.tsx` (added the Visa & Nhập học entry-point card),
`app/(staff)/students/[id]/page.tsx` (added the read-only Đối tác liên kết entry-point card),
`apps/api/src/modules/visa/enrollments/enrollments.service.ts`,
`apps/api/src/modules/partners/partner-programs/partner-programs.service.ts`,
`apps/api/src/modules/partners/partner-student-links/partner-student-links.service.ts`,
`apps/api/src/modules/partners/commission-transactions/commission-transactions.service.ts`,
`apps/api/src/modules/identity/rbac/field-policy.service.ts` (the DEC-12 backend fix),
`apps/api/test/{pre-departure-enrollment-closure,partners}.e2e-spec.ts` (DEC-12 regression
tests), `docs/DECISIONS.md` (DEC-12), `docs/ASSUMPTIONS.md` (ASM-67 through ASM-70),
`docs/frontend/{FRONTEND_ROUTES,FRONTEND_API_MAP,FRONTEND_PERMISSION_MAP,
FRONTEND_BUILD_STATUS}.md`.

## ASSUMPTIONS

- PartnerProgram/PartnerDocument/PartnerStudentLink have no standalone routes — F01's route map
  groups them inside the Partner detail cell, not as their own bracketed rows, so all three are
  sections-with-Dialogs on `/partners/[id]` (ASM-67).
- CommissionRule gets its own list-only route (`/partners/[partnerId]/commission-rules`, no
  detail route); CommissionTransaction gets global-only routes, no partner-nested route despite
  the backend endpoint existing — F01's route map genuinely distinguishes Commission's
  bracketed-route syntax from the other three sub-resources' cell-grouping syntax (ASM-68).
- Pre-departure is the identical `VisaChecklistItem` model as Visa's own checklist, never a
  separate PreDeparture type/model on the frontend — matching the live backend over the
  mega-prompt's descriptive "record with a checklist" framing (ASM-69).
- Enrollment's University/Program are always server-derived from the Offer at create time, never
  a client-selectable form field — the DTO structurally has no field to carry one (ASM-70).

## RISKS

- The DEC-12 backend fix touches four services at once (Enrollment/PartnerProgram/
  PartnerStudentLink/CommissionTransaction) — the broadest single-phase surface yet (wider than
  DEC-11's four-services-once precedent only in that PartnerStudentLink required fixing a
  *shared* private helper feeding two independent list contexts at once), though each individual
  change is still the same minimal, additive, list/getById-only shape and is independently
  e2e-covered.
- No live-backend browser smoke test was performed in this environment — same limitation carried
  over from F02–F05 (no reachable running `apps/api` instance here); all coverage is via
  mocked-API component/unit tests plus a clean production build and a fully passing backend
  unit + full e2e suite (see BACKEND REGRESSION above).
- The repository's root `.env` still points at the production Supabase database (unchanged since
  F04/F05) — a standing hazard for a future session that runs `npm run api:test:e2e`/`db:seed`
  without an explicit local-DB override. Docker Desktop was also found not running at the start
  of this phase and had to be started manually before any local-DB test could run.
- The full e2e suite took three attempts to complete cleanly on this sandboxed Windows machine —
  the first crashed on a `jest-worker` `kill EPERM` error (a Windows child-process permission
  issue, not a code defect) that also left zombie `node` processes holding DB connections and
  blocking the second attempt; both were cleaned up before a third, successful run. This is a
  new failure mode not seen in F02–F05's own environmental-flakiness notes (which were all
  `Exceeded timeout` contention, not process-kill crashes) — worth watching for in future phases
  on this same machine.

## KNOWN ISSUES

- `CommissionTransactionCreateDialog`'s `sourceId`/`commissionRuleId`/`partnerProgramId`/
  `studentId`/`caseId`/`applicationId` fields remain manual UUID inputs — no cross-domain picker
  exists yet (F07+ scope, same limitation as every F04/F05/F06 narrow-linkage evidence field).
- `VisaAppointmentDialog`/`VisaInterviewDialog` use `type="datetime-local"` — the first use of
  this input type in the codebase; its exact serialization format was only exercised against
  mocked API calls, not a live backend's `@IsDateString()` validation.
- Reports/Dashboard (`/dashboard`) remains the F01 placeholder — unrelated to this phase's scope.
- Full Student/Parent Portal, full Reporting, and the Document subsystem itself remain untouched
  by design (explicit F06 mega-prompt boundaries — F07+/F08 scope).

## READY FOR F07: YES
