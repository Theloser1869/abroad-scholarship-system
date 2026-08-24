# FRONTEND BUILD STATUS — Phase F01 (scaffold), updated F02 (auth/shell), F03 (CRM), F04 (Commercial + Profile/Counseling), F05 (Admission), F06 (Visa + Pre-departure + Enrollment + Partner), F07 (Documents + Notifications + Reporting), F08 (Student/Parent Portal), F09 (UX Hardening + Accessibility + Performance), F10 (QA + Security + UAT + Release Gate), F11 (Production Preparation + Deployment Readiness), F11A (Same-Origin Frontend/API Proxy Architecture)

## Stack versions (as actually installed)

| Package | Version |
|---|---|
| next | 16.3.1 |
| react / react-dom | 19.2.8 |
| typescript | ^5 (repo root pins `5.9.3` separately for `database/**`; `apps/web` uses whatever `^5` resolves to in this lockfile) |
| tailwindcss / @tailwindcss/postcss | ^4 |
| eslint / eslint-config-next | ^9 / 16.3.1 |
| @tanstack/react-query | ^5.101.4 *(added F02 — DEC-08)* |
| vitest | ^4.1.11 *(added F02)* |
| @vitejs/plugin-react / vite-tsconfig-paths | ^4.7.0 / ^6.1.1 *(added F02)* |
| happy-dom | ^20.11.6 *(added F02 — see Known Issues)* |
| @testing-library/react / dom / jest-dom / user-event | ^16.3.2 / ^10.4.1 / ^7.0.1 / ^14.6.5 *(added F02)* |
| Node (this environment) | v22.11.0 |
| npm | 11.7.0 |

Package manager: **npm**, npm workspaces — unchanged from F01.

## Scripts (root `package.json`)

```
npm run web:dev         # next dev -p 3001 (see FRONTEND_AUTH.md §11 — port chosen to avoid apps/api's default 3000)
npm run web:build       # next build
npm run web:start       # next start -p 3001
npm run web:lint        # eslint
npm run web:typecheck   # tsc --noEmit
npm run web:test        # vitest run   (added F02)
```

## Validation results — Phase F02

| Step | Command | Result |
|---|---|---|
| Install | `npm install` (root, after each dependency addition) | PASS, 0 vulnerabilities introduced by any F02 package (see `npm audit` below — the 3 pre-existing findings are unchanged, unrelated to `apps/web`). |
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors (includes `*.test.ts(x)` files — `tsc`'s `include` covers them). |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack), 5 static routes (`/`, `/_not-found`, `/dashboard`, `/login`, `/portal`) + 1 proxy entry, 0 errors, 0 warnings. |
| Tests | `npm run web:test` | **PASS** — 9 test files, **50 tests, 50 passed**. |

### Test coverage (F02 instruction §30/§31)

| Area | File | What's covered |
|---|---|---|
| API client | `lib/api/client.test.ts` (13 tests) | success mapping, error mapping for 400/403/404/409/422/429/500, 404 non-enumeration (missing vs. out-of-scope produce identical `ApiError` shape), single-flight refresh (3 concurrent 401s → exactly 1 `POST /auth/refresh`), refresh-failure clears token + notifies, no refresh-retry loop on `/auth/login` itself, refresh body is always `{}` |
| Token store / security | `lib/auth/token-store.test.ts` (3 tests) | in-memory clear works, session-expired listener registration/unregistration, **`document.cookie` getter is never invoked across a full login→logout cycle** |
| Auth state machine | `lib/auth/auth-context.test.tsx` (6 tests) | bootstrap → UNAUTHENTICATED (refresh fails), bootstrap → AUTHENTICATED (refresh+`/auth/me` succeed), bootstrap → ERROR (unexpected failure), login success populates `displayUser`, login failure stays UNAUTHENTICATED without crashing, logout clears state + redirects |
| Login UI + MFA | `components/auth/login-form.test.tsx` (5 tests) | role-based post-login redirect (staff → `/dashboard`, STUDENT_PARENT → `/portal`), Vietnamese error message on `INVALID_CREDENTIALS` + **password never appears in any `console.log` call**, `ACCOUNT_LOCKED` message using `lockedUntil`, full MFA-challenge round trip |
| RBAC data | `lib/permissions/use-permissions.test.ts` (9 tests) | `can`/`canAny`/`canAll` against real per-role grants (SYSTEM_ADMIN zero business access, only STUDENT_PARENT has `portal:access`, CONSULTANT zero contracts/payments, ADMIN_FINANCE zero students/cases, unknown role never defaults to allow) |
| Permission-gated UI | `components/shell/require-permission.test.tsx` (3 tests) | renders children when allowed, renders forbidden state when denied, unauthenticated defaults to forbidden (never allow) |
| Nav visibility | `components/shell/sidebar.test.tsx` (3 tests) | capability-driven item visibility per role, whole-group hiding when every item in a group is denied |
| Protected-route boundary | `components/shell/require-auth.test.tsx` (4 tests) | loading state for INITIALIZING, renders children for AUTHENTICATED, redirects (`?next=`) for UNAUTHENTICATED, error state for ERROR |
| App shell / user menu | `components/shell/user-menu.test.tsx` (4 tests) | renders nothing with no session, shows login-response display name, falls back to role label when `displayUser` is null, logout button calls `logout()` |

Not covered by automated tests (documented, not silently skipped): live browser interaction
against the real deployed backend (would need both servers running — see "Known issues"
below), MFA enrollment (not built, §5 of `FRONTEND_AUTH.md`), notification-bell polling
behavior beyond a single render.

## Backend regression check

| Step | Command | Result |
|---|---|---|
| API typecheck | `npm run api:typecheck` | PASS — 0 errors (unchanged). |
| API lint | `npm run api:lint` | PASS — 0 errors, 7 pre-existing warnings (unchanged). |

`git status --short apps/api/ database/ docs/api/ docs/security/ docs/architecture/` returned
empty — confirmed zero backend files touched in F02. The full DB-backed backend unit/e2e
suite was not re-run in this phase: since no backend file changed at all, typecheck+lint
(both deterministic, both clean, both matching the pre-F02 baseline exactly) are sufficient
evidence of no regression: there is no code path a DB-backed test could exercise differently
than before.

## Known issues

- **`npm audit`: same 3 pre-existing high-severity findings** in the `prisma`/
  `@prisma/config`/`deepmerge-ts` chain (GHSA-ggr8-5vv4-36mx) — unrelated to any F01/F02
  frontend package; not fixed for the same reason as F01 (would force a breaking `prisma`
  downgrade, backend-maintenance scope). No new finding introduced by any F02 dependency.
- **jsdom (Next.js's own documented Vitest environment) does not work in this
  Node/npm combination** — its `@asamuzakjp/css-color` dependency does `require()` on an
  ESM-only file (`ERR_REQUIRE_ESM`), unrelated to any code in this repo. Worked around by
  using `happy-dom` instead (`vitest.config.mts`) — functionally equivalent for this phase's
  tests (DOM + Testing Library), documented as a deviation from Next's own guide rather than
  silently swapped without explanation.
- Login/MFA/refresh flows are verified by mocked-fetch unit tests only in this phase — not
  exercised against a live running `apps/api` instance from the browser. A manual smoke test
  (`npm run web:dev` + a local/remote `apps/api`, with `CORS_ALLOWED_ORIGINS` including
  `http://localhost:3001` — see `FRONTEND_AUTH.md` §11) is recommended before F03 builds real
  data-fetching pages on top of this foundation, though every piece of logic (single-flight
  refresh, error mapping, state transitions) is covered by the unit tests above.
- `EBADENGINE` warning (Node vs. `eslint-visitor-keys`) — unchanged from F01, non-blocking.

## Validation results — Phase F03

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack); routes now include `/leads`, `/leads/[id]`, `/students`, `/students/[id]`, `/cases`, `/cases/[id]` alongside F01/F02's routes. |
| Tests | `npm run web:test` | **PASS** — 18 test files, **88 tests, 88 passed** (50 carried over from F02 unchanged + 38 new F03 tests). |

### F03 test coverage

| Area | File | What's covered |
|---|---|---|
| Leads list | `app/(staff)/leads/page.test.tsx` | forbidden state for a role without `leads:view`, owner-name rendering (DEC-09), empty state, generic error state + requestId on 500, create-permission gating, create-via-dialog round trip |
| Lead detail | `app/(staff)/leads/[id]/page.test.tsx` | detail rendering incl. owner name, exact 404-non-enumeration copy, forbidden state for a role with no `leads` grant at all, status-transition/convert actions hidden once the lead is CONVERTED (terminal state) |
| Lead conversion | `components/crm/leads/lead-convert-dialog.test.tsx` | clean conversion navigates to the response's Case ID, `409 DUPLICATE_STUDENT_CANDIDATES` re-renders with the backend's own candidates and resubmits with `confirmMatch: MERGE`/`mergeIntoStudentId`, `CREATE_NEW` path |
| Students list | `app/(staff)/students/page.test.tsx` | forbidden state, list rendering, 404-non-enumeration on a scope-denied list call, redacted `budget: null` never crashes rendering |
| Student detail (360) | `app/(staff)/students/[id]/page.test.tsx` | profile/contacts/cases sections render from the API, 404-non-enumeration copy, `Lưu trữ` hidden for a role without `students:archive` (RBAC hidden action) |
| Cases list | `app/(staff)/cases/page.test.tsx` | forbidden state, student/owner name rendering (DEC-09), empty state |
| Case detail | `app/(staff)/cases/[id]/page.test.tsx` | header + members rendering, 404-non-enumeration copy, every manage action (stage/status/owner/close/+ member) hidden for DOCUMENT_SPECIALIST (`cases:view` only), status-transition FSM call, a failing close precondition (`OPEN_TASKS_REMAIN`) surfaced verbatim |
| Shared list/error states | `components/crm/query-states.test.tsx` | 404 and 403 both render the identical non-enumeration copy, generic 500 message + requestId + retry callback, non-`ApiError` exceptions, empty/loading states |
| Pagination | `components/crm/pagination-controls.test.tsx` | hidden at zero results, Trước/Sau disabled at the boundary pages, `onPageChange` called with the backend-driven page number |

Not covered by automated tests (documented, not silently skipped): live browser interaction
against a running `apps/api` instance (same F02 limitation, still unresolved — no local/staging
backend was reachable in this environment); Case Tasks (feature not built, see
`FRONTEND_API_MAP.md`); the `UserPicker` component's `users:view`-gated search path (only its
manual-UUID-fallback path is exercised indirectly through the dialogs that embed it).

## Backend regression check — Phase F03

`git status --short apps/api/ database/ docs/api/ docs/security/` shows exactly the DEC-09
change set (`leads.service.ts`, `cases.service.ts`, `case-query.dto.ts`, two e2e spec files) —
already validated in full before F03's frontend work began: `npm run api:typecheck` PASS,
`npm run api:lint` PASS (0 new warnings), unit 182/182 PASS, full e2e 478/478 PASS + 4 new
targeted DEC-09 assertions PASS, all run against the local Docker Postgres test database (never
the production Supabase instance). No backend file changed since that validation, so it was not
re-run in full for this report; `npm run api:typecheck` was re-confirmed PASS as a final sanity
check.

## Validation results — Phase F04

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack); routes now include `/contracts`, `/contracts/[id]`, `/contracts/[id]/payments`, `/cases/[caseId]/assessments`, `/assessments/[id]`, `/cases/[caseId]/roadmaps`, `/roadmaps/[id]`, `/cases/[caseId]/profile`, `/cases/[caseId]/writing-artifacts`, `/writing-artifacts/[id]` alongside every F01–F03 route. |
| Tests | `npm run web:test` | **PASS** — 26 test files, **128 tests, 128 passed** (88 carried over from F03 unchanged + 40 new F04 tests). |

### F04 test coverage

| Area | File | What's covered |
|---|---|---|
| Contracts list | `app/(staff)/contracts/page.test.tsx` | forbidden state, student-name rendering (DEC-10), empty state, generic error + requestId on 500, create-permission gating, create-via-dialog round trip (manual Student-ID fallback for ADMIN_FINANCE) |
| Contract detail | `app/(staff)/contracts/[id]/page.test.tsx` | header + amendment history rendering, 404-non-enumeration copy, Duyệt/Từ chối hidden for ADMIN_FINANCE (`contracts:approve` is ED/DM-only), submit-for-review via the dedicated endpoint, `APPROVAL_THRESHOLD_EXCEEDED` surfaced verbatim |
| Contract payments | `app/(staff)/contracts/[id]/payments/page.test.tsx` | forbidden state, installment list with server-computed `isOverdue`, refund round trip (amount + required reason), Hoàn tiền/Miễn/Ghi nhận hidden for STUDENT_PARENT, `OVERPAYMENT_NOT_ALLOWED` 409 conflict re-confirmed with `allowOverpayment: true` |
| Assessment detail | `app/(staff)/assessments/[id]/page.test.tsx` | version/status + criteria rendering (backend's own `gap`, never recomputed), 404-non-enumeration copy, Duyệt/Từ chối hidden for CONSULTANT, criterion upsert never sends a client-computed `gap`, reject requires a reason |
| Roadmap detail | `app/(staff)/roadmaps/[id]/page.test.tsx` | version/status + milestones rendering, Duyệt/Từ chối hidden for CONSULTANT, approve via the dedicated endpoint, `PREREQUISITE_NOT_DONE` surfaced with its exact unmet-task IDs |
| Profile evidence (tabbed) | `app/(staff)/cases/[caseId]/profile/page.test.tsx` | forbidden state, Academic tab default rendering, `DUPLICATE_TEST_ATTEMPT` 409 surfaced verbatim (never silently merged), every `+ Thêm` create button hidden for DOCUMENT_SPECIALIST, Competition tab renders its own real fields |
| Writing artifact detail | `app/(staff)/writing-artifacts/[id]/page.test.tsx` | header/status + version-history rendering, 404-non-enumeration copy, review/version/status actions hidden for STUDENT_PARENT, version-review via the dedicated endpoint (never a bare edit), actions hidden once SUBMITTED (terminal) |
| Writing artifacts + LOR list | `app/(staff)/cases/[caseId]/writing-artifacts/page.test.tsx` | forbidden state, artifact list + LOR tracking card rendering side by side, LOR `contactEmail`/`contactPhone` redaction for STUDENT_PARENT never crashes and hides the edit/create actions, artifact creation round trip |

Not covered by automated tests (documented, not silently skipped): live browser interaction
against a running `apps/api` instance (same F02/F03 limitation, unresolved this phase either);
Milestone Task creation/listing (feature not built, see `FRONTEND_API_MAP.md`); removing a
milestone dependency (no read endpoint exists to discover one to remove, see
`FRONTEND_API_MAP.md`); the `UserPicker`/`StudentPicker` search-path (only their manual-fallback
paths are exercised, same limitation as F03).

### A real bug found and fixed via testing — native form validation silently blocking submission

Writing the criterion-upsert test (`AssessmentDetailPage`) surfaced a genuine, production-
relevant bug: `CriterionDialog`'s `<input type="number" step="0.01">` fields, combined with the
browser's native HTML5 constraint validation, silently blocked form submission for a value like
`9.5` — a well-known cross-engine floating-point quirk (`9.5 % 0.01 !== 0` in binary floating
point, so a spec-compliant step-validation algorithm can reject a value that is visually and
semantically valid). This is not a test-environment-only artifact — the same failure mode can
occur in a real browser. Fixed by adding `noValidate` to every F04 form containing a `type=
"number"`/`step` field (11 files — this codebase already does its own React-state-driven
validation and never relies on native constraint-validation UI, matching the established pattern
elsewhere in the app). A second, related bug was found the same way: `UserPicker`'s manual-
fallback `<input>` hard-coded `required`, silently blocking two new F04 forms
(`MilestoneFormDialog`, `WritingArtifactFormDialog`) that use it for a genuinely optional field
— fixed by adding a `required` prop (default `true`, preserving every F03 call site) instead of
scattering more `noValidate` fixes around the symptom.

## Backend regression check — Phase F04

`git status --short apps/api/ database/ docs/api/ docs/security/` shows exactly the DEC-10
change set (`contracts.service.ts`, `field-policy.service.ts`, one e2e spec file). Validation:

| Step | Command | Result |
|---|---|---|
| API typecheck | `npm run api:typecheck` | **PASS** — 0 errors. |
| API lint | `npm run api:lint` | **PASS** — 0 errors, 7 pre-existing warnings (unchanged, same baseline as F02/F03). |
| API unit tests | `npm run api:test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F03 — no unit test touches Contract's `list()`/`getById()` directly). |
| API e2e tests | `npm run api:test:e2e -- --runInBand` | **PASS** — 25 suites, **480 tests, 480 passed**, including the 1 new DEC-10 assertion in `contracts.e2e-spec.ts`. Run serially (`--runInBand`) against the local Docker Postgres test database for a contention-free, definitive result — an earlier parallel-worker run of the same suite produced 6 spurious suite failures (5 confirmed distinct: `portal`, `admission-application`, `pre-departure-enrollment-closure`, `payments`, `r2-storage-provider`), all pure `Exceeded timeout of 30000 ms` errors from CPU/DB-connection contention across parallel workers on this sandboxed machine, not logic failures — all 5 re-ran clean (114/114) once resource contention was removed, confirming they were environmental flakiness, not a regression from DEC-10 (which touches only `Contract.list()`/`getById()` and a generic-signature change to `FieldPolicyService.redactContract`, neither reachable from any of those 5 suites' domains). |

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were overridden
as shell environment variables for every test invocation this phase (dotenv does not override
already-set `process.env` values), never by editing the git-ignored root `.env` file itself.

### Safety note: root `.env` currently points at production

Discovered, not caused, this phase: the repository's root `.env` (git-ignored, not committed)
currently has `DATABASE_URL`/`DIRECT_URL` pointing at the live production Supabase instance —
apparently left over from the prior session's production admin-bootstrap work (see git log
`badbe68`). This is a real hazard for any future session that runs `npm run api:test:e2e` (or
`db:seed`/`db:migrate:dev`) without noticing, since e2e tests create/delete real rows. This
phase's own first test invocation hit exactly this: `npm run db:migrate:deploy` (a read-only
"any pending?" check, confirmed harmless — "No pending migrations to apply") ran against
production before the issue was noticed; every subsequent command in this phase explicitly
overrode `DATABASE_URL`/`DIRECT_URL` to the local `docker-compose.yml` Postgres
(`localhost:55432`) instead. **Recommended follow-up** (not performed here — out of this
phase's scope and would require confirming with whoever last used the production connection
intentionally): restore the root `.env`'s `DATABASE_URL`/`DIRECT_URL` to the local Docker
Postgres for everyday development, keeping the production connection string somewhere it can't
be picked up by an unattended `npm run test:e2e`. Still true at the start of F05 — Docker
Desktop was not running at all when this phase began (containers had to be started fresh); the
same shell-level override discipline was applied to every F05 test invocation.

## Validation results — Phase F05

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack); routes now include `/universities`, `/universities/[id]`, `/programs`, `/programs/[id]`, `/scholarship-masters`, `/scholarship-masters/[id]`, `/students/[id]/university-choices`, `/cases/[caseId]/applications`, `/applications/[id]`, `/applications/[applicationId]/offers`, `/offers/[id]`, `/cases/[caseId]/scholarship-applications`, `/scholarship-applications/[id]` alongside every F01–F04 route (31 total). |
| Tests | `npm run web:test` | **PASS** — 37 test files, **174 tests, 174 passed** (128 carried over from F04 unchanged + 46 new F05 tests across 11 new test files). |

### F05 test coverage

| Area | File | What's covered |
|---|---|---|
| Universities list | `app/(staff)/universities/page.test.tsx` | forbidden state, list rendering, empty state, `409 DUPLICATE_UNIVERSITY` surfaced verbatim with a link to the real existing record, create-permission gating, create-via-dialog round trip |
| University detail | `app/(staff)/universities/[id]/page.test.tsx` | detail rendering, Sửa/Xác minh hidden for view-only roles, verify via the dedicated `admission_master:verify` action (distinct from `edit`) |
| Programs list | `app/(staff)/programs/page.test.tsx` | University-name rendering via the DEC-11 embed, `409 DUPLICATE_PROGRAM` surfaced verbatim, create hidden for SALES_MARKETING (catalog browsing only) |
| Scholarship masters list | `app/(staff)/scholarship-masters/page.test.tsx` | list rendering (kept visually/structurally distinct from ScholarshipApplication), create-via-dialog round trip |
| University choices (student-scoped) | `app/(staff)/students/[id]/university-choices/page.test.tsx` | forbidden state, Reach/Match/Safety tier+status rendering, STUDENT_PARENT sees no status `<select>`/edit/review actions, `409 DUPLICATE_UNIVERSITY_CHOICE` surfaced without a link (no standalone detail route), status change via plain-field PATCH (the one F05 entity with no dedicated FSM action) |
| Applications list | `app/(staff)/cases/[caseId]/applications/page.test.tsx` | forbidden state, University/Program rendering via the DEC-11 embed, `409 ACTIVE_APPLICATION_EXISTS` surfaced verbatim (never a separate pre-check request), status filter re-queries the server |
| Application detail | `app/(staff)/applications/[id]/page.test.tsx` | forbidden state, embedded-checklist rendering, `409 CHECKLIST_INCOMPLETE` on submit surfaced verbatim (no client-side checklist precheck), `409 INVALID_APPLICATION_STATUS_TRANSITION` with its real `allowedTransitions` rendered, Nộp hồ sơ hidden once already SUBMITTED, every action hidden for STUDENT_PARENT |
| Offers list (per Application) | `app/(staff)/applications/[applicationId]/offers/page.test.tsx` | forbidden state, full offer history kept visible (never overwritten) with the current offer highlighted, empty state, create round trip |
| Offer detail | `app/(staff)/offers/[id]/page.test.tsx` | forbidden state, accept via the dedicated respond action, Accept/Decline hidden once already resolved, a raced second respond surfaces the real `409 INVALID_OFFER_STATE` as an error — **never treated as a silent success** |
| Scholarship applications list | `app/(staff)/cases/[caseId]/scholarship-applications/page.test.tsx` | forbidden state, ScholarshipMaster-name rendering via the DEC-11 embed, empty state |
| Scholarship application detail | `app/(staff)/scholarship-applications/[id]/page.test.tsx` | forbidden state, eligibility-unconfirmed gate rendering, `409 ELIGIBILITY_NOT_CONFIRMED` surfaced verbatim on a premature submit, award round trip (never creating a Contract/Payment record), reject via the dedicated action, actions hidden once AWARDED (terminal), `internalNotes` rendered exactly as returned (`null` when redacted for STUDENT_PARENT) |

Not covered by automated tests (documented, not silently skipped): live browser interaction
against a running `apps/api` instance (same F02–F04 limitation, unresolved this phase either);
Milestone dependency removal and Milestone Tasks (pre-existing F04 gaps, unrelated to F05);
`ProgramPicker`/`UniversityPicker`/`ScholarshipMasterPicker`'s empty-search-result rendering path
(only the successful-match path is exercised in tests, matching the same depth as `StudentPicker`/
`UserPicker` coverage in F03/F04).

### A real testing-library ambiguity re-encountered — always-mounted edit dialogs

The exact `getByText`-doesn't-respect-visibility ambiguity F04 already documented (a closed
native `<dialog>`'s content still matches `getByText`/`findByText` in happy-dom, unlike
`getByRole` which correctly excludes it) recurred in F05's `UniversityChoiceRow`,
`ScholarshipApplicationDetailContent`, `OfferDetailContent`, and `ApplicationDetailContent` —
every per-row/detail component keeps its own edit/action dialog always-mounted (just closed),
and that dialog frequently repeats the same field text the visible row/header already shows
(program name, tier label, "SCH-2026-00001"-style codes sharing a `<p>` with other text, dialog
confirm buttons sharing a header action button's label). Fixed the same way each time:
`getAllByText`/`findAllByText` with a `.length > 0` assertion instead of the singular form, or —
when the ambiguous text sits inside a mixed-content element (a code + linked name in the same
`<p>`) — querying the page's own unique `<h1>` heading via `getByRole("heading", {...})` instead
of the ambiguous text directly. No production code changes were needed for this one (unlike
F04's two real bugs) — purely a test-query precision issue, but recorded here since it recurred
across four different F05 files and is clearly a recognizable pattern for future phases to
anticipate up front rather than rediscover by trial and error.

## Backend regression check — Phase F05

`git status --short apps/api/ database/ docs/api/ docs/security/` shows exactly the DEC-11
change set (4 service files, 1 field-policy file, 3 e2e spec files). Docker Desktop was not
running at all at the start of this phase — started fresh, then both containers
(`abroad-scholarship-postgres`, `abroad-scholarship-minio`) came up healthy within seconds.
Validation:

| Step | Command | Result |
|---|---|---|
| API typecheck | `npm run api:typecheck` | **PASS** — 0 errors. |
| API lint | `npm run api:lint` | **PASS** — 0 errors, 7 pre-existing warnings (unchanged, same baseline as F02–F04). |
| API unit tests | `npm run api:test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F04 — no unit test touches the four DEC-11 services' `list()`/`getById()` directly). |
| API e2e tests | `npm run api:test:e2e -- --runInBand` | **PASS** — 25 suites, **484 tests, 484 passed** (480 carried over from F04's baseline + 4 new DEC-11 assertions: 1 in `admission-master-data.e2e-spec.ts` for Program→University, 2 in `admission-application.e2e-spec.ts` for UniversityChoice→Program and Application→Program, 1 in `admission-offer-scholarship.e2e-spec.ts` for ScholarshipApplication→ScholarshipMaster). Run serially (`--runInBand`) against the local Docker Postgres test database from the start this phase (no parallel-worker run attempted, having already confirmed in F04 that parallel-worker flakiness on this sandboxed machine is purely environmental contention, not a real signal worth re-discovering). One test-fixture assertion (`admission-application.e2e-spec.ts`'s new DEC-11 test) initially failed against a default `limit: 20` page size — not a DEC-11 logic bug, but this shared dev database accumulating Applications on the fixture Case across many repeated e2e runs over the project's history, pushing the seeded fixture off page 1; fixed by requesting `limit: 100` explicitly in that one assertion, matching the same accommodation the Program-choice test already made. |

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were overridden
as shell environment variables for every test invocation this phase (dotenv does not override
already-set `process.env` values), never by editing the git-ignored root `.env` file itself.

## Validation results — Phase F06

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack); routes now include `/cases/[caseId]/visas`, `/visas/[id]`, `/visa-checklist-templates`, `/cases/[caseId]/pre-departure`, `/cases/[caseId]/enrollments`, `/enrollments/[id]`, `/partners`, `/partners/[id]`, `/partners/[partnerId]/commission-rules`, `/commission-transactions`, `/commission-transactions/[id]` alongside every F01–F05 route (42 total). |
| Tests | `npm run web:test` | **PASS** — 61 test files, **225 tests, 225 passed** (174 carried over from F05 unchanged + 51 new F06 tests across 13 new test files). |

### F06 test coverage

| Area | File | What's covered |
|---|---|---|
| Visa checklist templates | `app/(staff)/visa-checklist-templates/page.test.tsx` | forbidden state, GLOBAL catalog rendering (distinct from a Visa's own checklist instance), create round trip, `409 DUPLICATE_VISA_CHECKLIST_TEMPLATE` surfaced verbatim |
| Visa detail | `app/(staff)/visas/[id]/page.test.tsx` | forbidden state, checklist rendering alongside the header, submit re-verifying the checklist gate server-side (`409 CHECKLIST_INCOMPLETE` surfaced verbatim, never pre-blocked client-side), scheduling an appointment (SUBMITTED → APPOINTMENT), every action hidden once GRANTED (terminal), STUDENT_PARENT redaction (`internalNotes` → null, no edit action) with `reason`/`interviewNotes` never redacted |
| Visa list (case-scoped) | `app/(staff)/cases/[caseId]/visas/page.test.tsx` | forbidden state, list rendering, create round trip (no global `/visas` list exists) |
| Pre-departure | `app/(staff)/cases/[caseId]/pre-departure/page.test.tsx` | forbidden state, server-reported progress count (never a client-computed "complete" flag), free-text `category` on create, STUDENT_PARENT read-only rendering |
| Enrollment list (case-scoped) | `app/(staff)/cases/[caseId]/enrollments/page.test.tsx` | forbidden state, embedded University/Program summary rendering (DEC-12), `409 INVALID_ENROLLMENT_TARGET` surfaced verbatim on an invalid offer |
| Enrollment detail | `app/(staff)/enrollments/[id]/page.test.tsx` | forbidden state, `409 CONFIRMED_ENROLLMENT_EXISTS` surfaced verbatim, withdraw via plain confirm-then-mutate (no dialog, no payload), every action hidden once WITHDRAWN (terminal), STUDENT_PARENT redaction |
| Partners list | `app/(staff)/partners/page.test.tsx` | forbidden state, catalog rendering, `409 DUPLICATE_PARTNER` create round trip |
| Partner detail | `app/(staff)/partners/[id]/page.test.tsx` | forbidden state, every sub-section rendering (Programs/Documents/StudentLinks/CommissionTransactions + Commission Rules link-out), PartnerProgram create via the page's own Dialog (no standalone route) |
| Commission rules (partner-nested) | `app/(staff)/partners/[partnerId]/commission-rules/page.test.tsx` | forbidden state, list rendering (config data, never a fact that happened), FIXED-basis create with `fixedAmount`, activate/deactivate toggle |
| Commission transactions list | `app/(staff)/commission-transactions/page.test.tsx` | forbidden state, global list rendering with `calculatedAmount` formatted via the shared `Money` component |
| Commission transaction detail | `app/(staff)/commission-transactions/[id]/page.test.tsx` | forbidden state, `409 PARTNER_STUDENT_LINK_REQUIRED` surfaced verbatim (a real non-obvious precondition), `calculate()` never computed client-side (only calls the endpoint and renders the server's own result), pay round trip reaching the terminal PAID state, every action hidden once CANCELLED (terminal), STUDENT_PARENT has zero visibility (finance-internal data) |
| PartnerDocument row | `components/crm/partner-documents/partner-document-row.test.tsx` | editable-only-while-DRAFT (Sửa/Kích hoạt hidden once ACTIVE — a signed version is a new row, never an in-place edit), activate round trip, every mutating action hidden for a read-only viewer |
| PartnerStudentLink row | `components/crm/partner-student-links/partner-student-link-row.test.tsx` | rendering, archive round trip (no hard delete — Hard Rule #5), archive hidden once ARCHIVED (terminal) or for a read-only viewer |

Not covered by automated tests (documented, not silently skipped): live browser interaction
against a running `apps/api` instance (same F02–F05 limitation, unresolved this phase either);
`VisaAppointmentDialog`/`VisaInterviewDialog`'s `type="datetime-local"` input's exact
serialization format against class-validator's `@IsDateString()` (exercised via mocked API calls
only, not against a live backend); CommissionRule's `partnerProgramId`-scoped creation path
(only partner-wide rule creation is exercised); `EvidenceDocumentLink`'s download-request flow
(same F04/F05-established depth — only the link-rendering path is exercised, not the actual
download trigger).

### A note on Partner sub-resource route scoping — no new testing-library ambiguity this phase

Unlike F05 (which re-encountered the always-mounted-dialog `getByText` ambiguity four times),
F06 largely avoided it by querying unique row-only text (e.g. "Ưu tiên" in `CommissionRuleRow`,
never repeated in its own create/edit dialog) or `findByRole` directly (which correctly waits
for and excludes closed-dialog content) instead of `findByText` on a label repeated inside an
always-mounted Dialog. One instance was caught and fixed during this phase's own test-writing
(`commission-rules/page.test.tsx`'s toggle test originally raced against the create dialog's
`<option>` text before the list had loaded) — recorded here as the same class of issue, not a
new one.

## Backend regression check — Phase F06

`git status --short apps/api/ database/ docs/api/ docs/security/` shows the DEC-12 change set
(4 service files, 1 field-policy file, 2 e2e spec files) plus DEC-09/10/11's still-uncommitted
files from prior sessions (5 more service files, 3 more e2e spec files) — none of the backend
DEC fixes have been committed yet (only `feat(frontend): implement frontend phases F01-F04` has
landed on `main` so far); this phase added to that pre-existing uncommitted set rather than
touching anything outside it. Docker Desktop was not running at the start of this phase —
started fresh, then both containers (`abroad-scholarship-postgres`, `abroad-scholarship-minio`)
came up healthy within seconds. Validation:

| Step | Command | Result |
|---|---|---|
| API typecheck | `npm run api:typecheck` | **PASS** — 0 errors. |
| API lint | `npm run api:lint` | **PASS** — 0 errors, 7 pre-existing warnings (unchanged, same baseline as F02–F05). |
| API unit tests | `npm run api:test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F05 — no unit test touches the four DEC-12 services' list/detail paths directly). |
| API e2e tests | `npm run api:test:e2e -- --runInBand` | **PASS** — 25 suites, **488 tests, 488 passed** (484 carried over from F05's baseline + 4 new DEC-12 assertions: 1 in `pre-departure-enrollment-closure.e2e-spec.ts` for Enrollment→University/Program, 3 in `partners.e2e-spec.ts` for PartnerProgram→Partner/Program and PartnerStudentLink/CommissionTransaction→Partner/Student in both of their respective list contexts). Run serially (`--runInBand`) against the local Docker Postgres test database. The first two full-suite attempts this phase were killed by unrelated Windows/environment instability before completing — the first crashed mid-run on a `kill EPERM` error inside `jest-worker` while force-exiting a timed-out worker (Windows-specific child-process permission issue, confirmed unrelated to any DEC-12 file since the failures visible before the crash were in `documents-platform`/`jobs-platform`/`r2-storage-provider`, none of which import the four touched services), which also left zombie `node` worker processes holding DB connections that caused the second attempt to fail near-instantly; both were cleaned up (`Stop-Process` on the leaked `node` processes) before a third attempt completed cleanly. That third run reported exactly one failure — `portal.e2e-spec.ts`'s "a private document download is audited" (expected `200`, got `403`) — surrounded in the log by `DOCUMENT_SCAN` background-job retries/dead-letters, the same class of job-processing timing flakiness already documented in F04's regression notes; re-run in isolation it passed clean (**30/30**), confirming environmental flakiness under this run's resource contention, not a DEC-12 regression (`field-policy.service.ts`'s only DEC-12 change is `redactEnrollment`, unrelated to document audit/download logic). |

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were overridden
as shell environment variables for every test invocation this phase (dotenv does not override
already-set `process.env` values), never by editing the git-ignored root `.env` file itself.

## Validation results — Phase F07

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings (one `waitFor` unused-import warning caught and fixed in `dashboard/page.test.tsx` during this phase). |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack); routes now include `/documents`, `/documents/upload`, `/documents/[id]`, `/notifications`, `/reports` (5 new), plus `/dashboard` fleshed out from its F01 placeholder into real role-routed content (same path, not counted as new) — 47 routes total alongside every F01–F06 route. |
| Tests | `npm run web:test` | **PASS** — 57 test files, **250 tests, 250 passed** (225 carried over from F06 unchanged + 25 new F07 tests across 6 new test files plus one existing shared component's own new test file). |

### F07 test coverage

| Area | File | What's covered |
|---|---|---|
| Document detail | `app/(staff)/documents/[id]/page.test.tsx` | forbidden state, full metadata rendering with download available when CLEAN, download disabled + pending banner while scanStatus PENDING, download blocked + danger banner when INFECTED, metadata edit round trip, Sửa/Lưu trữ hidden once ARCHIVED (Share stays available — the backend's own `share` action has no archived check), previous-version link walks backward only, STUDENT_PARENT sees view+download only (no edit/share/archive) |
| Document upload | `app/(staff)/documents/upload/page.test.tsx` | forbidden state (SALES_MARKETING has no `documents` grant at all), successful upload navigating to the new document's detail page, non-blocking `duplicateOfId` surfaced as an informational toast |
| Documents hub | `app/(staff)/documents/page.test.tsx` | forbidden state, ID lookup navigation, upload entry point visibility |
| Notifications inbox | `app/(staff)/notifications/page.test.tsx` | real event→label/icon rendering (never the raw event string for a known event), unmapped-event fallback with no fabricated navigation link, click-to-open marks read and navigates via the real event→href map, Unread tab + channel filter both backend-driven (not a client-side slice), bulk "mark all read (trang này)" looping the single-item endpoint |
| Dashboard | `app/(staff)/dashboard/page.test.tsx` | forbidden state, EXECUTIVE_DIRECTOR sees the Executive tab with per-currency Money display, switching to the Manager tab shows the raw `ownerId` (no name join exists), CONSULTANT (non-leadership) sees only the self-scoped `/reports/me` view |
| Reports export | `app/(staff)/reports/page.test.tsx` | forbidden state for `reports:view`-but-not-`export` (CONSULTANT), reason-length gating before the export button enables, rendering the backend's returned rows exactly as sent, empty-scope result shows a real empty state (never a fabricated zero row) |
| Notification bell | `components/shell/notification-bell.test.tsx` | links to `/notifications` in the staff shell, stays a non-interactive badge in the Portal shell (F08 owns the Portal inbox, not F07) |

Not covered by automated tests (documented, not silently skipped): live browser interaction
against a running `apps/api` instance (same F02–F06 limitation, unresolved this phase either);
the actual multipart `apiUpload`/`apiDownloadBlob` wire behavior against a live backend (only
the mocked API-layer contract is exercised); `EvidenceDocumentLink`'s new "Chi tiết" link was
not given its own dedicated test file (it is exercised indirectly wherever `EvidenceDocumentLink`
already renders in existing F04–F06 page tests, all of which still pass unchanged); the CSV
`Blob`/`URL.createObjectURL` download trigger on `/reports` (jsdom/happy-dom does not
meaningfully simulate a file save, so only the button's presence/absence is asserted, not the
downloaded file's bytes).

### A note on this phase's one real test bug — an ambiguous multi-match, not a new failure class

`documents/[id]/page.test.tsx`'s INFECTED-scan test originally asserted
`screen.findByText(/Nhiễm mã độc/)` — but BOTH the scan-status badge and the danger banner
contain that substring simultaneously (two distinct real elements, not an always-mounted-dialog
duplicate like F04–F06's recurring pattern), so the query threw as ambiguous. Fixed by asserting
on `screen.findByRole("alert")`'s `textContent` specifically instead of a page-wide text search —
the same general lesson (query the most specific role/scope available) as F04–F06's dialog
ambiguities, just a different concrete cause this time.

## Backend regression check — Phase F07

**Zero backend files touched this phase.** `git status --short apps/api/ database/ docs/api/
docs/security/` shows exactly the same DEC-09/10/11/12 change set already uncommitted from
prior sessions — nothing new added or modified. Docker Desktop's two containers
(`abroad-scholarship-postgres`, `abroad-scholarship-minio`) were already running and healthy at
the start of this phase (`docker ps` confirmed both `Up`/`healthy`) — no fresh start needed,
unlike F06. Since the backend is genuinely untouched, this is a baseline-confirmation run, not a
new-fix validation:

| Step | Command | Result |
|---|---|---|
| API typecheck | `npm run api:typecheck` | **PASS** — 0 errors. |
| API lint | `npm run api:lint` | **PASS** — 0 errors, 7 pre-existing warnings (unchanged, same baseline as F02–F06). |
| API unit tests | `npm run api:test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F06's baseline — confirms no unit regression). |
| API e2e tests | `cd apps/api && npx jest --config jest.e2e.config.js --runInBand` (invoked directly, bypassing the npm-workspace `--` argument-forwarding limitation F06 documented) | **PASS** — 25 suites, **488 tests, 488 passed** (unchanged from F06's baseline — confirms no e2e regression). Ran cleanly on the first attempt this phase, no `kill EPERM`/zombie-process saga this time. The three `ERROR`-level log lines visible in the run output (`job will retry type=TEST_TRANSIENT_...`, two `job FAILED (dead-letter)` lines) are `JobRunnerService`'s own intentional test fixtures exercising retry/dead-letter behavior, not real failures — Jest's own summary confirms 488/488 passed with zero failures. |

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were overridden
as shell environment variables for both test invocations this phase, never by editing the
git-ignored root `.env` file itself.

## Validation results — Phase F08

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack); routes now include `/portal`, 16 `/portal/students/[id]/...` sub-routes, and `/public/portal/invite/[token]` (18 new) alongside every F01–F07 route — 64 routes total. |
| Tests | `npm run web:test` | **PASS** — 70 test files, **289 tests, 289 passed** (250 carried over from F07 unchanged + 39 new F08 tests across 13 new test files, plus 2 new tests extending the existing F03 `students/[id]/page.test.tsx`). |

### F08 test coverage

| Area | File | What's covered |
|---|---|---|
| Cache privacy | `lib/api/query-keys.test.ts` | every `portal.student.*` key embeds `studentId`; two different students produce completely distinct keys across all nine domain areas; the doubly-nested Contract→Payments key is distinct per (studentId, contractId) pair |
| Notification links | `lib/portal/notification-links.test.ts` | Portal-aware href resolution (never F07's staff routes), TASK_* events resolve (unlike the staff inbox), null on missing payload id, null on a staff-only event |
| Portal shell | `components/portal/portal-student-shell.test.tsx` | renders header+children on success, shows the exact non-enumerating 404 message (never children) on any authorization failure |
| Student switcher | `components/portal/student-switcher.test.tsx` | hidden for a lone accessible student, renders + switches (navigates to the new student's Overview) for a multi-child Parent |
| Portal home | `app/(portal)/portal/page.test.tsx` | empty state (zero students), auto-redirect (one student), picker cards + no auto-navigation (multiple students) |
| Portal layout (RBAC) | `app/(portal)/portal/layout.test.tsx` | staff role (CONSULTANT) sees the exact forbidden message, STUDENT_PARENT sees the shell |
| Roadmap | `app/(portal)/portal/students/[id]/roadmap/page.test.tsx` | empty state, progress+milestones rendering with no "complete" action anywhere, two-step evidence upload (upload then submit) |
| Task detail | `app/(portal)/portal/students/[id]/tasks/[taskId]/page.test.tsx` | never renders staff-only fields even conceptually, FSM-narrowed status buttons (no direct NOT_STARTED→DONE), a real `409 INVALID_TASK_STATUS_TRANSITION` surfaced verbatim, output submit |
| Documents | `app/(portal)/portal/students/[id]/documents/page.test.tsx` | download offered only for CLEAN-scanned documents |
| Application detail | `app/(portal)/portal/students/[id]/applications/[applicationId]/page.test.tsx` | university/program/checklist rendering with no submit/status action, currentOffer rendering, checklist-evidence upload targeting the exact item |
| Visa detail | `app/(portal)/portal/students/[id]/visa/[visaId]/page.test.tsx` | reason/interviewNotes render (never redacted), internalNotes never renders even when null, no fabricated checklist section |
| Notifications | `app/(portal)/portal/students/[id]/notifications/page.test.tsx` | mark-read + Portal-aware navigate, empty state |
| Parent invitation (public) | `app/(public)/public/portal/invite/[token]/page.test.tsx` | accept with optional credentials → success state, a real `409 INVALID_OR_USED_INVITATION` surfaced verbatim with no navigation |
| Staff invite/revoke (extends F03) | `app/(staff)/students/[id]/page.test.tsx` | invites a NONE-status contact, revokes an ACTIVE contact's access after confirmation |

Not covered by automated tests (documented, not silently skipped): live browser interaction
against a running `apps/api` instance (same F02–F07 limitation, unresolved this phase either);
the Portal Overview page's own parallel-fetch composition (each of its nine hooks is unit-
tested individually via its dedicated sub-page's own test, not the Overview page itself as a
combined whole); `apiUpload`'s real multipart wire behavior for evidence submission (only the
mocked API-layer contract is exercised, same depth as F07); the Tasks/Applications/
Scholarships/Visa/Enrollment/Contracts LIST pages (each a thin, low-risk wrapper around the
same `PortalStudentShell` + a single list hook + `StatusBadge` already exercised by their
sibling detail-page tests — not independently tested this phase, mirroring F04-F07's own
"list pages get lighter coverage than detail/mutation pages" pattern).

### A note on this phase's test-environment fixes — established conventions rediscovered, not new bugs

Three of this phase's own new tests initially failed against real conventions this codebase
already established: `ToastProvider`'s always-present (but empty) toast region defeats a bare
`toBeEmptyDOMElement()` container check (fixed by asserting on the specific control's absence
instead); a mutation's `mutationFn` closing over an outer `studentId`/`contractId` parameter
means the mocked API function receives BOTH arguments, not just the one passed to
`mutateAsync` (fixed the assertion, not the code — the extra argument was always correct);
`window.confirm` must be assigned directly (`window.confirm = vi.fn(...)`), not
`vi.spyOn(window, "confirm")` (happy-dom doesn't implement a real `confirm` to spy on) — F04's
`enrollments/[id]/page.test.tsx` had already established this exact pattern. Separately, a real
new lesson: a `use(params)`-consuming page needs its OWN `<Suspense>` boundary to be testable
at all outside a full route render — this phase's public invite page initially lacked one
(unlike every staff/portal page, which already wrapped their `use(params)` call in a
`*PageInner` + `<Suspense>` split); fixed by adding the same split, and the test switched to
exercising the inner form component directly (`AcceptInvitationForm`), matching the
established "test the `*Content`/inner component, not the params-consuming default export"
convention F04-F07 already used everywhere else.

## Backend regression check — Phase F08

**Zero backend files touched this phase.** `git status --short apps/api/ database/ docs/api/
docs/security/` shows exactly the same DEC-09/10/11/12 change set already uncommitted from
prior sessions — nothing new added or modified. Docker Desktop's two containers were already
running and healthy at the start of this phase (`docker ps` confirmed both `Up`/`healthy`) —
no fresh start needed. Since the backend is genuinely untouched, this is a baseline-
confirmation run:

| Step | Command | Result |
|---|---|---|
| API typecheck | `npm run api:typecheck` | **PASS** — 0 errors. |
| API unit tests | `npm run api:test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F07's baseline — confirms no unit regression). |
| API e2e tests | `cd apps/api && npx jest --config jest.e2e.config.js --runInBand` | **PASS** — 25 suites, **488 tests, 488 passed** (unchanged from F07's baseline — confirms no e2e regression). Ran cleanly on the first attempt. The `ERROR`-level log lines visible in the run output (`DOCUMENT_SCAN` retry, three `JobRunnerService` `TEST_*` fixture lines) are intentional test fixtures exercising retry/dead-letter behavior, not real failures — Jest's own summary confirms 488/488 passed with zero failures. |

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were
overridden as shell environment variables for every invocation this phase, never by editing
the git-ignored root `.env` file itself.

## Validation results — Phase F09

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — `next build` (Turbopack); 64 routes, all static pages generated (21/21). Confirms the three route-folder renames (see `FRONTEND_ROUTES.md`'s F09 note) compile cleanly with no leftover slug conflicts. |
| Tests | `npm run web:test` | **PASS** — 73 test files, **305 tests, 305 passed** (289 carried over from F08 + 16 new F09 tests: `ConfirmDialog` 4, `SearchInput` 2, `crmErrorMessage` details-array fallback 5, `login-form` redirect-hardening 3, `PortalStudentShell` cross-child isolation 1, plus the moved `applications/[id]/offers` test file unchanged). |

### F09 UX/accessibility/security hardening — what changed and why

| Change | Files | Why |
|---|---|---|
| `ConfirmDialog` (new shared component) replaces every `window.confirm(...)` | 11 call sites across 8 files (case member removal, document/partner/scholarship-application/partner-program/partner-document/partner-student-link archive or activate, enrollment withdraw, portal access revoke) | F09 instruction: destructive actions must use the shared `Dialog`, never a browser-native `confirm()` (no title/description control, not stylable, not testable the same way as the rest of the app's modals). |
| `Textarea` (new shared component) replaces 25 files' duplicated raw `<textarea className="...FORM_CONTROL_CLASSES...">` | 25 dialog/form files | Same pattern repeated ≥2 times → shared component, per F09's component-consistency rule; `Input`'s `FORM_CONTROL_CLASSES` extracted and reused so both share one visual/focus definition. |
| `SearchInput` (new shared component) replaces 7 list pages' duplicated debounced-search `<Input type="search">` block | `leads`, `partners`, `programs`, `scholarship-masters`, `students`, `universities`, `visa-checklist-templates` list pages | Same search-field UX (typed value + a visible clear control) was hand-rolled per page; centralizing it also fixed a duplicate-clear-icon bug (native WebKit search-cancel button was showing alongside the custom ✕). |
| Focus-visibility ring added to `Input`/`Textarea`/`SearchInput` (`focus:ring-2 focus:ring-primary/30`, kept alongside the existing `focus:border-primary`) | `components/ui/input.tsx` | WCAG 2.4.7 — a border-color-only focus change is too subtle a focus indicator on some displays/zoom levels. |
| `TableHeaderCell` defaults `scope="col"` | `components/ui/table.tsx` | WCAG 1.3.1 — every table in the app already only uses `TableHeaderCell` for column headers (no row headers exist anywhere), so this is a correct blanket default, not a guess. |
| Danger-variant toasts use `role="alert"`/`aria-live="assertive"` (was `role="status"`/`"polite"`) | `components/ui/toast.tsx` | Error announcements should interrupt a screen reader, not wait for the current utterance to finish, the way a routine success toast correctly does. |
| `--muted-foreground` changed `#6b7280` → `#4b5563` | `app/globals.css` | Measured contrast on white: `#6b7280` ≈ 4.83:1 (already AA-passing) → `#4b5563` ≈ 7.56:1 (AAA-level margin), computed by the standard relative-luminance formula — muted text (table metadata, helper text, timestamps) is exactly the class of text most likely to be read at a glance or by a low-vision user. |
| `crmErrorMessage` now surfaces `ApiError.details` (class-validator field messages) when no `CODE_MESSAGES` mapping exists, before falling back to the raw message | `lib/api/error-messages.ts` | `details` had been captured on `ApiError` since early phases but never read anywhere — a real gap against F09's "422 → map to field-level message" requirement; now a validation failure without a specific `CODE_MESSAGES` entry shows the backend's actual field message instead of a generic fallback. |
| `usePortalProfile` given `staleTime: 0` | `lib/portal/hooks.ts` | This is the Portal's own authorization-probe query (F08's `PortalStudentShell`) — it must always re-check on navigation, not serve a 30s-stale answer, matching F09 §19/§27's cross-child-isolation requirement. |
| `login-form.tsx`'s `?next=` redirect now rejects `//`-prefixed (protocol-relative open-redirect) and `/login`-prefixed (self-loop) targets, falling back to the role default | `components/auth/login-form.tsx` | Security-UX hardening — an unvalidated `next` param is a classic open-redirect vector; a `/login`-prefixed one would otherwise redirect straight back to the login page after a successful login. |

None of the above changes any business rule, permission, state machine, or API contract — every
change is either a shared-component extraction of an already-identical pattern, a visual/ARIA
attribute, or a client-side redirect-target validation. See `docs/frontend/phase-status/
PHASE_F09.md` for the full audit narrative, browser-testing findings, and known issues.

## Backend regression check — Phase F09

**Zero backend files touched this phase.** Since the backend is genuinely untouched, this is a
baseline-confirmation run (re-run to confirm the existing baseline remains intact, not assumed):

| Step | Command | Result |
|---|---|---|
| API typecheck | (not re-run standalone this phase — covered by `npm run test`'s own compile step; `api:typecheck` was previously confirmed PASS at F08 and no backend file changed since) | Unchanged from F08. |
| API unit tests | `cd apps/api && npm run test` (against a local Docker Postgres, `DATABASE_URL`/`DIRECT_URL` overridden as shell env vars) | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F08's baseline). The one `ERROR`-level log line in the output is `error-contract.filter.spec.ts`'s own intentional test fixture (asserting the filter's error-logging behavior), not a real failure. |
| API e2e tests | `cd apps/api && npm run test:e2e` (same local Postgres) | **487/488 passed** on the full parallel-worker run; the one failure (`admission-application.e2e-spec.ts` › "links a Document to a checklist item and grants case access", expected `200`, got `403`) was traced to `DOCUMENT_SCAN` job storage reads failing (`Storage read failed: The specified key does not exist`) for several unrelated documents throughout the same run, under the default `STORAGE_PROVIDER=local` (filesystem) driver — consistent with a local-filesystem storage path not being shared correctly across Jest's parallel worker processes in this ad hoc local environment (the first time this project's full e2e suite has been run against a freshly-provisioned local API+Postgres in this session's history, rather than the project's existing CI/prior-session setup). Re-running the single spec file in isolation (`npx jest --config jest.e2e.config.js test/admission-application.e2e-spec.ts`) passed cleanly, **26/26**, confirming this was a local parallel-worker/storage-isolation artifact of this session's ad hoc setup, not a code regression — combined, this reconfirms the established **488/488** baseline. `admission-application.e2e-spec.ts` was not modified this phase (or any phase this session). |

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were overridden
as shell environment variables for every invocation this phase, never by editing the git-ignored
root `.env` file itself.

## Validation results — Phase F10

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Build | `npm run web:build` | **PASS** — 64 routes, 21/21 static pages generated. |
| Tests | `npm run web:test` | **PASS** — 73 test files, **306 tests, 306 passed** (305 carried over from F09 + 1 new regression test for the logout-error-handling fix found this phase). |

### F10 fix — `AuthProvider.logout()` unhandled rejection on network failure

Found via live-browser QA under real (transient) network load: `logout()` awaited the backend
call with no error handling, and its caller fires it as `void logout()` — a network failure
left the access token cleared but the React state/redirect never ran, and the rejection
surfaced as an uncaught console exception. Fixed with a `try/catch/finally` so state teardown
+ redirect happen unconditionally, matching `authApi.logout()`'s own established
best-effort-cleanup reasoning. Full detail: `docs/frontend/FRONTEND_SECURITY_REPORT.md` §6,
`docs/frontend/phase-status/PHASE_F10.md`. Zero backend files touched; regression test added
(`lib/auth/auth-context.test.tsx`).

## Backend regression check — Phase F10

**Zero backend files touched this phase** (beyond the frontend-only fix above). Re-run to
confirm the existing baseline remains intact:

| Step | Command | Result |
|---|---|---|
| API unit tests | `cd apps/api && npm run test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F09's baseline). |
| API e2e tests | `cd apps/api && npm run test:e2e` | First full-suite attempt (run concurrently with heavy frontend build/lint/test load): **461/488 passed**, 27 failures — every failure was `Exceeded timeout of 30000ms` or `ECONNRESET`, classic resource-contention symptoms from running 5 heavy processes simultaneously on this session's slow/network-mounted filesystem, not assertion failures. **Re-run in isolation** (nothing else running): **487/488 passed**, one flake (`notifications.e2e-spec.ts`'s async email-dispatch-timing assertion). **Re-ran that single spec file in isolation**: **12/12 passed**. Combined, this reconfirms the established **488/488** baseline — no code regression, purely an artifact of this session's concurrent local resource load. `notifications.e2e-spec.ts` was not modified this phase (or any phase this session). |

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were
overridden as shell environment variables for every invocation this phase, never by editing
the git-ignored root `.env` file itself.

## Validation results — Phase F11

Final, truly-clean sequence (per this phase's own §25: remove build artifacts, `npm ci`,
typecheck, lint, tests, production build — never reusing a stale `.next`):

| Step | Command | Result |
|---|---|---|
| Clean install | `rm -rf apps/web/.next`, then `npm ci` from the **workspace root** (see note below) | **PASS** — 1065 packages, 0 frontend-relevant vulnerabilities. |
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings (one transient warning from an `eslint-disable` comment made unnecessary by this phase's own `no-console` config was found and removed in the same phase). |
| Tests | `npm run web:test` | **PASS** — 73 test files, **306 tests, 306 passed** (unchanged from F10 — no test-affecting change this phase). |
| Build | `npm run web:build` (fresh `.next`) | **PASS** — 64 routes, 21/21 static pages. The new client-env validation (`next.config.ts`, this phase) correctly fired its warn-not-throw path for the local `.env.local`'s `http://localhost:3000` value (expected — no `VERCEL`/`CF_PAGES`/`RENDER`/`NETLIFY` env var present locally), confirming the logic behaves as designed without breaking the established local-QA build. |

**A real environment lesson from this phase, worth recording**: running `npm ci` from inside
`apps/web` (a workspace subdirectory) rather than the repository root pruned root-level
tooling this monorepo's OTHER workspace depends on (`prisma`'s CLI binary went missing from
`node_modules/.bin` afterward) — `npm ci` in an npm-workspaces monorepo must be run from the
**root**, never from a single workspace's own directory, or it can silently leave sibling
workspaces' tooling in an inconsistent state. Caught and corrected by re-running `npm ci` from
the root before trusting any further build/test result this phase. Also encountered and
resolved: an `EPERM: operation not permitted, unlink ...query_engine-windows.dll.node`
on the first `npm ci` attempt, caused by a still-running local `apps/api` dev server holding
the native Prisma binary open — resolved by stopping that process first (Windows file-locking
behavior, not a code issue).

## Backend regression check — Phase F11

**Zero backend files touched this phase.** Confirmation run (not a new-fix validation):

| Step | Command | Result |
|---|---|---|
| API unit tests | `cd apps/api && npm run test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged from F10's baseline). First attempt showed 9 failures (`TypeError: client_1.Prisma.Decimal is not a constructor`) caused by this phase's own `npm ci` reinstall leaving the generated Prisma client stale (`npm ci` does not run `prisma generate`) — root-caused and fixed by running `npm run db:generate`, not a code regression. See "Validation results — Phase F11" above for the full npm-workspaces lesson. |

Full e2e re-run was not repeated this phase (F10 already reconfirmed 488/488 in isolation;
zero backend code changed since, so re-running the full ~10-minute e2e suite again would only
re-prove the same unchanged baseline — the unit-test confirmation plus the unchanged
`git status` on every backend path is the appropriate-weight confirmation for a phase that
touched no backend code, consistent with F09/F10's own "confirm, don't re-validate from
scratch, when genuinely untouched" precedent).

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were
overridden as shell environment variables for every invocation this phase, never by editing
the git-ignored root `.env` file itself.

## Validation results — Phase F11A

Frontend, both configurations tested:

| Step | Command | Result |
|---|---|---|
| Typecheck | `npm run web:typecheck` | **PASS** — 0 errors. |
| Lint | `npm run web:lint` | **PASS** — 0 errors, 0 warnings. |
| Tests | `npm run web:test` | **PASS** — 73 test files, **309 tests, 309 passed** (306 carried over from F11 + 3 new: `client.test.ts`'s relative-base-URL test, `login-form.test.tsx`'s `/api` and backslash-prefix redirect-hardening tests). |
| Build — same-origin proxy config (`NEXT_PUBLIC_API_URL=/api`, `API_PROXY_TARGET=http://localhost:3000`) | `npm run build` | **PASS** — 64 routes, correctly emitted only the `API_PROXY_TARGET` http-not-https warning (expected for a local proxy target) and no warning at all for the relative `NEXT_PUBLIC_API_URL` (confirms the new relative-path validation branch works as designed). |
| Build — standard local-dev config (`NEXT_PUBLIC_API_URL=http://localhost:3000`, `API_PROXY_TARGET` unset) | `npm run build` | **PASS** — 64 routes, unchanged from every prior phase's build. Confirms the F11A changes add zero regression risk to the established local-dev-config workflow. |

**A real Git Bash / MSYS tooling artifact hit and worked around this phase**: passing
`NEXT_PUBLIC_API_URL="/api"` as an inline shell variable to a command in this session's Git
Bash shell silently mangled the value into a Windows path (`C:/Program Files/Git/api`) via
MSYS's automatic POSIX-path-to-Windows-path conversion for arguments starting with `/` — not a
code defect, worked around with `MSYS_NO_PATHCONV=1`. Recorded here since a future session
testing the same-origin proxy locally on Windows via Git Bash will hit the identical thing.

## Backend regression check — Phase F11A

**One real, minimal backend change this phase** — see `docs/frontend/FRONTEND_AUTH.md` §14.
Full validation (not a baseline-confirmation-only pass, since backend code genuinely changed):

| Step | Command | Result |
|---|---|---|
| API typecheck | `npm run api:typecheck` | **PASS** — 0 errors. |
| API lint | `npm run api:lint` | **PASS** — 0 errors, 7 pre-existing warnings in `mfa.service.spec.ts` (unrelated file, unchanged baseline since F02–F10). |
| API unit tests | `npm run api:test` | **PASS** — 14 suites, **182 tests, 182 passed** (unchanged — the cookie-Path fix has no unit-test-level coverage gap, it's exercised end-to-end at the e2e layer instead, where the actual `Set-Cookie` header is observable). |
| API e2e tests | `npm run api:test:e2e` | **490 total** (488 baseline + 2 new: the login `Set-Cookie` `Path=/` assertion and the first-ever `POST /auth/logout` test, both in `auth.e2e-spec.ts`). First full run: **487/490** — 3 failures, all resource-contention-shaped (two `Exceeded timeout of 30000ms`, one `403` that raced ahead of an async grant-creation transaction under heavy concurrent load). **Each of the 3 failing spec files re-run in isolation, all fully green**: `profile-evidence.e2e-spec.ts` 17/17, `pre-departure-enrollment-closure.e2e-spec.ts` 18/18, and the third resolved by re-running the full suite a second time cleanly. Combined, this confirms the full **490/490** baseline — the two new cookie tests pass, and no pre-existing test regressed. |

Both new e2e tests were verified to actually exercise the fix, not just added ceremonially:
temporarily reverted `REFRESH_COOKIE_PATH` back to `'/auth'` and re-ran the two new tests
(`-t "F11A"`) — **both failed exactly as expected** (`Path=/auth`, not `Path=/`, received),
confirming they would have caught this exact regression had it not been fixed. Restored the
fix immediately after and re-ran `auth.e2e-spec.ts` in full to confirm green again.

Never run against the production Supabase instance — `DATABASE_URL`/`DIRECT_URL` were
overridden as shell environment variables for every invocation this phase, never by editing
the git-ignored root `.env` file itself.
