# FRONTEND API MAP — Phase F01 (designed), implemented F02, extended F03, extended F04, extended F05, extended F06, extended F07, extended F08

**Status**: §1's conventions are now real, working code — `lib/api/client.ts`
(`apiFetch`/`apiUpload`/`apiDownloadBlob`/`resolveApiUrl`, single-flight refresh, timeout,
error mapping) and `lib/auth/` (login/MFA/refresh/logout). Auth-specific detail (token
strategy, refresh race, session bootstrap sequencing) is documented in
`docs/frontend/FRONTEND_AUTH.md`, not duplicated here. F03 added the first real domain typed-
call layers: `lib/leads/api.ts`, `lib/students/api.ts`, `lib/cases/api.ts`. F04 added
`lib/contracts/`, `lib/payments/`, `lib/assessments/`, `lib/roadmaps/`, `lib/profile-evidence/`,
`lib/writing/`, `lib/lor/`, `lib/documents/` (read-only: `getDocument`/
`requestDocumentDownload` only — F04 integrates document *links*, it does not rebuild the
Document subsystem, F07 scope) — each a thin wrapper over `apiFetch`, per §1's rule that this
file is the only module allowed to call `fetch`, plus matching TanStack Query hooks with scoped
cache invalidation (§7 "Query / cache"). F05 added `lib/universities/`, `lib/programs/`,
`lib/scholarship-masters/`, `lib/university-choices/`, `lib/applications/`, `lib/offers/`,
`lib/scholarship-applications/` — same thin-wrapper-plus-hooks pattern, reusing F04's
`EvidenceDocumentLink`/`lib/documents/` for every document reference (`evidenceDocumentId`/
`documentId`) rather than rebuilding anything. Every other domain in §2's mapping table below
remains F06+ scope.

### F03 backend fix (DEC-09) — owner/student relation summaries

`GET /leads`, `GET /leads/:id`, `GET /cases`, `GET /cases/:id`, `GET /cases/:id/members`
previously returned bare `ownerId`/`studentId` foreign keys with no way to render a display
name without either an N+1 fetch per row or a forbidden full-table client scan. Fixed
backend-side (Prisma `select`-scoped relation summaries — `{ id, username, fullName }` /
`{ id, studentCode, fullName }`, never a bare `include: { owner: true }` which would leak
`passwordHash`) — see `docs/DECISIONS.md` DEC-09. `GET /cases` also gained a `studentId`
query filter (needed for the Student 360 view's "this student's cases" list — reuses the same
list endpoint, no new route). Frontend types: `lib/api/types.ts`'s shared `UserSummary`,
embedded as `Lead.owner` / `Case.owner` / `Case.student` / `CaseMember.user`.

### F04 backend fix (DEC-10) — Contract student relation summary

Same gap as DEC-09, found on `GET /contracts`/`GET /contracts/:id`: bare `studentId`, no way to
render which student a contract belongs to. Fixed identically (`STUDENT_SUMMARY_SELECT` on
`ContractsService.list()`/`getById()` only; `FieldPolicyService.redactContract` made generic
over `T extends Contract` so the added `student` field survives its type signature) — see
`docs/DECISIONS.md` DEC-10. `lib/contracts/types.ts`'s `Contract.student: StudentSummary`
(reuses `lib/cases/types.ts`'s `StudentSummary`, not a duplicate type).

### F04 implementation notes / discrepancies vs. `docs/api/API_CONVENTIONS.md`

Confirmed directly against the live controllers (implementation is source of truth per this
phase's own instruction):

- **Assessment/Roadmap have no bare `PATCH /assessments/:id` / `PATCH /roadmaps/:id`** — the
  convention doc lists one, but every field-level change goes through a dedicated action
  endpoint instead (submit/approve/reject/criteria-upsert for Assessment; submit/approve/
  reject/status for Roadmap).
- **Assessment criterion upsert is `POST /assessments/:id/criteria`** with `area` in the
  request body, not `PUT /assessments/:id/criteria/:area` as the convention doc shows.
- **`GET /writing-artifacts/:id/versions` does not exist** as a separate endpoint — versions
  come embedded in `GET /writing-artifacts/:id`'s own response (`.versions`, sorted desc).
- **All Counseling-domain list endpoints** (`assessments`, `roadmaps`, `roadmaps/:id/
  milestones`, `academic-records`, `test-records`, `competitions`, `research-projects`,
  `activities`, `writing-artifacts`, `letters-of-recommendation`) **return a plain array, never
  `{data, meta}`** — every one is Case-scoped with naturally small row counts; no
  `PaginationControls` is used anywhere in F04's Counseling pages, only in Contracts/Payments
  (which do paginate, matching F03's Lead/Student/Case convention).
- **Milestone `POST .../tasks`/`GET .../tasks`** exist and are gated on `roadmaps:edit` (not a
  separate `tasks:create` check) but were **not built** — Task UI is out of F04 scope (no
  `/tasks` route in F01's map, same precedent as F03's Case Tasks).
- **Milestone dependencies have no list/read endpoint** — only `POST .../dependencies` (add)
  and `DELETE .../dependencies/:dependsOnMilestoneId` (remove). The UI can therefore only
  *add* a dependency (picking from the roadmap's own already-loaded milestone list); *removing*
  one is not reachable from the UI since there is no way to discover which dependencies exist
  without inventing client-side state tracking — documented limitation, not a silent gap.

### F05 backend fix (DEC-11) — Program/Application/UniversityChoice/ScholarshipApplication parent-entity summaries

Same gap as DEC-09/DEC-10, found in four places at once: `GET /programs`/`GET /programs/:id`
(bare `universityId`), `GET /cases/:caseId/applications`/`GET /applications/:id` (bare
`programId`), `GET /students/:studentId/university-choices`/`GET /university-choices/:id` (bare
`programId`), `GET /cases/:caseId/scholarship-applications`/`GET /scholarship-applications/:id`
(bare `scholarshipMasterId`). Fixed identically four times (`UNIVERSITY_SUMMARY_SELECT`/
`PROGRAM_SUMMARY_SELECT` (×2, declared locally per service)/`SCHOLARSHIP_MASTER_SUMMARY_SELECT`
on each service's `list()`/`getById()` only; `FieldPolicyService.redactScholarshipApplication`
made generic over `T extends ScholarshipApplication`, same fix shape as DEC-10's
`redactContract`, since it's the only one of the four entities with any field redaction at all)
— see `docs/DECISIONS.md` DEC-11. Frontend types: `lib/programs/types.ts`'s
`ProgramUniversitySummary`/`ProgramSummary` (the latter reused, not duplicated, by
`lib/university-choices/types.ts` and `lib/applications/types.ts`), `lib/scholarship-applications/
types.ts`'s `ScholarshipApplicationMasterSummary`.

### F05 implementation notes / discrepancies

Confirmed directly against the live controllers/services (implementation is source of truth per
this phase's own instruction) — cross-checked against `docs/api/API_CONVENTIONS.md` and
`docs/security/RBAC_MATRIX.md`, both of which matched the live code exactly for every Admission
route/permission/status code (**no doc-vs-code discrepancy found** in either document itself):

- **Duplicate-detection 409s carry a single `existing*Id`, never a candidates array** —
  `DUPLICATE_UNIVERSITY`/`DUPLICATE_PROGRAM`/`DUPLICATE_SCHOLARSHIP_MASTER`/
  `DUPLICATE_UNIVERSITY_CHOICE` all resolve to exactly one conflicting record (confirmed against
  every `assertNoDuplicate` implementation). The shared `DuplicateConflictNotice` component
  therefore links to the one existing record (when a detail route exists — never for
  UniversityChoice, see below), never a multi-candidate picker.
- **The real duplicate-active-application error code is `ACTIVE_APPLICATION_EXISTS`**, not
  "DUPLICATE_APPLICATION" as some planning documents assume (`docs/DECISIONS.md` DEC-05's own
  original naming). Code wins.
- **`Offer.respond` is NOT idempotent** — `OffersService.respond` requires `status === 'RECEIVED'`;
  a second accept/decline on an already-resolved offer is a genuine `409 INVALID_OFFER_STATE`,
  e2e-confirmed. The `OfferRespondDialog`/Offer detail page render this as a real error (and
  additionally disable the Accept/Decline buttons once `status !== 'RECEIVED'`), never treating a
  repeat response as a silent success.
- **`OfferStatus.WITHDRAWN` exists in the Prisma enum but no current backend code path ever sets
  it** — rendered defensively (`OFFER_STATUS_VARIANT`/`OFFER_STATUS_LABEL` both cover it) but no
  UI action produces it.
- **UniversityChoice is student-scoped (`/students/:studentId/university-choices`), not
  case-scoped** — `caseId` is only an optional linkage field on the record, confirmed against
  both the live route (`StudentUniversityChoicesController`) and the service's own scope check
  (`assertStudentAccessible` unconditionally, `assertCaseAccessible` only when `caseId` is set).
  This overrides the "Case ID là source of scope" assumption in the F05 mega-prompt's own §12.
- **UniversityChoice has no standalone detail route** — no `/university-choices/[id]` was mapped
  in F01's `FRONTEND_ROUTES.md`, so edit/review are Dialogs launched from the student-scoped
  list, same "no invented route" precedent as F04's Payment. `UniversityChoiceFormDialog`'s
  duplicate-conflict notice therefore shows the message only, no link.
- **UniversityChoice's `status` field has no dedicated FSM action** — `PATCH
  /university-choices/:id` accepts `status` as a plain field (unlike every other F04/F05
  status-carrying entity, which always has a dedicated action or a generic-status endpoint
  distinct from its own `PATCH`). Confirmed directly against the DTO and controller; the list
  page's inline `<select>` PATCHes it directly, matching the backend's own shape rather than
  inventing a dedicated-action UI pattern that doesn't exist server-side.
- **Application/ScholarshipApplication's generic status-transition 409s both include the real
  `allowedTransitions` array** (`INVALID_APPLICATION_STATUS_TRANSITION`/
  `INVALID_SCHOLARSHIP_APPLICATION_STATUS_TRANSITION`) — both status dialogs render it verbatim,
  same "surface the exact unmet/allowed list" precedent F04 established for Milestone's
  `PREREQUISITE_NOT_DONE`.
- **ScholarshipApplication eligibility is two plain fields on the entity itself**
  (`eligibilityConfirmed`/`eligibilityNotes`), not a separate eligibility-check endpoint — set
  together via `confirm-eligibility`; the Submit-blocking gate is simply "hide/disable until
  `eligibilityConfirmed === true`," server-independently re-enforced via `409
  ELIGIBILITY_NOT_CONFIRMED` if bypassed.
- **Award never links a Contract/Payment record** — `AwardScholarshipDto`/the `ScholarshipApplication`
  model carry no `contractId`/`paymentId` field at all (confirmed against `schema.prisma`), so
  there is nothing to accidentally cross-link even in principle.
- **`GET /applications/:applicationId/checklist` exists as its own endpoint** but the Application
  detail page never calls it separately — `GET /applications/:id` already embeds `checklist` via
  Prisma `include`, so the checklist section reads from the already-loaded detail response; the
  standalone endpoint is still wired in `lib/applications/api.ts` (used by the checklist item
  create/update hooks' cache-invalidation target) but not fetched independently.

### F06 backend fix (DEC-12) — Enrollment/PartnerProgram/PartnerStudentLink/CommissionTransaction parent-entity summaries

Same gap as DEC-09/10/11, found in four places at once: `GET /cases/:caseId/enrollments`/
`GET /enrollments/:id` (bare `universityId`/`programId`), `GET /partners/:id/programs`/
`GET /partner-programs/:id` (bare `partnerId`, optional bare `programId`), `GET /partners/:id/
student-links` + `GET /students/:id/partner-links`/`GET /partner-student-links/:id` (bare
`partnerId`/`studentId`), `GET /commission-transactions` (+ partner-nested variant)/
`GET /commission-transactions/:id` (bare `partnerId`, nullable bare `studentId`). Fixed
identically four times (`UNIVERSITY_SUMMARY_SELECT`+`PROGRAM_SUMMARY_SELECT`/
`PARTNER_SUMMARY_SELECT`+`PROGRAM_SUMMARY_SELECT` (nested into University)/
`PARTNER_SUMMARY_SELECT`+`STUDENT_SUMMARY_SELECT` (×2, declared locally per service) on each
service's list/detail paths only; `FieldPolicyService.redactEnrollment` made generic over
`T extends Enrollment`, same fix shape as DEC-10's `redactContract`/DEC-11's
`redactScholarshipApplication`, since it's the only one of the four entities with any field
redaction at all) — see `docs/DECISIONS.md` DEC-12. Frontend types: `lib/enrollments/types.ts`'s
embedded `university`/`program` (reusing `ProgramUniversitySummary` from `lib/programs/types.ts`),
`lib/partner-programs/types.ts`'s `PartnerProgramPartnerSummary`/`PartnerProgramProgramSummary`,
`lib/partner-student-links/types.ts`'s `PartnerStudentLinkPartnerSummary`/
`PartnerStudentLinkStudentSummary`, `lib/commission-transactions/types.ts`'s
`CommissionTransactionPartnerSummary`/`CommissionTransactionStudentSummary`.

### F06 implementation notes / discrepancies

Confirmed directly against the live controllers/services/`schema.prisma` (implementation is
source of truth per this phase's own instruction) — cross-checked against
`docs/api/API_CONVENTIONS.md` and `docs/security/RBAC_MATRIX.md`, both of which matched the live
code exactly for every Visa/Pre-departure/Enrollment/Partner route/permission/status code (**no
doc-vs-code discrepancy found** in either document itself):

- **Pre-departure is not a separate model** — `VisaChecklistItem` is polymorphic
  (`entityType: 'Visa' | 'PreDeparture'`, `entityId` = a Visa's id or, for Pre-departure, the
  Case's id directly), shared with Visa's own checklist and reusing F05's
  `ChecklistItemStatus` enum. `PreDepartureService.listForCase()` returns a plain
  `VisaChecklistItem[]`; there is no separate PreDeparture model in `schema.prisma` at all, and
  no "mark pre-departure complete" action — completeness is enforced only at Case Closure (`409
  PRE_DEPARTURE_CHECKLIST_INCOMPLETE`, pre-existing F03/F04 scope). See ASM-69.
- **Enrollment's `universityId`/`programId` are derived server-side from the Offer**, never
  client-supplied — `CreateEnrollmentDto` accepts only `offerId`/`startDate`/
  `evidenceDocumentId`. Offer validity (must belong to the Case, must be ACCEPTED) is enforced
  at Enrollment-create time via `409 INVALID_ENROLLMENT_TARGET`, not a separate validity-check
  endpoint. See ASM-70.
- **`CONFIRMED_ENROLLMENT_EXISTS` enforces at-most-one-CONFIRMED-Enrollment-per-Case** — a real
  409 with `existingEnrollmentId`, surfaced verbatim by `EnrollmentConfirmDialog`, never
  pre-checked client-side.
- **PartnerDocument is its own model wrapping a REQUIRED `documentId` FK**, not literally
  Document rows — carries `type`/`version`/`status`/`effectiveDate`/`expiryDate`/`ownerId`
  metadata. `@@unique([partnerId, type, version])`, auto-incremented per new `create()` call;
  editable only while DRAFT (`409 PARTNER_DOCUMENT_NOT_EDITABLE` otherwise); `activate`
  atomically supersedes the prior ACTIVE row for the same `(partnerId, type)` → SUPERSEDED. A
  correction after signing is a whole new version row, never an in-place edit.
- **CommissionRule cross-validates `basis` vs `percentageRate`/`fixedAmount` server-side** (400
  `FIXED_AMOUNT_REQUIRED`/`PERCENTAGE_RATE_REQUIRED`/`FIXED_AMOUNT_NOT_ALLOWED`/
  `PERCENTAGE_RATE_NOT_ALLOWED`) — `CommissionRuleFormDialog` mirrors this as UX guidance
  (hiding the irrelevant input) but never substitutes for the real server-side check.
  Rule-matching/precedence (`CommissionRulesService.selectRuleFor`) is 100% backend-internal,
  never exposed via any endpoint or previewed client-side.
- **CommissionTransaction's `calculate()` performs authoritative `Prisma.Decimal` math
  server-only** (`basisAmount.times(percentageRate).toDecimalPlaces(2, ROUND_HALF_UP)`) —
  confirms "no client-side money calculation" is structural here, not just a style rule; the
  detail page's "Tính toán" action only calls the endpoint and renders whatever
  `calculatedAmount` comes back via the shared `Money` component.
- **`409 PARTNER_STUDENT_LINK_REQUIRED` is a real, non-obvious precondition** — commission
  cannot be attributed to a partner with no active PartnerStudentLink to the source student,
  surfaced verbatim by `CommissionTransactionDetailContent`, never pre-validated client-side.
- **`409 INVALID_COMMISSION_TRANSACTION_STATE` uses a prose message, not an `allowedTransitions`
  array** — unlike Visa/Application/ScholarshipApplication's generic status-transition 409s
  (confirmed directly against the live service), so `crmErrorMessage`'s mapped text is shown
  as-is with no allowed-list rendering, a deliberate difference from `VisaStatusDialog`'s pattern.
- **PartnerStudentLink has two independent list contexts reaching the same underlying rows**
  (`/partners/:id/student-links` and `/students/:id/partner-links`) — both `usePartnerStudentLinksForPartner`
  and `usePartnerStudentLinksForStudent` hit the identical `PartnerStudentLink` shape via
  DEC-12's shared `paginate()` fix; the Student detail page's read-only "Đối tác liên kết" card
  uses the student-scoped list, the Partner detail page's editable section uses the
  partner-scoped one.
- **`Partner.internalNotes` redacts for DOCUMENT_SPECIALIST**, a different role than every other
  F04-F06 `internalNotes` redaction (which all target STUDENT_PARENT) — confirmed directly
  against `FieldPolicyService.redactPartner`.

### F07 implementation notes / discrepancies

Confirmed directly against the live `DocumentsController`/`DocumentsService`,
`NotificationsController`/`NotificationsService`, `ReportsController`/`ReportsService`, and
`schema.prisma`. Unlike every prior domain phase, **F07 required zero backend changes** — no
DEC entry, no service edit, no e2e spec touch. Every real limitation found below is a
pre-existing backend-shape gap (documented as ASM-71 through ASM-78), not something a small
service fix could close within F07's "no unrelated backend work" scope:

- **`DocumentsController` has no `GET /documents` list route at all** — not even an
  owner-entity-scoped one. `DocumentsService.listAccessibleTo()` exists but is dead code from
  the controller's perspective (Portal has its own, separate document-listing endpoint,
  F08 scope). The `/documents` hub is a lookup-by-id + upload entry point, never a browser. See
  ASM-71.
- **Document Share (`POST /:id/share`) is additive-only** — no "list current grants" or
  "revoke" endpoint exists (`ShareDocumentDto` only grants VIEW/DOWNLOAD to a new principal).
  See ASM-72.
- **Document version history only has a `previousVersionId` scalar, never a `nextVersionId`**
  — `nextVersion` is a Prisma relation, never selected by `getById`/`findOrThrow`. The detail
  page can only link to a document's predecessor, never discover its successor. See ASM-73.
- **`GET /documents/:id` returns the raw scalar `Document` row** — no field redaction exists
  for Document anywhere in `FieldPolicyService` (confirmed by grep — zero matches); access
  control is entirely grant-based (already true since F04), not field-level.
- **There is no notification "type" enum or list endpoint** — every entry in
  `NOTIFICATION_EVENT_META` was transcribed directly from the real `notify(BothChannels)(...)`
  call sites across six service files, never invented. Four of eleven real event names
  (`TASK_*`) carry a real `taskId` but have no frontend Task route to link to at all — this is
  a missing frontend surface (Task management was never built as a standalone route through
  F07), not a backend gap. See ASM-74.
- **`NotificationsController` has no bulk "mark all read" route** — only
  `PATCH /notifications/:id/read`, one at a time. See ASM-75.
- **`GET /reports/cases/export` is fully synchronous** — `{ rows, rowCount }` returned directly
  from one request; no job/queue/status-polling infrastructure exists for it (unlike
  `DOCUMENT_SCAN_JOB_TYPE`/`EMAIL_DISPATCH_JOB_TYPE`, which ARE real queued jobs elsewhere in
  this same backend). See ASM-76.
- **`ReportsService.managerDashboard()`'s per-owner workload has no `User` join** — `ownerId`
  is the only identifying field per row; the frontend does not call `GET /users` to resolve a
  display name (would be a manual frontend join the backend didn't provide). See ASM-77.
- **`ReportsService.executiveDashboard()`/`managerDashboard()` both allow EITHER
  EXECUTIVE_DIRECTOR or DEPARTMENT_MANAGER** — there is no ED-only vs. DM-only split on the
  backend; the Dashboard page's tab switch is available to both roles identically.
- **Revenue/receivables are grouped by currency, never summed** (`ReportsService`'s own Phase
  14 fix, cited in its source comment) — the frontend renders each `{currency, amount}` pair
  via `Money` individually, never adds them together.

### F08 implementation notes / discrepancies

Confirmed directly against the live `PortalController`/`PortalService`/`PortalAccessService`
and every domain service Portal delegates into. **F08 required zero backend changes** — the
second domain phase (after F07) with no DEC entry:

- **`PortalService` resolves `principal → allowed Student → latest Case` server-side on every
  Case-scoped call** (`resolveCase`) — the frontend never trusts `:id` from the URL as
  authorized; every sub-page's own data call independently re-verifies via `PortalStudentShell`
  first (`GET /portal/students/:id`, the same 404-on-unauthorized this whole surface relies on).
- **Portal has no Visa-checklist endpoint** — `getVisa` returns a plain `Visa`, no `include`.
  See ASM-79.
- **Enrollment/Contract are list-only on the Portal side** — no detail route for either, no
  Enrollment mutation at all. See ASM-80.
- **There is no `GET /portal/dashboard`-style aggregate endpoint** — the Overview page
  composes the same per-domain endpoints every dedicated sub-page uses. See ASM-82.
- **Evidence submission (`.../roadmap/milestones/:id/evidence`,
  `.../applications/checklist/:id/evidence`) requires the document to have been uploaded by
  the calling principal themselves** (`409 DOCUMENT_NOT_OWNED` via
  `PortalService.assertDocumentUploadedBySelf` otherwise) — always a fresh F07 `uploadDocument`
  call first, never re-attaching an already-shared document. See ASM-83.
- **`PortalUpdateTaskStatusDto` accepts only `IN_PROGRESS`/`DONE`** — narrower than the full
  staff `TaskStatus` enum; BLOCKED/CANCELLED/NOT_STARTED stay staff-only, but the underlying
  FSM (`TasksService.applyStatusTransition`) is the exact same one, so a `409
  INVALID_TASK_STATUS_TRANSITION`/`BLOCKER_REQUIRED` is still always possible and surfaced
  verbatim.
- **`FieldPolicyService.redactTaskForPortal` is unconditional**, not role-varying like every
  other `redact*` method — `blocker`/`qualityScore`/`ownerId` are always `null` regardless of
  Student-vs-Parent. See ASM-86.
- **`GET /portal/me` is the sole source of the linked-child list** — `relationship` is
  `"SELF"` when the caller IS the student, or the real `StudentContact.relationship` text
  otherwise; never inferred from email/name/role.
- **Notification navigation from inside `/portal` is Portal-aware**, not F07's staff-route
  event map — a new `portalNotificationHref` resolves the same real event names to
  `/portal/students/:id/...` destinations, and can link `TASK_*` events (a real Portal Task
  route exists) that F07's staff inbox never could. See ASM-81.
- **The staff-side Parent invite/revoke trigger did not exist before this phase** — added to
  the existing `/students/[id]` page's Contacts card (`students:edit`-gated, same as its
  existing "+ Thêm" button). See ASM-84.
- **`/public/portal/invite/[token]`** is the one deliberately unauthenticated route this phase
  adds, `@Public()`-backed (`PublicParentInvitationsController`) — the raw token IS the
  authorization, same pattern as every other public token-redemption link in this app. See
  ASM-85.

Source of truth for every convention/shape below: `docs/api/API_CONVENTIONS.md` +
`apps/api/src/**`. Nothing here invents an endpoint, field, or behavior not already
implemented in the backend. The full endpoint list (100+ routes across every domain) already
exists, verbatim and current, in `docs/api/API_CONVENTIONS.md` §11 — this document does not
duplicate it route-by-route (duplication would drift out of sync as the backend evolves).
Instead: §1 covers every cross-cutting convention the frontend must implement once (in
`lib/api/`), and §2 maps each **frontend feature area** to its backend resource(s), auth
requirement, scope model, and response shape, pointing back to API_CONVENTIONS.md §11 for the
exact route list of that resource.

## 1. Cross-cutting conventions (implemented once, in `lib/api/client.ts`)

### 1.1 Authorization header

Every authenticated request: `Authorization: Bearer <access-token>` (JWT, 15 min TTL by
default — `AUTH_ACCESS_TOKEN_TTL_MINUTES`). Issued by `POST /auth/login` (or MFA verify, or
`POST /auth/refresh`). `lib/api/client.ts`'s `apiFetch` attaches this from a single
swappable token-getter (today: a placeholder always returning `null` — see
`FRONTEND_ARCHITECTURE.md` §9); F02 wires it to the real session.

### 1.2 httpOnly refresh cookie

`POST /auth/login`/`refresh`/MFA-verify also set a `refresh_token` cookie
(`httpOnly`, `SameSite: strict`, path `/auth`) — **the frontend never reads or writes this
cookie directly**; it exists purely for `POST /auth/refresh` to pick up automatically. `
apiFetch` sends `credentials: "include"` so the browser forwards it whenever present.
Frontend code must never store a copy of the refresh token itself (e.g. in `localStorage`) —
the cookie is the only copy that should exist client-side.

### 1.3 401 — unauthenticated

No valid/non-revoked session at all. `lib/auth/`'s session bootstrap (F02) should distinguish
this from a real error: on the *initial* app load a 401 from `GET /auth/me` just means
"anonymous visitor," not a crash. On any *subsequent* call, a 401 means the session
expired/was revoked mid-use (logout elsewhere, admin-forced revoke, `AUTH_ACCESS_TOKEN_TTL_
MINUTES` elapsed) — the UI should attempt one `POST /auth/refresh`, and if that also fails,
clear `AuthContext` and redirect to login. (F02 scope — not implemented yet.)

### 1.4 403 — permission denied

The caller's role has no grant on `(resource, action)` at all — a *coarse*, role-level deny,
independent of which record. Render this as a real "not allowed" state (per master context's
required 403 UI state), never a silent empty list — the caller should understand *why*
nothing loaded. `FRONTEND_PERMISSION_MAP.md` lets a page pre-emptively hide an action the
caller's role could never have anyway (better UX — no round-trip just to get denied), but the
403 handling path must still exist for every mutating call, since a page's own
permission-map read can be wrong/stale and the backend is the actual authority
(`frontend_prompts` MASTER_CONTEXT: no client-side authorization decisions).

### 1.5 404 — not found OR out of scope (deliberately indistinguishable)

`docs/security/RBAC_MATRIX.md` §3: a record that doesn't exist and a record that exists but
is outside the caller's scope (not their Case, not their linked Student, ...) return the
**same** `404`, by design (SRS AC-02 non-enumeration — a 403 here would itself leak "this
record exists"). The frontend must render both as one generic "not found" state — it must
never attempt to distinguish them (e.g. by trying a second request, or inferring from a list
view) and must never say something like "you don't have permission to view this" for a 404,
since that phrasing itself would be a distinguishability leak.

List endpoints apply the equivalent scope filter server-side — an out-of-scope row never
appears in a paginated result at all, so a list page needs no special out-of-scope handling,
only the generic empty state.

### 1.6 Error contract

Every non-2xx response (400/401/403/404/409/422/429/500):

```json
{ "error": { "code": "STRING_CODE", "message": "...", "requestId": "...", "details": [...] } }
```

`lib/api/client.ts` parses this into `ApiError { status, code, message, requestId, details }`
— a domain hook/component branches on `error.code` (e.g. `INVALID_CREDENTIALS`,
`ACCOUNT_LOCKED`, `DOCUMENT_ARCHIVED`, `IDEMPOTENCY_KEY_REUSED`, ...), never on `error.message`
(the message is for humans, not program logic, and can be reworded server-side without
notice).

### 1.7 Pagination

Every list endpoint: `?page=1&limit=20&sort=field:asc&search=...` (page-based, `limit` max
100, `sort` whitelisted per endpoint server-side — an unsupported field/direction is
`400 INVALID_SORT`, never silently ignored). Response:

```json
{ "data": [...], "meta": { "page": 1, "limit": 20, "totalItems": 42, "totalPages": 3 } }
```

`lib/api/types.ts` already defines `PaginatedResponse<T>`/`PaginationMeta` for this — every
future list-page hook returns this exact shape, never a bare array (master context:
"pagination/filter server-side khi backend hỗ trợ" — a frontend page must never fetch
everything and paginate client-side once the backend already paginates).

### 1.8 `X-Request-Id`

Echoed on every response (success or error) and included in every error body
(`error.requestId`) and every audit-log row server-side. Worth surfacing in an error toast/
detail ("mã lỗi: <requestId>") so a user can report a specific failure precisely — not
required for F01's scaffold, a UX nicety for whichever phase builds the first real error
surface.

### 1.9 Idempotency

Mutating endpoints marked `@Idempotent()` in API_CONVENTIONS.md §11 (e.g. `POST /students`,
`POST /contracts`, `POST /payments/:id/record`) expect an `Idempotency-Key: <client-uuid>`
header on retries of the *same logical action* (e.g. a double-click or a network-timeout
retry) — same key + same body replays the stored response without re-running the handler;
same key + different body is `409 IDEMPOTENCY_KEY_REUSED`. A future mutation hook for one of
these endpoints should generate one UUID per *user-initiated attempt* (not per HTTP retry —
those should reuse the same key) and never reuse a key across genuinely different actions.

### 1.10 Audit behavior

Purely a backend-side concern (`@Audit('ACTION')` on the relevant routes,
`docs/api/API_CONVENTIONS.md` §7) — the frontend does not need to do anything to make an
action audited, and must never assume an action *wasn't* audited just because the UI didn't
show a confirmation (a denied 401/403 attempt is audited too, `result: 'DENIED'`/`'ERROR'`).
The one frontend-relevant implication: `EXPORT` actions (`GET /students/export`, `/contracts/
export`, `/payments/export`, `/reports/cases/export`) require a mandatory `reason` query
param server-side (SRS 6.21) — any export UI must collect and send a reason, not treat it as
optional.

## 2. Frontend feature → backend resource map

One row per feature area (not per individual route — see the intro). "Scope" is the
`ScopeKind` from `docs/security/RBAC_MATRIX.md` §3 (GLOBAL = every role holding the
permission sees every row; CASE_MEMBER/OWN_STUDENT/OWN_LEAD = narrowed per caller,
server-side, never client-computed). Full route list: API_CONVENTIONS.md §11, same resource
name.

| Feature area | Resource(s) | Scope | Response shape | Mutation semantics |
|---|---|---|---|---|
| Leads | `leads` | `OWN_LEAD` (SALES_MARKETING) / GLOBAL (ED/DM) / NONE (everyone else) | list: paginated; detail: single record | **Implemented F03**: `POST` create (`@Idempotent`), `PATCH` edit, `PATCH .../status` (FSM, `lib/leads/hooks.ts` `useUpdateLeadStatus`), `PATCH .../assign`, `POST .../convert` (`@Idempotent`, creates Student+Case, `LeadConvertDialog` handles the `409 DUPLICATE_STUDENT_CANDIDATES` re-confirmation round trip) |
| Students | `students` | CASE_MEMBER via linked Case (CONSULTANT/DOCUMENT_SPECIALIST) / GLOBAL (ED/DM) / OWN_STUDENT (portal, separate `/portal/*` routes) | list/detail paginated/single, **field-redacted** (`budget`/`budgetCurrency` nulled for roles without finance access — never re-derive this client-side) | **Implemented F03**: `POST` create (`@Idempotent`), `PATCH` edit, `PATCH .../archive`. `GET .../export` (reason required) — **not built** (out of F03 scope, no export UI). Contacts (`GET/POST students/:id/contacts`) — implemented (F03), lives in the `portal` backend module despite being a Student sub-resource. |
| Cases | `cases` | CASE_MEMBER (any member = view; `OWNER` only = manage) / GLOBAL | list/detail | **Implemented F03**: stage/status/close each a dedicated sub-route, never a bare field PATCH; member add/remove/reassign-owner each their own action. Case creation has no bare `POST /cases` — only `POST /students/:id/cases` (`lib/students/api.ts` `createCaseForStudent`, launched from the Student detail page). Case Tasks (`GET /cases/:id/tasks`) exist on the backend but were **not built** in F03 (no `/tasks` route in F01's route map; a dedicated Task feature is later-phase scope) — documented as a known limitation, not a silent gap. |
| Contracts | `contracts` | `CONTRACT_ROLE_SCOPE`: GLOBAL (ED/DM/ADMIN_FINANCE) / OWN_STUDENT (portal) / **NONE** (CONSULTANT/DOCUMENT_SPECIALIST — deliberately does NOT follow Case scope) | list/detail, field-redacted (value/currency/threshold) for roles with NONE scope (defense-in-depth — they're already denied earlier) | **Implemented F04**: full lifecycle `/contracts`, `/contracts/[id]` — submit → approve/reject → send → sign → amendments → status (ACTIVE/COMPLETED/LIQUIDATED/ARCHIVED, linear); `approve` requires EXECUTIVE_DIRECTOR specifically once at/above the contract's snapshotted threshold, surfaced verbatim (`APPROVAL_THRESHOLD_EXCEEDED`) |
| Payments | `payments` | same `CONTRACT_ROLE_SCOPE`, resolved one hop through parent Contract | **no bare list** — always via `GET /contracts/:contractId/payments`, or a single `GET /payments/:id` | **Implemented F04**: `/contracts/[id]/payments` (installment list + create), payment detail/record/refund/waive as a dialog (no standalone `/payments/[id]` route — none mapped in F01). `record`/`refund`/`waive` are separate actions, never a bare edit; overpayment requires an explicit resubmit-with-confirm (`allowOverpayment`), mirroring F03's Lead-convert conflict pattern |
| Tasks | `tasks` | reuses Student/Case `ROLE_SCOPE` + owner-or-case-OWNER manageability | list/detail | **Not built** (F04 or earlier) — no `/tasks` route in F01's map; Milestone's own `.../tasks` sub-endpoints exist but are unused for the same reason (F03/F04 shared limitation) |
| Assessments | `assessments` | reuses Student/Case `ROLE_SCOPE` | list per Case (plain array), detail incl. `criteria` | **Implemented F04**: `/cases/[caseId]/assessments`, `/assessments/[id]` — version list, criteria upsert (`gap` always server-computed, never recalculated client-side), submit/approve/reject |
| Roadmaps | `roadmaps` | reuses Student/Case `ROLE_SCOPE` | list per Case (plain array), detail incl. `milestones` | **Implemented F04**: `/cases/[caseId]/roadmaps`, `/roadmaps/[id]` — submit/approve/reject/status, milestone create/edit/status/add-dependency inline on the roadmap detail page (no separate milestone route) |
| Profile evidence (Academic/Test/Competition/Research/Activity) | `profile_evidence` | reuses Student/Case `ROLE_SCOPE` | list per Case per sub-type (5 plain arrays) | **Implemented F04**: `/cases/[caseId]/profile` (tabbed) — create/edit per sub-type, `verify` (Academic/Test/Activity only, gated on `profile_evidence:edit`, not a distinct action), duplicate-test-attempt conflict (`409 DUPLICATE_TEST_ATTEMPT`) surfaced verbatim |
| Writing (Artifact/Version/LOR) | `writing` | reuses Student/Case `ROLE_SCOPE` | list per Case (plain array), detail incl. `versions` | **Implemented F04**: `/cases/[caseId]/writing-artifacts`, `/writing-artifacts/[id]` — status FSM, new-version-only (no content edit endpoint exists), per-version review + Comment-entity-backed feedback (reuses F03's Comment API). LOR tracking is a card on the list page (no dedicated route — F01 never mapped one) |
| Admission master data | `admission_master` (University/Program/ScholarshipMaster) | GLOBAL, permission-gated only (shared catalog, no per-record scope) | list/detail | **Implemented F05**: `/universities`, `/programs`, `/scholarship-masters` — `create`/`edit`/`verify` ED/DM-only; `verify` is its own action, distinct from `edit`. `409 DUPLICATE_UNIVERSITY`/`DUPLICATE_PROGRAM`/`DUPLICATE_SCHOLARSHIP_MASTER` each carry a single `existing*Id` (never a candidates array — confirmed against the live `assertNoDuplicate` implementations), surfaced via the shared `DuplicateConflictNotice` component with a link to the real conflicting record |
| University choices / Applications / Offers / Scholarship applications | `university_choices`, `applications`, `offers`, `scholarship_applications` | reuse Student/Case `ROLE_SCOPE` (Offer resolves one hop through parent Application; UniversityChoice is **student**-scoped via `/students/:studentId/university-choices`, not case-scoped, though it carries an optional `caseId` linkage) | list/detail, ScholarshipApplication field-redacted (`internalNotes`) for STUDENT_PARENT; Program/Application/UniversityChoice/ScholarshipApplication list+detail additionally embed a parent-entity summary (DEC-11) | **Implemented F05**: Application `submit` requires every required checklist item DONE/WAIVED (`409 CHECKLIST_INCOMPLETE` otherwise, never pre-checked client-side); duplicate-active-application is `409 ACTIVE_APPLICATION_EXISTS` (not "DUPLICATE_APPLICATION" — a real code-vs-planning-doc discrepancy, code wins); Offer `respond` is ACCEPT/DECLINE only and **is NOT idempotent** — a second response to an already-resolved offer is a genuine `409 INVALID_OFFER_STATE`, rendered as a real error, never treated as a silent success; ScholarshipApplication eligibility is two plain fields on the entity (`eligibilityConfirmed`/`eligibilityNotes`, set via `confirm-eligibility`), not a separate endpoint; `award`/`reject` reachable only from UNDER_REVIEW/INTERVIEW, never linking a Contract/Payment record |
| Visa / Enrollment | `visa`, `visa_checklist_templates` (GLOBAL master data), `pre_departure`, `enrollment` | reuse Student/Case `ROLE_SCOPE`, both `caseId`-required | list/detail, field-redacted (`internalNotes`) for STUDENT_PARENT | Visa has dedicated `submit`/`appointment`/`interview`/`result` actions, never a bare status PATCH |
| Partners / Commission | `partner`, `partner_programs`, `partner_documents`, `partner_student_links`, `commission_rules`, `commission_transactions` | GLOBAL, permission-gated only — **no Case-membership layer at all**, unlike every domain above | list/detail, Partner field-redacted (`internalNotes`) for DOCUMENT_SPECIALIST | CommissionTransaction has a long dedicated FSM (`confirm-eligibility → calculate → approve → mark-payable → pay`, or `cancel`) — never a bare status PATCH |
| Documents | `documents` | **grant-based, not ScopeKind-based** — GLOBAL roles bypass, everyone else needs an explicit `DocumentAccess` row (VIEW/DOWNLOAD/EDIT/SHARE); download additionally gated on `scanStatus === 'CLEAN'` | single record (**no `GET /documents` list route exists on the backend at all** — confirmed against `DocumentsController`, see ASM-71; always reached via an owning record's evidence field or a known id) | **Implemented F07** — `/documents` (lookup+upload hub), `/documents/upload`, `/documents/[id]` (full metadata, edit, share, archive, create-version). `upload`/`createVersion` use `apiUpload` (multipart, F02 foundation); `share` is additive-only, no list-grants/revoke endpoint exists (ASM-72); version history walks backward only via `previousVersionId`, no `nextVersionId` (ASM-73). `EvidenceDocumentLink` (F04) now also links to `/documents/[id]` |
| Notifications | *(self-service, no permission resource)* | `recipientId === caller` always, any authenticated role | list | **Implemented F07** — `/notifications` (F02's bell badge foundation, `useUnreadNotificationCount`, now links here); mark-read only, 404 if not the caller's own; no bulk "mark all read" endpoint exists — the inbox loops the single-item action over the current page's unread rows (ASM-75); event→navigation map transcribed from real `notify(...)` call sites, TASK_* events get no link since no Task detail route exists anywhere in this app (ASM-74) |
| Reports | `reports` | `view` (every staff role, further role-narrowed inside the service for executive/manager); `export` ED/DM-only | aggregated, not paginated the same way (dashboard-shaped, not a list) | `cases/export` requires `reason`, fully **synchronous** (no job/status/async-download flow — ASM-76) |
| Admin / Identity — Users | `users` | GLOBAL, SYSTEM_ADMIN (full) / EXECUTIVE_DIRECTOR (`view` only, no `suspend`/`offboard`) | list/detail | `suspend`/`reactivate`/`offboard` SYSTEM_ADMIN-only |
| Admin / Identity — Audit logs | `audit_logs` | GLOBAL, EXECUTIVE_DIRECTOR/SYSTEM_ADMIN only | list | read-only, viewing it is itself audited |
| Admin / Identity — Jobs | `jobs` | GLOBAL, SYSTEM_ADMIN only | list/detail | read-only (background job status observability) |
| Portal (all sub-resources) | `portal` (class-level `access` gate) + the underlying domain resource's own scope, resolved OWN_STUDENT/revocation-aware | see `FRONTEND_ROUTES.md` PORTAL section | list/detail, narrower field set than the staff equivalent (e.g. Task's `blocker`/`qualityScore`/`ownerId` always stripped) | **Implemented F08** — narrow, portal-specific action set only (milestone/checklist evidence submit, task output/status, mark-notification-read reused from F07) — never the full staff mutation surface. `PortalService` delegates straight into the existing Phase 05-10 domain services (`ApplicationsService`/`VisasService`/`ContractsService`/... — confirmed by reading the live service), so every Portal type in `lib/portal/types.ts` reuses the SAME staff type (`Application`/`Visa`/`Enrollment`/`Contract`/`Payment`/`ScholarshipApplication`) rather than duplicating it |

## 3. What F01 does not map

Individual field names/DTO shapes per entity — those belong to the domain phase that
implements each feature, read directly from the real backend response at that time (per
`frontend_prompts` "Không tự tạo API giả"), not guessed in advance and risked going stale
before that phase starts.
