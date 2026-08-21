# FRONTEND BUILD STATUS — Phase F01 (scaffold), updated F02 (auth/shell), F03 (CRM), F04 (Commercial + Profile/Counseling)

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
be picked up by an unattended `npm run test:e2e`.
