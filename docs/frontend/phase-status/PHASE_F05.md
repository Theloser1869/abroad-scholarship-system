# PHASE STATUS — F05 (Admission Frontend)

## PHASE F05 STATUS: PASS

## READY FOR F06: YES

## SUMMARY

Built the Admission frontend — Master Data (University/Program/ScholarshipMaster) and Student
Transaction (University Choice, Application + Checklist, Offer, ScholarshipApplication) — on top
of F02–F04's foundation, API-first against the real backend, reusing every prior primitive (API
client, auth, RBAC, App Shell, Query/cache, `Table`/`Dialog`/`Badge`/`Toast`/`Skeleton`/`Money`/
`EvidenceDocumentLink`/`ReasonDialog`/`DuplicateConflictNotice`-style patterns) unchanged. New
routes are exactly the F01-mapped set: `/universities`, `/universities/[id]`, `/programs`,
`/programs/[id]`, `/scholarship-masters`, `/scholarship-masters/[id]`,
`/students/[id]/university-choices`, `/cases/[caseId]/applications`, `/applications/[id]`,
`/applications/[applicationId]/offers`, `/offers/[id]`, `/cases/[caseId]/scholarship-applications`,
`/scholarship-applications/[id]` — 13 new routes, 31 total. One backend fix (DEC-11, mirroring
DEC-09/DEC-10 exactly, applied to four services at once).

## UNIVERSITIES

`/universities` (list: search + country filter, server-paginated) + `/universities/[id]` (detail,
Sửa, Xác minh via the dedicated `admission_master:verify` action distinct from `edit`). Duplicate
detection (`409 DUPLICATE_UNIVERSITY`) is entirely backend-decided — the shared
`DuplicateConflictNotice` component renders the server's own message plus a link to the single
`existingUniversityId` it returns, never a frontend string-match precheck and never a
multi-candidate picker (the real backend never returns a candidates array). University detail
also surfaces its Programs and Scholarships (filtered lists), giving a natural drill-down path
without duplicating either as a local entity.

## PROGRAMS

`/programs` (list: search + degree-level filter) + `/programs/[id]` (detail, Sửa, Xác minh).
University is picked via the new `UniversityPicker` at create time only; on edit it's shown
read-only (the embedded `program.university` summary from DEC-11), same "identity-establishing
field locked on edit" precedent as Contract's `studentId`. Tuition/application fee rendered via
the shared `Money`/`formatMoney` component, never recalculated — `applicationFee` intentionally
shares `tuitionCurrency` (no separate currency field exists on the backend). `409
DUPLICATE_PROGRAM` surfaced the same way as University's.

## SCHOLARSHIP MASTER

`/scholarship-masters` (list: search) + `/scholarship-masters/[id]` (detail, Sửa, Xác minh).
Deliberately never merged with ScholarshipApplication's own UI/route/entity — a scholarship
master row's `universityId`/`programId` are both optional and independent (a scholarship may tie
to a specific Program, a University generally, or neither), surfaced via `UniversityPicker`/
`ProgramPicker` at create/edit time. Financial fields (`amount`/`percentage`/`amountCurrency`)
are deliberately NOT field-redacted for anyone (confirmed against `RBAC_MATRIX.md` — public
catalog data, unlike Contract.value), rendered as returned.

## UNIVERSITY CHOICES

`/students/[id]/university-choices` — **student-scoped, not case-scoped**: the live backend
routes this under `/students/:studentId/university-choices` with `caseId` only an optional
linkage field, overriding the mega-prompt's "Case ID là source of scope" assumption (documented
as ASM-65, since F01's own route map already matched the real backend ahead of this phase). Tier
(Reach/Match/Safety) and status (Proposed/Shortlisted/Confirmed/Removed) both rendered with
dedicated badge variants. Status is the one F05 entity with **no dedicated FSM action** — the
backend accepts it as a plain `PATCH` field (confirmed against the live DTO/controller, unlike
every other status-carrying F04/F05 entity) — so the list page's inline `<select>` PATCHes it
directly rather than inventing a dedicated-action UI pattern the backend doesn't have. Review
(`POST .../review`) reuses the shared `ReasonDialog`. No standalone detail route exists (ASM-64,
same "no invented route" precedent as F04's Payment/Milestone) — edit/review are Dialogs from
the list. `409 DUPLICATE_UNIVERSITY_CHOICE` surfaced message-only (no link, since there's no
route to link to).

## APPLICATIONS

`/cases/[caseId]/applications` (list: status filter) + `/applications/[id]` (workspace: Header →
Institution/Program → Status → Checklist → Documents → Offers/Scholarship summaries → Actions).
`programId` is picked at create time only, immutable after (the backend DTO doesn't even accept
it on update). Status changes go through two paths matching the real FSM exactly: `submit()`
(READY_FOR_REVIEW → SUBMITTED, its own dedicated action) and the generic status endpoint (every
other transition except SUBMITTED/OFFER, which are structurally unreachable through it — a 400
DTO-validation rejection if attempted, not a 409). `409
INVALID_APPLICATION_STATUS_TRANSITION`'s real `allowedTransitions` array is rendered verbatim in
the status dialog's conflict message, same "surface the exact allowed/unmet list" precedent F04
established for Milestone's `PREREQUISITE_NOT_DONE`. Duplicate-active-application is the real
`409 ACTIVE_APPLICATION_EXISTS` (not "DUPLICATE_APPLICATION" as some planning docs assume — code
wins), surfaced verbatim via `DuplicateConflictNotice`, never pre-checked with a separate lookup
request first.

## APPLICATION CHECKLIST

Embedded directly on the Application detail response (`GET /applications/:id`'s Prisma
`include`) — the checklist section reads from the already-loaded detail, no separate round trip.
Per-item create/edit via `ChecklistItemDialog` (`required` checkbox, `UserPicker` with
`required={false}` for the owner, `EvidenceDocumentLink` for the linked document). Completion
gate is entirely server-side (`ApplicationsService.submit`'s `CHECKLIST_INCOMPLETE` check) — the
Submit dialog never pre-computes eligibility from the loaded checklist itself, it only submits
and reflects whatever the server reports.

## OFFERS

`/applications/[applicationId]/offers` (full history, current offer highlighted) +
`/offers/[id]` (detail, Accept/Decline). Multiple offers never overwrite each other — a revised
offer is always a new row, confirmed both by the schema's own design comment and by e2e
behavior. "Current offer" is entirely backend-computed (`GET .../offers/current` — ACCEPTED if
any, else most recent RECEIVED, else `null`) and rendered as-is, never derived from "latest
date" client-side. **`respond` is NOT idempotent** — a second accept/decline on an
already-resolved offer is a genuine `409 INVALID_OFFER_STATE` (confirmed directly against
`OffersService.respond`, overriding any "repeat accept = silent success" assumption); the Offer
detail page hides Accept/Decline once `status !== 'RECEIVED'` and, if a race still slips through,
renders the 409 as a real error. Expired offers are a lazy backend sweep on every read — no
frontend polling/timer logic was added.

## SCHOLARSHIP APPLICATIONS

`/cases/[caseId]/scholarship-applications` (list) + `/scholarship-applications/[id]` (workspace:
Header → Scholarship → Eligibility → Application status → Evidence/checklist → Result/Award).
Kept fully structurally distinct from ScholarshipMaster (own route, own list/detail UI,
`scholarshipMasterId` picked via `ScholarshipMasterPicker` at create time only). `applicationId`
(optional — a scholarship may be pursued independently) is chosen from the Case's own
already-loaded Application list, never a manual UUID input. Status: every transition except
AWARDED/REJECTED goes through the generic status endpoint (`409
INVALID_SCHOLARSHIP_APPLICATION_STATUS_TRANSITION` with its real `allowedTransitions` rendered,
same pattern as Application); `award`/`reject` are their own dedicated actions, reachable only
from UNDER_REVIEW/INTERVIEW. Award result (`awardAmount`/`awardCurrency`/`awardCoverageType`/
`awardPeriod`/`awardAcceptanceDeadline`) recorded together atomically and displayed in its own
"Kết quả trao học bổng" section — **never creates or references a Contract/Payment record**
(confirmed: no such field exists on the entity at all).

## ELIGIBILITY

Represented as two plain fields on the ScholarshipApplication entity itself
(`eligibilityConfirmed`/`eligibilityNotes`), not a separate eligibility-check endpoint or a
client-side rule engine. The "Xác nhận đủ điều kiện" action (reusing the shared `ReasonDialog`)
is the only way to set `eligibilityConfirmed = true`; the Submit path is simply
shown/hidden based on that boolean, and the backend independently re-enforces it with `409
ELIGIBILITY_NOT_CONFIRMED` if the client-side gate is ever bypassed — verified by a test that
attempts SUBMITTED before confirming and asserts the real 409 message renders, not a
client-invented block.

## DOCUMENT INTEGRATION

No new upload/browse UI — every `evidenceDocumentId`/`documentId` field across F05
(`Application.evidenceDocumentId`, `ApplicationChecklist.documentId`, `Offer.evidenceDocumentId`,
`ScholarshipApplication.evidenceDocumentId`) is a manual UUID input in its create/action form,
paired with F04's `EvidenceDocumentLink` component for read-side rendering — redeeming the
existing 2-step signed-download flow exactly, never a direct R2/bucket URL. F05 does not rebuild
any part of the Document subsystem (F07 scope).

## RBAC

Every action button is gated by `usePermissions().can(resource, action)` against
`lib/permissions/rbac-data.ts` — never a role-name or FSM-state guess. All five F05 resource
grant sets (`admission_master`/`university_choices`/`applications`/`offers`/
`scholarship_applications`) already existed in `rbac-data.ts` from F02/F03 and were verified
directly against the live `@RequirePermission` decorators to match the backend exactly —
**no `rbac-data.ts` change was needed this phase**. New `ProgramPicker`/`UniversityPicker`/
`ScholarshipMasterPicker` components never needed the `StudentPicker`/`UserPicker`-style
manual-UUID fallback (ASM-66) — every role that can create these transactions also holds
`admission_master:view`.

## CASE SCOPE

Application/Offer/ScholarshipApplication all resolve their scope through the owning Case
(`assertCaseAccessible`, Offer one hop through its parent Application); University Choice
resolves through the owning **Student** instead (ASM-65). A 404 on any of these — whether the
record genuinely doesn't exist or the caller is simply out of scope — renders the exact required
copy ("Không tìm thấy hoặc bạn không có quyền truy cập.") via the shared `QueryErrorState`/
`ScopeErrorState` components (unchanged since F03), never distinguishing the two cases.

## FIELD SECURITY

`ScholarshipApplication.internalNotes` comes back `null` when field-redacted for STUDENT_PARENT
(`FieldPolicyService.redactScholarshipApplication`, made generic in DEC-11 so the new
`scholarshipMaster` embed survives the type) or genuinely unset — rendered exactly as returned
(`?? "—"`), never a client workaround or a second request to a different endpoint. Every other
F05 entity (University/Program/ScholarshipMaster/UniversityChoice/Application/Offer) has **no**
field-level redaction at all, confirmed directly against `field-policy.service.ts` — financial
fields on Program/ScholarshipMaster/Offer are deliberately public catalog data (RBAC_MATRIX.md
ASM-32), unlike Contract.value.

## QUERY / CACHE

`lib/api/query-keys.ts` gained `universities`/`programs`/`scholarshipMasters`/
`universityChoices`/`applications`/`offers`/`scholarshipApplications` namespaces, following the
exact same factory pattern F03/F04 established. Every mutation invalidates precisely the query
keys it affects — e.g. creating an Offer invalidates the offer list + current-offer query + the
parent Application's own detail (since the backend transitions the Application to OFFER status
as a side effect), matching F05 instruction §29's own worked example exactly; a checklist-item
mutation invalidates the parent Application's detail query (checklist is embedded there, not a
separate cache entry) rather than a separately-tracked, perpetually-stale checklist cache. No
server state is duplicated into `useState` anywhere in this phase's code.

## TESTS

174/174 passing (37 files: 128 carried over from F04 unchanged + 46 new F05 tests across 11 new
test files). Covers University/Program/ScholarshipMaster list/detail/create/edit/verify,
University Choice list/add/edit/case(student)-scope, Application list/detail/checklist/status-
transition/409-duplicate, Offer multiple-offers/current-offer/accept/decline/idempotent-409,
Scholarship Application list/detail/eligibility/submit-gate/award/reject, RBAC hidden-actions/
forbidden/404-non-enumeration, and field redaction. Full breakdown: `FRONTEND_BUILD_STATUS.md`.

## TYPECHECK

PASS — `npm run web:typecheck`, 0 errors.

## LINT

PASS — `npm run web:lint`, 0 errors, 0 warnings.

## BUILD

PASS — `npm run web:build` (Turbopack); all 13 new F05 routes compile alongside every F01–F04
route (31 total).

## BACKEND REGRESSION

PASS. Backend files touched: `programs.service.ts`, `applications.service.ts`,
`university-choices.service.ts`, `scholarship-applications.service.ts` (DEC-11 — each gained a
`*_SUMMARY_SELECT` constant + a `*With*` type, added to `list()`/`getById()` only, mirroring
DEC-09/DEC-10 exactly), `field-policy.service.ts` (`redactScholarshipApplication` made generic
over `T extends ScholarshipApplication`, same fix shape as DEC-10's `redactContract`), 3 new e2e
assertions across `admission-master-data.e2e-spec.ts`/`admission-application.e2e-spec.ts`
(×2)/`admission-offer-scholarship.e2e-spec.ts`. `api:typecheck` PASS (0 errors), `api:lint` PASS
(0 new warnings, same 7 pre-existing baseline), unit **182/182 PASS**, full e2e
**25/25 suites, 484/484 tests PASS** (480 baseline + 4 new DEC-11 assertions) run serially
(`--runInBand`) against the local Docker Postgres test database. Docker Desktop was not running at the start of this phase (had to be started fresh);
every test invocation used the same explicit `DATABASE_URL`/`DIRECT_URL` shell-env-override
discipline F04 established — never the git-ignored root `.env`, which still points at
production (see the safety note in `FRONTEND_BUILD_STATUS.md`).

## FILES CREATED

`lib/universities/{types,api,hooks}.ts`, `lib/programs/{types,api,hooks}.ts`,
`lib/scholarship-masters/{types,api,hooks}.ts`, `lib/university-choices/{types,api,hooks}.ts`,
`lib/applications/{types,api,hooks}.ts`, `lib/offers/{types,api,hooks}.ts`,
`lib/scholarship-applications/{types,api,hooks}.ts`,
`components/crm/duplicate-conflict-notice.tsx`,
`components/crm/universities/{university-form-dialog,university-picker}.tsx`,
`components/crm/programs/{program-form-dialog,program-picker}.tsx`,
`components/crm/scholarship-masters/{scholarship-master-form-dialog,
scholarship-master-picker}.tsx`,
`components/crm/university-choices/university-choice-form-dialog.tsx`,
`components/crm/applications/{application-form-dialog,application-submit-dialog,
application-status-dialog,checklist-item-dialog,checklist-item-row}.tsx`,
`components/crm/offers/{offer-create-dialog,offer-respond-dialog}.tsx`,
`components/crm/scholarship-applications/{scholarship-application-form-dialog,
scholarship-status-dialog,award-dialog}.tsx`,
`app/(staff)/universities/page.tsx`, `app/(staff)/universities/[id]/page.tsx`,
`app/(staff)/programs/page.tsx`, `app/(staff)/programs/[id]/page.tsx`,
`app/(staff)/scholarship-masters/page.tsx`, `app/(staff)/scholarship-masters/[id]/page.tsx`,
`app/(staff)/students/[id]/university-choices/page.tsx`,
`app/(staff)/cases/[caseId]/applications/page.tsx`, `app/(staff)/applications/[id]/page.tsx`,
`app/(staff)/applications/[applicationId]/offers/page.tsx`, `app/(staff)/offers/[id]/page.tsx`,
`app/(staff)/cases/[caseId]/scholarship-applications/page.tsx`,
`app/(staff)/scholarship-applications/[id]/page.tsx`, plus 11 new `*.test.tsx` files (one per
route listed above that has interactive/permission-sensitive behavior), and this phase-status
file.

## FILES UPDATED

`lib/api/query-keys.ts` (added F05 namespaces), `lib/api/error-messages.ts` (added F05 error
codes), `components/crm/status-badge.tsx` (added University/Program/ScholarshipMaster/
UniversityChoice/Application/Checklist/Offer/ScholarshipApplication variant+label maps),
`components/shell/nav-config.ts` (Universities/Programs/Scholarships `implemented: true`),
`app/(staff)/cases/[id]/page.tsx` (added the Admission entry-point card),
`app/(staff)/students/[id]/page.tsx` (added the University Choices entry-point link),
`apps/api/src/modules/admission/master-data/programs.service.ts`,
`apps/api/src/modules/admission/applications/applications.service.ts`,
`apps/api/src/modules/admission/university-choices/university-choices.service.ts`,
`apps/api/src/modules/admission/scholarship-applications/scholarship-applications.service.ts`,
`apps/api/src/modules/identity/rbac/field-policy.service.ts` (the DEC-11 backend fix),
`apps/api/test/{admission-master-data,admission-application,
admission-offer-scholarship}.e2e-spec.ts` (DEC-11 regression tests), `docs/DECISIONS.md`
(DEC-11), `docs/frontend/{FRONTEND_ROUTES,FRONTEND_API_MAP,FRONTEND_PERMISSION_MAP,
FRONTEND_BUILD_STATUS}.md`.

## ASSUMPTIONS

- University Choice detail (edit/review) is a Dialog opened from the student-scoped list, not a
  standalone `/university-choices/[id]` route — F01 never mapped one (ASM-64).
- University Choice is scoped by Student, not Case, matching the live backend over the mega-
  prompt's own "Case ID là source of scope" framing — F01's route map already got this right
  (ASM-65).
- `ProgramPicker`/`UniversityPicker`/`ScholarshipMasterPicker` never need a manual-UUID fallback
  — every role that can create the transactions using them also holds `admission_master:view`
  (ASM-66).
- Program list/detail's currency display assumes `applicationFee` always shares
  `Program.tuitionCurrency` (no separate field exists on the backend, matching
  `docs/ASSUMPTIONS.md`'s own pre-existing note on this schema decision).

## RISKS

- The DEC-11 backend fix touches four services at once (Program/Application/UniversityChoice/
  ScholarshipApplication) — a broader single-phase surface than DEC-09/DEC-10's one-service-each
  precedent, though each individual change is the same minimal, additive, list/getById-only
  shape and is independently e2e-covered.
- No live-backend browser smoke test was performed in this environment — same limitation
  carried over from F02–F04 (no reachable running `apps/api` instance here); all coverage is via
  mocked-API component/unit tests plus a clean production build and a fully passing backend e2e
  suite against the local Docker Postgres database.
- The repository's root `.env` still points at the production Supabase database (unchanged
  since F04) — a standing hazard for a future session that runs `npm run api:test:e2e`/
  `db:seed` without an explicit local-DB override. Docker Desktop was also found not running at
  the start of this phase and had to be started manually before any local-DB test could run.

## KNOWN ISSUES

- University Choice `status` has no dedicated FSM action on the backend (a plain `PATCH` field,
  unlike every other status-carrying F04/F05 entity) — the frontend reflects this shape exactly
  rather than inventing a dedicated-action UI pattern that doesn't exist server-side.
- `Offer.evidenceDocumentId`/`ApplicationChecklist.documentId`/etc. remain manual UUID inputs —
  no document picker/browse UI exists anywhere in this app yet (F07 scope, same limitation as
  every F04 evidence field).
- Reports/Dashboard (`/dashboard`) remains the F01 placeholder — unrelated to this phase's scope.

## READY FOR F06: YES
