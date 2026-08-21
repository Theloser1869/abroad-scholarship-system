# PHASE STATUS — F03 (CRM Frontend: Lead + Student + Case)

## PHASE F03 STATUS: PASS

## READY FOR F04: YES

## SUMMARY

Built the CRM frontend on top of F02's foundation: full Lead (list/detail/create/edit/
assign/status-transition/convert), Student (list/360-detail/create/edit/archive/contacts),
and Case (list/detail/stage/status-transition/close/members/owner-reassignment) feature sets,
each API-first against the real backend, with a shared Timeline view, Note form, status-badge
mapping, pagination controls, and loading/empty/error/scope-error state components reused
across all three domains. No new routes beyond F01's mapped set
(`/leads`, `/leads/[id]`, `/students`, `/students/[id]`, `/cases`, `/cases/[id]`) — every
create/edit/assign/convert/close/member-management workflow is a Dialog launched from a
list/detail page, not a separate route.

## LEADS

List (`/leads`): search (debounced), status filter, "chỉ của tôi" (own-lead) filter, real
`{data, meta}` pagination, owner column from the DEC-09 relation summary. Detail (`/leads/[id]`):
contact/interest info, permission-gated Edit/Assign/Status-transition/Convert actions,
status-transition and convert hidden once the lead is CONVERTED or LOST (terminal). Convert
flow: explains the workflow, confirms, calls `POST /leads/:id/convert`, handles the backend's
`409 DUPLICATE_STUDENT_CANDIDATES` by re-rendering with the returned candidates (MERGE with a
chosen candidate, or CREATE_NEW), navigates to the response's real Case ID on success — never
constructs a Student/Case client-side, never runs its own duplicate detection.

## STUDENTS

List (`/students`): search + `targetCountry` filter (the only filters the backend supports —
confirmed by reading `StudentQueryDto`/`StudentsService`, no invented filter). Detail
(`/students/[id]`, 360 view): profile (budget/budgetCurrency rendered exactly as returned,
`null` when redacted — never a workaround endpoint), contacts (list + add), this student's
Cases (via `GET /cases?studentId=`, the DEC-09 filter — never a client-side full-Case scan),
Timeline + Notes, Edit, Archive, "+ Case mới" (creates via `POST /students/:id/cases`, the only
Case-creation route that exists — there is no bare `POST /cases`).

## CASES

List (`/cases`): status filter only (no `search`/`owner`/`department` filter — the backend's
`CaseQueryDto`/`CasesService.list()` doesn't implement `search`, and there is no `ownerId`
filter, confirmed by reading the DTO; adding client-side filtering for unsupported fields
would violate "never fetch everything and filter client-side," so these are documented as not
offered rather than faked). Detail (`/cases/[id]`): student/owner (DEC-09 summaries), stage,
status-transition (FSM, CLOSED excluded), close (dedicated dialog, surfaces each of the 4
backend preconditions — `OPEN_TASKS_REMAIN`/`OUTSTANDING_DEBT_REMAINS`/`VISA_IN_PROGRESS`/
`ENROLLMENT_NOT_CONFIRMED`/`PRE_DEPARTURE_CHECKLIST_INCOMPLETE` — verbatim, never pre-checked
client-side), Timeline + Notes. Case Tasks (`GET /cases/:id/tasks` exists on the backend) —
**not built**: no `/tasks` route exists in F01's mapped route set, and Task is explicitly out
of F03's scope per the phase instructions; documented here as a known limitation rather than
silently worked around with a new route.

## CASE MEMBERS

`/cases/[id]` lists active members (`removedAt` filtered client-side for *display* only — the
backend is still the source of truth for who is actually a member), distinguishes
OWNER/COLLABORATOR labels, offers add (via `UserPicker`) and remove for a role with
`cases:assign`. The frontend never infers manageability from a member's `role` field — every
mutating action still hits the backend, which independently re-checks `assertManageable()`.

## CASE OWNERSHIP

Reassignment is a dedicated confirm dialog (`AssignOwnerDialog`, shared with Lead
owner-assignment) calling `POST /cases/:id/reassign-owner`; on success the query cache is
invalidated (detail + list + members + timeline), never updated optimistically ahead of the
real response.

## TIMELINE

`TimelineView` renders the backend's already-merged `TimelineEntry[]` verbatim (never
re-merges AuditLog+Comment client-side), distinguishing NOTE (further split
internal/shared-visibility) from AUDIT, and a status-transition AUDIT action from other AUDIT
actions.

## NOTES

`NoteForm` (shared across Lead/Student/Case) posts through the existing
`POST .../notes` Comment endpoint only, with an internal/shared visibility toggle — no
frontend-only note store.

## API INTEGRATION

`lib/{leads,students,cases}/api.ts` are the only modules calling the backend for these domains
(all through the shared `apiFetch`), typed against the real response shapes read directly from
`leads.service.ts`/`cases.service.ts`/`students.service.ts` — nothing invented ahead of the
backend contract. One backend gap was found and fixed (not worked around) in the course of this
phase: `docs/DECISIONS.md` DEC-09 — see "BACKEND FIX" below.

## BACKEND FIX (DEC-09 — found and fixed during F03, not a frontend workaround)

`GET /leads`, `GET /leads/:id`, `GET /cases`, `GET /cases/:id`, `GET /cases/:id/members`
returned bare `ownerId`/`studentId` foreign keys with no relation data, which would have
forced either an N+1 fetch per row or a forbidden full-table client scan just to render an
owner/student name — both explicitly disallowed by this phase's own instructions. Root-caused
and fixed backend-side with Prisma `select`-scoped relation summaries
(`{ id, username, fullName }` / `{ id, studentCode, fullName }`), deliberately never a bare
`include: { owner: true }` (which would leak `passwordHash` and other `User` columns).
`GET /cases` also gained a `studentId` filter (needed for the Student 360 view's case list,
with no separate endpoint invented). Regression evidence: `api:typecheck` PASS, `api:lint`
PASS (0 new warnings), unit 182/182 PASS, full e2e 478/478 PASS + 4 new targeted assertions
(never-leaks-`passwordHash`, `studentId` filter never bypasses scope) all PASS — see
`docs/DECISIONS.md` DEC-09 and `FRONTEND_BUILD_STATUS.md`.

## RBAC

Every action button is gated by `usePermissions().can(resource, action)` against
`lib/permissions/rbac-data.ts` — never a role-name check (verified in tests: DOCUMENT_SPECIALIST
sees a read-only Case detail with zero manage buttons; a role without `students:archive` never
sees "Lưu trữ"). One documented, real limitation: `GET /users` is `users:view`-gated
(EXECUTIVE_DIRECTOR/SYSTEM_ADMIN only), but `leads:assign`/`cases:assign` are also granted to
DEPARTMENT_MANAGER/CONSULTANT — `components/crm/user-picker.tsx` degrades to a manual
user-ID text input for any role without `users:view`, rather than calling a different
endpoint to work around the missing grant.

## SCOPE / 404

Every list/detail hook surfaces a 404 through the shared `ScopeErrorState`, which renders the
exact required copy — "Không tìm thấy hoặc bạn không có quyền truy cập." — for both a
genuinely-missing record and an out-of-scope one, never a different message for either case
(verified directly: `QueryErrorState`'s test asserts a 403 and a 404 render byte-identical
copy).

## QUERY / CACHE

`lib/api/query-keys.ts`'s per-domain factories (from F03's foundation work) drive every hook in
`lib/{leads,students,cases}/hooks.ts` — each mutation invalidates exactly the query keys it
affects (e.g. a Case member mutation invalidates `cases.members(id)` + `cases.detail(id)` +
`cases.timeline(id)`, never `queryClient.invalidateQueries()` with no key). No server state is
duplicated into local `useState` — every dialog holds only its own draft form state, never a
copy of fetched data.

## RESPONSIVE

Desktop-first (unchanged from F02's shell); list tables scroll horizontally inside the shared
`Table` component's `overflow-x-auto` wrapper on narrow viewports rather than breaking layout;
not specifically optimized for mobile (matches the phase instruction's staff-CRM priority).

## ACCESSIBILITY

Dialogs reuse F02's `<Dialog>` (native `<dialog>` + `showModal()` — real focus trap, Escape-to-
close, `aria-labelledby`) for every Create/Edit/Assign/Convert/Member/Status/Close workflow.
Forms have `<label htmlFor>` on every field and inline `role="alert"` server-error text.
Buttons carry `disabled` during submission with a "Đang..." label change. Tables use real
`<th>`/`<TableHeaderCell>` headers throughout.

## TESTS

88/88 passing (18 files: 50 carried over from F02 unchanged + 38 new). Covers Lead
list/detail/create/edit/assignment/conversion (incl. the duplicate-candidate round trip),
Student list/detail/scope-error, Case list/detail/owner/members/status-transition, RBAC
hidden-actions + forbidden state + 404 non-enumeration, and API pagination/error-state/
mutation success+failure. Full breakdown: `FRONTEND_BUILD_STATUS.md`.

## TYPECHECK

PASS — `npm run web:typecheck`, 0 errors.

## LINT

PASS — `npm run web:lint`, 0 errors, 0 warnings.

## BUILD

PASS — `npm run web:build` (Turbopack); `/leads`, `/leads/[id]`, `/students`, `/students/[id]`,
`/cases`, `/cases/[id]` now compile as real routes alongside F01/F02's.

## BACKEND REGRESSION

PASS — the only backend files touched are the DEC-09 fix (`leads.service.ts`,
`cases.service.ts`, `case-query.dto.ts`, two e2e spec files), already fully validated before
frontend work began: typecheck/lint clean, unit 182/182, full e2e 478/478 + 4 new targeted
assertions, all against the isolated local Docker Postgres test database. `api:typecheck`
re-confirmed PASS as a final sanity check at the end of this phase.

## DOCUMENTATION

Updated: `FRONTEND_ROUTES.md` (Leads/Students/Cases marked Implemented), `FRONTEND_API_MAP.md`
(§2 rows updated + DEC-09 note), `FRONTEND_PERMISSION_MAP.md` (F03 usage note + UserPicker
limitation), `FRONTEND_BUILD_STATUS.md` (F03 validation results + test breakdown + backend
regression check). Created: this file.

## FILES CREATED

`lib/api/query-keys.ts`, `lib/api/error-messages.ts`, `lib/timeline/types.ts`,
`lib/utils/use-debounced-value.ts`, `lib/utils/use-reset-on-open.ts`,
`lib/test-utils/render-with-providers.tsx`, `lib/users/{types,api}.ts`,
`lib/leads/{types,api,hooks}.ts`, `lib/students/{types,api,hooks}.ts`,
`lib/cases/{types,api,hooks}.ts`, `components/crm/{status-badge,query-states,
pagination-controls,timeline-view,note-form,user-picker,assign-owner-dialog}.tsx`,
`components/crm/leads/{lead-form-dialog,lead-status-dialog,lead-convert-dialog}.tsx`,
`components/crm/students/{student-form-dialog,student-contact-form-dialog}.tsx`,
`components/crm/cases/{case-stage-dialog,case-status-dialog,case-close-dialog,
case-member-dialog}.tsx`, `app/(staff)/leads/page.tsx`, `app/(staff)/leads/[id]/page.tsx`,
`app/(staff)/students/page.tsx`, `app/(staff)/students/[id]/page.tsx`,
`app/(staff)/cases/page.tsx`, `app/(staff)/cases/[id]/page.tsx`, plus one `*.test.ts(x)` file
per component/page listed above (9 new test files), and this phase-status file.

## FILES UPDATED

`components/shell/nav-config.ts` (Leads/Students/Cases `implemented: true`),
`lib/api/types.ts` (added shared `UserSummary`), `apps/api/src/modules/crm/leads/
leads.service.ts`, `apps/api/src/modules/case-management/cases/{cases.service.ts,
dto/case-query.dto.ts}`, `apps/api/test/{case-management,lead-conversion}.e2e-spec.ts`
(the DEC-09 backend fix + its regression tests), `docs/DECISIONS.md` (DEC-09),
`docs/frontend/{FRONTEND_ROUTES,FRONTEND_API_MAP,FRONTEND_PERMISSION_MAP,
FRONTEND_BUILD_STATUS}.md`.

## ASSUMPTIONS

- Case list has no `search`/`owner`/`department` filter because the backend doesn't implement
  them (confirmed by reading `CaseQueryDto`/`CasesService.list()`) — not offered in the UI
  rather than faked client-side.
- "Chỉ của tôi" on the Lead list filters by `ownerId === principal.userId` using the existing
  `ownerId` query param — a UX convenience, not a new backend capability.
- Case Tasks and Case closure's "checklist" entry point are out of F03 scope per the phase
  instructions' explicit exclusion list; only the Case-close dialog itself (a real, in-scope
  action) was built.

## RISKS

- `UserPicker`'s manual-UUID-input fallback (for roles without `users:view`) is usable but not
  friendly — a consultant assigning a case owner must know or be told the target user's UUID.
  This is a pre-existing backend permission-model gap (not introduced by F03), documented for a
  future phase to address (e.g. a narrower "assignable users" endpoint).
- No live-backend browser smoke test was performed in this environment (same limitation
  carried over from F02 — no reachable running `apps/api` instance here); all coverage is via
  mocked-API component/unit tests plus a clean production build.

## KNOWN ISSUES

- Case Tasks entry point not built (see "CASES" above).
- Student `GET .../export` (reason-required export) not built — no export UI in F03 scope.
- Dashboard (`/dashboard`) remains the F01 placeholder — its real per-role content was not part
  of F03's Lead/Student/Case scope.

## READY FOR F04: YES
