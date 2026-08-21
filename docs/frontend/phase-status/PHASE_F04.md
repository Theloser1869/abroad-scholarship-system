# PHASE STATUS — F04 (Commercial + Profile/Counseling Frontend)

## PHASE F04 STATUS: PASS

## READY FOR F05: YES

## SUMMARY

Built the Commercial (Contract + Payment) and Profile/Counseling (Assessment + Gap Analysis +
Roadmap + Milestones + Profile Evidence + Writing + LOR) frontend on top of F02/F03's
foundation, API-first against the real backend, reusing every F02/F03 primitive (API client,
auth, RBAC, App Shell, Query/cache, `Table`/`Dialog`/`Badge`/`Toast`/`Skeleton` UI primitives)
unchanged. New routes are exactly the F01-mapped set: `/contracts`, `/contracts/[id]`,
`/contracts/[id]/payments`, `/cases/[caseId]/assessments`, `/assessments/[id]`,
`/cases/[caseId]/roadmaps`, `/roadmaps/[id]`, `/cases/[caseId]/profile`,
`/cases/[caseId]/writing-artifacts`, `/writing-artifacts/[id]` — every create/edit/approve/
reject/status-transition/refund/waive workflow is a Dialog launched from a list/detail page,
never a separate route. One backend bug found and minimally fixed (DEC-10, mirroring F03's
DEC-09 exactly).

## CONTRACT

List (`/contracts`): `status` filter only — the backend's `ContractQueryDto` has no `search`
field (confirmed by reading the DTO directly), so none is offered. Detail (`/contracts/[id]`):
full lifecycle UI — Sửa (DRAFT only), Gửi duyệt (submit), Duyệt/Từ chối (REVIEW, ED/DM-gated
+ `APPROVAL_THRESHOLD_EXCEEDED` surfaced verbatim with the real threshold, never pre-checked
client-side), Gửi khách hàng (send — shows the one-time review token exactly once, never
re-fetchable), Ký hợp đồng (sign — irreversible, explicit warning), Chuyển trạng thái (the 4
linear post-sign moves ACTIVE→COMPLETED→LIQUIDATED→ARCHIVED only), + Amendment (the only path
to change terms after signing — reason + effective date required, backend rejects a no-op with
`409 NO_MATERIAL_CHANGE`). Amendment history rendered as a list of diff records
(`before`/`after`), never a full document snapshot — Contract vs. Amendment are kept visually
and structurally distinct per the phase instruction. Money (`value`/`approvalThreshold`)
rendered via a shared `formatMoney` helper that only ever formats the backend's own Decimal
string for display, never recalculates it.

## PAYMENT

Installments (`/contracts/[id]/payments`): `status`/`overdue` filters (matching the real
`PaymentQueryDto`), server-computed `outstandingAmount`/`isOverdue` rendered exactly as
returned — never recalculated client-side. Payment detail/record/refund/waive is a Dialog
opened from a row click (no standalone `/payments/[id]` route exists in F01's route map).
Recording a payment mirrors F03's `LeadConvertDialog` conflict-resubmit pattern: a first
attempt without `allowOverpayment` that gets `409 OVERPAYMENT_NOT_ALLOWED
{ outstandingBeforePayment }` re-renders with that exact figure and an explicit confirm step —
never client-pre-decided. Refund/Waive both require an explicit reason and a distinct confirm
step; Refund is offered even on a terminal (LIQUIDATED/ARCHIVED) contract, matching the
backend's actual behavior (`PaymentsService.refund` has no contract-state block, unlike
`record`/`create` — confirmed by reading the service, not assumed).

## ASSESSMENT

`/cases/[caseId]/assessments` (version list, newest first) + `/assessments/[id]` (criteria
table, submit/approve/reject). A new version is always the *next* version — `changeReason` is
collected only when the latest version is already APPROVED (matching `409
CHANGE_REASON_REQUIRED`'s actual trigger condition), never offered unconditionally.

## GAP ANALYSIS

`AssessmentCriterion.gap` is rendered exactly as the backend returns it
(`currentScore`/`targetScore`/`gap`/`priority`/`recommendation` columns) — the frontend never
computes `gap = target - current` itself; the upsert form only ever sends `currentScore`/
`targetScore`, never a `gap` field (verified by a test asserting the request body has no `gap`
key).

## ROADMAP

`/cases/[caseId]/roadmaps` (version list, "+ Lộ trình mới" pre-fills the baseline
`assessmentId` from the latest APPROVED assessment when one exists) + `/roadmaps/[id]`
(submit/approve/reject, status ACTIVE/COMPLETED/ARCHIVED). `409
ASSESSMENT_BASELINE_REQUIRED`/`ASSESSMENT_BASELINE_NOT_APPROVED` surfaced verbatim on approve
— never pre-checked client-side (the UI only shows an informational hint when no approved
assessment exists yet, it does not block the approve button).

## ROADMAP MILESTONES

Managed inline on the Roadmap detail page (no separate `/milestones/[id]` route — none is
mapped in F01's route set). Create/edit, status transition (`409 PREREQUISITE_NOT_DONE
{ unmetMilestoneIds, unmetTaskIds }` surfaced with the exact unmet IDs, never pre-checked), and
"+ Phụ thuộc" (add a dependency, picked from the roadmap's own already-loaded milestone list).
**Removing** a dependency is not exposed in the UI — the backend has an add endpoint and a
delete-by-id endpoint but no list/read endpoint for a milestone's existing dependencies, so
there is no way to discover which one to remove without inventing client-side state tracking;
documented as a known limitation, not a silent gap. Milestone Task creation/listing
(`.../tasks`) exists on the backend but was **not built** — same "no `/tasks` route in F01's
map" reasoning F03 already applied to Case Tasks.

## ACADEMIC

`/cases/[caseId]/profile` (Học tập tab): one row per (school, period) — a later period is
always a new record, in-place editing of an existing row is treated as a correction to that
specific period only, never a way to overwrite history. Verify action (`profile_evidence:edit`
— not a distinct permission, confirmed against the controller) available per un-verified row.

## TEST RECORDS

Bài thi chuẩn hóa tab: one row per attempt (`testType`+`attemptNumber`), both fields
edit-locked once created (matching `UpdateTestRecordDto`'s actual field omission — verified by
reading the DTO, not guessed) — correcting either means creating a new attempt. `409
DUPLICATE_TEST_ATTEMPT` on a repeated `(testType, attemptNumber)` pair surfaced verbatim as a
real conflict message, never silently merged into the existing row.

## COMPETITION

Thi đấu tab: each participation its own row (`eventName`/`year`/`category`/`result`/`rank`/
`award`), kept structurally separate from Activity — no shared entity, no "type" discriminator
folding one into the other.

## RESEARCH

Nghiên cứu tab: kept separate from Activity/Writing (its own `mentor`/`role`/`methodology`/
`output`/`publication` fields — no overlap with either).

## ACTIVITY / LEADERSHIP

Hoạt động / Lãnh đạo tab: `category` is a free-text field, never a hard-coded dropdown — no
configurable-category master-data endpoint exists on the backend for this (confirmed), so a
plain text input is the correct, non-inventive choice. Verify action available, same pattern as
Academic/Test.

## WRITING

`/cases/[caseId]/writing-artifacts` (list + create) + `/writing-artifacts/[id]` (version
history, status). Status is FSM-driven (DRAFT→REVIEW→{REVISION,FINAL}→...→SUBMITTED,
`409 INVALID_WRITING_STATUS_TRANSITION` for anything else, never pre-filtered in the select).
**No "Edit Final" exists anywhere** — there is no content-edit endpoint at all, only "create a
new version," so a Final/Submitted artifact's existing content is structurally immutable, not
just policy-forbidden. Per-version review (Duyệt phiên bản / Yêu cầu chỉnh sửa) is a separate
verdict from the artifact's own status. Comments reuse F03's shared `Comment` entity/API
(`POST/GET .../comments`) exactly, respecting internal/shared visibility — no new comment
concept invented. LOR (thư giới thiệu) tracking is a card on the artifact list page (no
separate route — F01 never mapped one): recommender/contact/deadline + request/submission
status, `contactEmail`/`contactPhone`/`internalNotes` rendered exactly as the backend returns
them (`null` when redacted for STUDENT_PARENT via `FieldPolicyService.redactLor` — verified by
a test asserting the redacted view renders without crashing and hides the edit action).

## DOCUMENT INTEGRATION

`lib/documents/api.ts` (`getDocument`/`requestDocumentDownload`, read-only) +
`EvidenceDocumentLink` (shared across every `evidenceDocumentId`/`documentId` field in this
phase) redeem the existing 2-step signed-download flow exactly (`GET /documents/:id/download`
→ `resolveApiUrl` the returned relative `downloadUrl` → open in a new tab immediately, never
cached or treated as a permanent link). No upload/browse UI was built — every document
reference across F04's forms (`evidenceDocumentId`, `signedDocumentId`, `receiptDocumentId`,
`documentId`) is a manual UUID text input, since no Document list/upload UI exists anywhere in
this app yet (F07 scope). `resolveApiUrl` (new, small addition to `lib/api/client.ts`) is the
one exception to "only `apiFetch`/`apiUpload`/`apiDownloadBlob` touch the backend URL" — a
document download is a plain browser navigation, not a fetch this app parses, so it legitimately
needs the resolved absolute URL.

## RBAC

Every action button in this phase is gated by `usePermissions().can(resource, action)` against
`lib/permissions/rbac-data.ts` — never a role-name or FSM-state guess. All six F04 resource
grant sets (`contracts`/`payments`/`assessments`/`roadmaps`/`profile_evidence`/`writing`)
already existed in `rbac-data.ts` from F02/F03 and were verified directly against the live
`@RequirePermission` decorators to match the backend exactly — **no `rbac-data.ts` change was
needed this phase**. Two new documented gaps, both the same shape as F03's `UserPicker`
limitation: `components/crm/student-picker.tsx` (Contract creation) degrades to a manual
Student-ID input for ADMIN_FINANCE (zero `students` grant — Contract/Payment scope is
deliberately separate from Student/Case scope); `UserPicker` gained a `required` prop after a
real bug (see "KNOWN ISSUES" / `FRONTEND_BUILD_STATUS.md`).

## FIELD SECURITY

Every financial field (`Contract.value`/`currency`/`approvalThreshold`, `Payment.amount`/
`paidAmount`/`refundedAmount`) and every LOR contact/internal field is rendered exactly as the
backend returns it — `null` when redacted, never re-derived, never a second request to a
different endpoint to work around a `null`. Decimal fields are typed `string` throughout (never
`number`), formatted for display via `formatMoney` using `Intl.NumberFormat` on the parsed
value purely for presentation, never used in any calculation.

## QUERY / CACHE

`lib/api/query-keys.ts` gained `contracts`/`payments`/`assessments`/`roadmaps`/
`profileEvidence`/`writingArtifacts` namespaces, following the exact same factory pattern F03
established. Every mutation invalidates precisely the query keys it affects (e.g. a Payment
mutation invalidates its own detail + the parent Contract's installment list + the parent
Contract's own detail, since a payment can change what the Contract page shows; a Milestone
mutation invalidates its own detail + the roadmap's milestone list + the roadmap detail) — never
a blanket `invalidateQueries()` with no key. No server state is duplicated into `useState`
anywhere in this phase's code.

## TESTS

128/128 passing (26 files: 88 carried over from F03 unchanged + 40 new F04 tests across 8 new
test files). Covers Contract list/detail/permission/status-action/amendment-history, Payment
list/detail/permission/refund/overpayment-conflict, Assessment detail/criteria/version-approval,
Roadmap detail/milestone/approval/prerequisite-conflict, Profile Evidence tabs incl. the
duplicate-test-attempt conflict, Writing detail/version/review/status incl. the LOR tracking
card and its field redaction. Full breakdown: `FRONTEND_BUILD_STATUS.md`.

## TYPECHECK

PASS — `npm run web:typecheck`, 0 errors.

## LINT

PASS — `npm run web:lint`, 0 errors, 0 warnings.

## BUILD

PASS — `npm run web:build` (Turbopack); all 10 new F04 routes compile alongside every F01–F03
route (21 total).

## BACKEND REGRESSION

PASS. Backend files touched: `contracts.service.ts` (DEC-10 — `STUDENT_SUMMARY_SELECT` added to
`list()`/`getById()` only, mirroring DEC-09 exactly), `field-policy.service.ts`
(`redactContract` made generic over `T extends Contract` so the added `student` field survives
its type signature — logic unchanged), one new e2e assertion in `contracts.e2e-spec.ts`.
`api:typecheck` PASS, `api:lint` PASS (0 new warnings, same 7 pre-existing), unit 182/182 PASS,
full e2e **480/480 PASS** run serially (`--runInBand`) against the local Docker Postgres test
database for a contention-free result (an earlier parallel-worker run produced 6 spurious
timeout-only failures across 5 suites unrelated to Contract/Payment, confirmed environmental —
see `FRONTEND_BUILD_STATUS.md` for the full re-run evidence). Never run against the production
Supabase instance — see the safety note below and in `FRONTEND_BUILD_STATUS.md`.

## DOCUMENTATION

Updated: `FRONTEND_ROUTES.md` (Contracts/Payments/Assessment/Roadmap/Profile/Writing/LOR marked
Implemented + discrepancy notes), `FRONTEND_API_MAP.md` (§2 rows updated + DEC-10 note +
implementation-discrepancy list), `FRONTEND_PERMISSION_MAP.md` (F04 usage note +
StudentPicker/UserPicker-`required` gaps), `FRONTEND_BUILD_STATUS.md` (F04 validation results +
test breakdown + the two real bugs found via testing + backend regression check + the
production-`.env` safety note), `docs/DECISIONS.md` (DEC-10). Created: this file.

## FILES CREATED

`lib/contracts/{types,api,hooks}.ts`, `lib/payments/{types,api,hooks}.ts`,
`lib/assessments/{types,api,hooks}.ts`, `lib/roadmaps/{types,api,hooks}.ts`,
`lib/profile-evidence/{types,api,hooks}.ts`, `lib/writing/{types,api,hooks}.ts`,
`lib/lor/{types,api,hooks}.ts`, `lib/documents/{types,api}.ts`,
`components/crm/{money,evidence-document-link,reason-dialog,student-picker}.tsx`,
`components/crm/contracts/{contract-form-dialog,contract-sign-dialog,contract-send-dialog,
contract-status-dialog,contract-amendment-dialog}.tsx`,
`components/crm/payments/{payment-create-dialog,payment-record-dialog,payment-refund-dialog,
payment-detail-dialog}.tsx`, `components/crm/assessments/criterion-dialog.tsx`,
`components/crm/roadmaps/{milestone-form-dialog,milestone-status-dialog,
milestone-dependency-dialog}.tsx`, `components/crm/profile-evidence/{academic-record-dialog,
test-record-dialog,competition-dialog,research-project-dialog,activity-dialog}.tsx`,
`components/crm/writing/{writing-artifact-form-dialog,writing-version-dialog,
writing-status-dialog,writing-version-row,lor-form-dialog}.tsx`,
`app/(staff)/contracts/page.tsx`, `app/(staff)/contracts/[id]/page.tsx`,
`app/(staff)/contracts/[id]/payments/page.tsx`,
`app/(staff)/cases/[caseId]/assessments/page.tsx`, `app/(staff)/assessments/[id]/page.tsx`,
`app/(staff)/cases/[caseId]/roadmaps/page.tsx`, `app/(staff)/roadmaps/[id]/page.tsx`,
`app/(staff)/cases/[caseId]/profile/page.tsx`,
`app/(staff)/cases/[caseId]/writing-artifacts/page.tsx`,
`app/(staff)/writing-artifacts/[id]/page.tsx`, plus 8 new `*.test.tsx` files (one per page
listed above that has interactive/permission-sensitive behavior), and this phase-status file.

## FILES UPDATED

`lib/api/client.ts` (added `resolveApiUrl`), `lib/api/query-keys.ts` (added F04 namespaces),
`lib/api/error-messages.ts` (added F04 error codes), `components/crm/status-badge.tsx` (added
Contract/Payment/Assessment/Roadmap/Milestone/Writing/LOR variant+label maps),
`components/crm/user-picker.tsx` (added `required` prop — see "KNOWN ISSUES"),
`components/shell/nav-config.ts` (Contracts `implemented: true`),
`app/(staff)/cases/[id]/page.tsx` (added the Counseling entry-point card),
`apps/api/src/modules/commercial/contracts/contracts.service.ts`,
`apps/api/src/modules/identity/rbac/field-policy.service.ts` (the DEC-10 backend fix),
`apps/api/test/contracts.e2e-spec.ts` (DEC-10 regression test), `docs/DECISIONS.md` (DEC-10),
`docs/frontend/{FRONTEND_ROUTES,FRONTEND_API_MAP,FRONTEND_PERMISSION_MAP,
FRONTEND_BUILD_STATUS}.md`.

## ASSUMPTIONS

- Payment detail/record/refund/waive is a Dialog opened from the installment list, not a
  standalone `/payments/[id]` route — F01's `FRONTEND_ROUTES.md` explicitly documents no bare
  `/payments` list and never mapped a detail route either; a Dialog satisfies "Payment detail"
  (F04 instruction §12) without inventing an unmapped route.
- Milestone management (create/edit/status/dependencies) lives inline on the Roadmap detail
  page, not a separate `/milestones/[id]` route, for the same reason — none was mapped in F01.
- LOR tracking is a card on the Writing artifact list page, not a separate route — F04's own
  instruction lists "LOR tracking" under the Writing checklist (not a standalone feature), and
  no route was mapped for it.
- The Contract create form's optional `templateId` field uses `GET /contract-templates` (real,
  confirmed against the backend) — not required by the F04 instructions, included since the
  API already existed and the effort was small.
- Assessment/Roadmap/Milestone list/detail endpoints return plain arrays, not `{data, meta}` —
  confirmed directly against the controllers; no `PaginationControls` was added to these list
  pages since there is nothing to paginate against.

## RISKS

- `StudentPicker`'s manual-UUID fallback (ADMIN_FINANCE, no `students:view`) has the same
  usability gap F03 already documented for `UserPicker` — a pre-existing backend
  permission-model shape, not introduced this phase.
- Milestone dependency removal is unreachable from the UI (no read endpoint) — a real, if minor,
  workflow gap until the backend adds one.
- No live-backend browser smoke test was performed in this environment — same limitation
  carried over from F02/F03 (no reachable running `apps/api` instance here); all coverage is via
  mocked-API component/unit tests plus a clean production build and a fully passing backend
  e2e suite against the local Docker Postgres database.
- The repository's root `.env` currently points at the production Supabase database (see
  `FRONTEND_BUILD_STATUS.md`'s safety note) — a real hazard for a future session that runs
  `npm run api:test:e2e`/`db:seed` without an explicit local-DB override.

## KNOWN ISSUES

- Milestone Task creation/listing not built (see "ROADMAP MILESTONES" above) — same `/tasks`
  route gap F03 already documented for Case Tasks.
- Milestone dependency *removal* not built (no read endpoint exists to discover one to remove).
- Contract templates are consumed read-only (picker only) — template *creation/management* UI
  was not built (not required by F04 instructions).
- Reports/Dashboard (`/dashboard`) remains the F01 placeholder — unrelated to this phase's scope.

## READY FOR F05: YES
