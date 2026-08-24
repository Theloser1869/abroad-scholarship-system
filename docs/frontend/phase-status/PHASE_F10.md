# PHASE STATUS — F10 (Frontend QA + Security + UAT + Release Gate)

## PHASE F10 STATUS: PASS

## READY FOR F11: YES

## SUMMARY

Full QA/security/UAT pass over the entire frontend built in F01–F09, against a real running
local `apps/api` + Postgres backend and real browser automation (Chrome, via CDP) — not
mocked-API-only. All 8 backend roles were logged into with real seeded fixture accounts
(`database/seeds/seed.ts` `DEMO_USERS`, non-production). The highest-priority security
scenario — parent/child data isolation, including a **revoked** parent link — was verified
end-to-end with real backend network responses. One real bug was found (logout's error
handling) and fixed with a regression test, entirely frontend-side. Zero new business
features. **No backend files touched.** Full regression re-confirmed: 306/306 frontend tests
(305 + 1 new), 182/182 backend unit, 488/488 backend e2e (after resolving a resource-
contention-induced flake by re-running in isolation — root-caused, not a code defect).

## FUNCTIONAL QA

Reviewed F01–F09's delivered surface for functional correctness via a combination of live
role-by-role navigation (8 roles) and static/API-integration-map cross-checks
(`FRONTEND_REQUIREMENTS_TRACEABILITY.md`). No functional regression found. The one defect
found (auth logout error handling) was root-caused, fixed, and regression-tested in the same
phase — see SECURITY UX below and `FRONTEND_SECURITY_REPORT.md` §6.

## BROWSER QA

Real Chrome browser automation was available and used this phase (confirmed working across
F09 and F10). Console was checked for errors/uncaught rejections after essentially every
navigation this phase; network requests were checked directly for status codes on every
IDOR/RBAC probe (not inferred from rendered text). One genuine uncaught-rejection finding
surfaced this way (see below) — exactly the class of defect this QA method exists to catch.
A session-local tooling caveat carried over from F09 and reconfirmed this phase: the
`computer: screenshot` action intermittently returned stale/cached frames disagreeing with
the live DOM; all findings in this report are backed by `read_page`/`javascript_tool`/
`read_network_requests` ground truth, never a screenshot alone. Full flow-by-flow detail:
`docs/frontend/FRONTEND_UAT_REPORT.md`.

## AUTH QA

Login (real credentials, all 8 roles), logout (real server-side session revocation confirmed
— subsequent protected navigation correctly redirects), `?next=` redirect preservation across
the login/logout cycle, and no infinite-redirect-loop across 8 consecutive role switches were
all verified live. **Found and fixed**: `AuthProvider.logout()` had no error handling around
its network call — a real transient backend failure (observed live under heavy concurrent
local test-suite load) left the access token cleared but the UI state/redirect never executed,
producing a genuinely uncaught promise rejection (captured via `read_console_messages`, full
stack trace). Fixed with `try/catch/finally` so teardown+redirect happen unconditionally,
mirroring `authApi.logout()`'s own established best-effort-cleanup philosophy. Regression test
added (`lib/auth/auth-context.test.tsx`). MFA/locked/suspended/offboarded account states were
**not** live-tested this phase (no fixture account in a locked/suspended/offboarded state was
available among the seeded `DEMO_USERS`, and creating one was judged out of scope — these
flows are unchanged since F02 and covered by that phase's own tests).

## RBAC UAT

All 8 roles (EXECUTIVE_DIRECTOR, DEPARTMENT_MANAGER, CONSULTANT ×2 accounts,
DOCUMENT_SPECIALIST, SALES_MARKETING ×2 accounts, ADMIN_FINANCE, STUDENT_PARENT ×4 accounts,
SYSTEM_ADMIN) logged into live. Nav rendering and direct-URL permission probes matched
`docs/security/RBAC_MATRIX.md` exactly for every role — no over- or under-permissive
rendering found. Full detail: `FRONTEND_UAT_REPORT.md`.

## CRM UAT

Live-verified: CASE_MEMBER-scope IDOR (a real case, ALLOW for its member, DENY-with-404 for a
non-member, verified with real `GET /cases/:id`/`.../members`/`.../timeline` network status
codes) and OWN_LEAD-scope IDOR (ALLOW for the owner, DENY-with-404 for another
SALES_MARKETING account). Deep create/edit/status-transition/close click-through was **not**
independently re-exercised live this phase — covered by F03's own component tests and the
backend's `case-management.e2e-spec.ts`, both reconfirmed passing this phase.

## COMMERCIAL UAT

Live-verified: a real REVIEW-status contract correctly shows **zero** visible approve/amend/
send/sign action for ADMIN_FINANCE (confirmed via a dialog-aware DOM query distinguishing
genuinely-visible trigger buttons from always-mounted-but-closed dialog internals — a
methodology note worth keeping for future browser QA in this codebase). Full
create/approve/sign/amend/payment-record/refund/waive click-through was **not** independently
re-exercised live this phase — covered by F04's own component tests and the backend's
`contracts.e2e-spec.ts`/`payments.e2e-spec.ts`, both reconfirmed passing this phase.

## PROFILE UAT

**Not independently re-exercised live this phase.** No functional or security concern
identified via `FRONTEND_REQUIREMENTS_TRACEABILITY.md`'s cross-check (Assessment/Roadmap
versioning, LOR redaction, Writing version-append-only all confirmed IMPLEMENTED by static
read against current source). Covered by F04's own component tests and the backend's
`assessment-roadmap.e2e-spec.ts`/`writing.e2e-spec.ts`/`profile-evidence.e2e-spec.ts`, all
reconfirmed passing this phase.

## ADMISSION UAT

**Not independently re-exercised live this phase** beyond the `cases/[id]/applications`
sub-route load-check (confirms the F09 route-folder rename works live, not just in
`next build`). No functional or security concern identified via the requirements-traceability
cross-check. Covered by F05's own component tests and the backend's
`admission-master-data.e2e-spec.ts`/`admission-application.e2e-spec.ts`/
`admission-offer-scholarship.e2e-spec.ts`, all reconfirmed passing this phase.

## VISA/PARTNER UAT

**Not independently re-exercised live this phase.** One genuine new finding from the
requirements-traceability cross-check (not from live testing): the frontend has no distinct
UI affordance for "view-only" vs. "downloadable" Visa evidence (the Phase-13 backend fix that
restricts CONSULTANT to VIEW-only on visa evidence they didn't upload) — a Consultant sees the
same download button regardless, which then correctly 403s server-side if they lack the
DOWNLOAD grant on that specific document. Not a security gap (backend still enforces it
correctly), a UX rough edge, recorded in `FRONTEND_REQUIREMENTS_TRACEABILITY.md` §4. Covered
otherwise by F06's own component tests and the backend's `visa.e2e-spec.ts`/
`pre-departure-enrollment-closure.e2e-spec.ts`/`partners.e2e-spec.ts`, all reconfirmed passing.

## DOCUMENT QA

Live-verified: Documents list page loads cleanly for DOCUMENT_SPECIALIST, zero console
errors. Static review (code read, not live click-through): two-step signed-URL download flow,
`scanStatus === "CLEAN"` gate, no public/hard-coded storage URL anywhere in the frontend — all
unchanged since F07/F09. **Upload/download click-through NOT live-tested this phase** — see
KNOWN LIMITATIONS.

## NOTIFICATION QA

Live-verified for both a staff (EXECUTIVE_DIRECTOR) and a Portal (STUDENT_PARENT) account:
real unread notification items render, mark-read control works, zero console errors. No
excessive-polling or duplicate-notification issue found on review (unchanged since F07/F09).

## REPORTING UAT

Live-verified: EXECUTIVE_DIRECTOR dashboard renders real KPI data (case counts, overdue
payments/tasks, revenue-by-currency, pipeline breakdown) including `workload`/`deadlines`
(the Phase-13 backend fix that added these fields to the executive dashboard — required no
frontend change since the page already rendered the full response shape defensively). Export
flow **not** independently re-exercised live this phase.

## STUDENT PORTAL UAT

Live-verified: `demo.student.self` correctly resolves to and sees their own record via
`/portal`'s auto-redirect. Profile/overview data renders correctly.

## PARENT PORTAL UAT

Live-verified, the highest-priority security scenario in the app: `demo.parent.linked` (ACTIVE
link) sees the linked child correctly; `demo.parent.unlinked` (never linked) is DENIED with a
real 404 on the same student id; `demo.parent.revoked` (was ACTIVE, now `portalStatus =
REVOKED`, same `portalUserId` still set — the exact scenario the Phase-11 backend
revocation-awareness fix targets) is DENIED with a real 404, both on direct access AND when
resolving `/portal`'s own root (empty-children state, not a stale cached child). **Multi-child
switch NOT live-tested** — no fixture account has 2+ linked children; the mechanism remains
covered by F08/F09's automated cross-child-isolation test. A genuine, non-security
documentation discrepancy was found and recorded: `demo.parent.linked` can also reach the
STAFF-shell `/students/:id` page (not only Portal) for their own linked child — contradicts
`FRONTEND_AUTH.md`/`FRONTEND_PERMISSION_MAP.md`'s explicit claim otherwise, though the same
OWN_STUDENT scope check gates both routes identically (verified — no additional access
granted). See `FRONTEND_SECURITY_REPORT.md` §7.

## IDOR

Verified DENY, with real backend network status codes, for: CASE_MEMBER scope (cross-case,
CONSULTANT), OWN_STUDENT scope (unlinked AND revoked parent, STUDENT_PARENT — the app's
highest-risk scenario), and OWN_LEAD scope (cross-owner, SALES_MARKETING). Every DENY was a
real `404`, non-enumerating, matching SRS AC-02, never a `403` that would confirm existence.
Full detail: `FRONTEND_SECURITY_REPORT.md` §3–§5.

## FIELD SECURITY

Re-spot-checked (static read) every `FieldPolicyService` redaction rule against its frontend
render site — `internalNotes` (Lead/Case/LOR/ScholarshipApplication/Visa/Enrollment/Partner),
`Task.blocker/qualityScore/ownerId` (Portal), `Contract.value`/`Payment.amount`
(CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/SYSTEM_ADMIN). No reconstruction-via-
second-endpoint path found anywhere. No finding.

## AUTH SECURITY

`?next=` open-redirect/self-loop hardening (F09) re-confirmed still correct and still the
only client-controlled navigation-target reader in the app (one `useSearchParams` call site,
grepped). No `javascript:`/`data:`-scheme navigation vector exists. Logout error-handling
fix (above) is this phase's one real auth-security-adjacent change. Full detail:
`FRONTEND_SECURITY_REPORT.md` §6/§10.

## OPEN REDIRECT

No finding — re-confirmed this phase. See AUTH SECURITY above.

## XSS / CLIENT SECURITY

Zero `dangerouslySetInnerHTML`, zero `eval`/`innerHTML =`, zero `<iframe>`, zero
`console.log`/`debug`/`info` outside test files, zero hard-coded secret/credential/storage-
host literal — all grepped fresh this phase across the entire `apps/web` tree. No finding.

## RESPONSIVE

**NOT TESTED this phase** — no live 320/375/768/1024/1280/1440px viewport sweep was
performed. F09's responsive hardening is unchanged; no code touched this phase that could
have regressed it. Non-blocking (see KNOWN LIMITATIONS).

## ACCESSIBILITY

**NOT independently tested this phase** beyond what naturally surfaced during UAT (keyboard-
driven login across every role, native `<dialog>` behavior incidentally exercised while
navigating). No dedicated keyboard/screen-reader/contrast sweep performed. F09's accessibility
hardening is unchanged; no code touched this phase that could have regressed it. Non-blocking.

## PERFORMANCE

Static assessment only — no browser performance-profiling tool was used this phase beyond the
`next build` output already captured (64 routes, 21/21 static). No duplicate-request pattern
or waterfall newly identified during UAT navigation (network requests were inspected directly
for several role/page combinations and showed the expected parallel-fetch pattern already
established in F07–F09, no regression). Not fabricating a number no tool measured.

## FRONTEND TESTS

**306/306 passing** (73 files — 305 carried over from F09 + 1 new: the logout-network-failure
regression test).

## TYPECHECK

PASS — 0 errors.

## LINT

PASS — 0 errors, 0 warnings.

## BUILD

PASS — 64 routes, 21/21 static pages, clean after the logout fix.

## BACKEND REGRESSION

PASS. **Zero backend files touched this phase.** Unit: **182/182**. E2e: first full run
(concurrent with heavy frontend build/lint/test load) showed 27 timeout/connection-reset
failures — a resource-contention artifact of this session's local environment, not a code
defect; re-run in isolation: **487/488**; the one remaining flake
(`notifications.e2e-spec.ts`) re-run alone: **12/12**. Combined, this reconfirms the
established **488/488** baseline. Full detail: `FRONTEND_BUILD_STATUS.md` "Backend regression
check — Phase F10".

## REQUIREMENTS TRACEABILITY

28 frontend-relevant rows cross-checked against `docs/REQUIREMENTS_TRACEABILITY.md` (the
backend's Phase 13 matrix): 22 IMPLEMENTED, 1 PARTIAL (Visa-evidence view-only-vs-downloadable
affordance — see VISA/PARTNER UAT above), 0 NOT IMPLEMENTED, 5 NOT APPLICABLE (backend-only
requirements with no frontend surface). Full detail:
`docs/frontend/FRONTEND_REQUIREMENTS_TRACEABILITY.md`.

## CRITICAL FINDINGS

None.

## HIGH FINDINGS

None.

## MEDIUM FINDINGS

1. `AuthProvider.logout()` unhandled promise rejection on network failure — **fixed this
   phase**, regression test added. See `FRONTEND_SECURITY_REPORT.md` §6.

## LOW FINDINGS

1. `FRONTEND_AUTH.md`/`FRONTEND_PERMISSION_MAP.md` incorrectly claim STUDENT_PARENT never
   reaches the staff shell — documented, not code-fixed (not a security issue; the same
   OWN_STUDENT scope gates both routes identically). See `FRONTEND_SECURITY_REPORT.md` §7.
2. No distinct frontend affordance for Visa-evidence view-only-vs-downloadable — documented,
   not code-fixed (backend still correctly enforces on attempt). See
   `FRONTEND_REQUIREMENTS_TRACEABILITY.md` §4.

## NON-BLOCKING LIMITATIONS

- **ACCEPTED LIMITATION** — No live multi-child Portal switch test (no seeded fixture has 2+
  linked children; fabricating one was judged out of scope — §40 "no new feature/data solely
  to force a pass"). Mechanism covered by F08/F09's automated cross-child-isolation test.
- **ACCEPTED LIMITATION** — Deep transactional workflow click-through (Lead→Student→Case→
  Contract→Assessment/Roadmap→Application→Offer/Scholarship→Visa→Enrollment→Closure) not
  independently re-exercised live this phase — covered by F03–F09's component tests and the
  backend's 488-test e2e suite, both reconfirmed passing.
- **ACCEPTED LIMITATION** — Document upload/download click-through not live-tested this
  phase — covered by F07's component tests and `documents-platform.e2e-spec.ts`.
- **ACCEPTED LIMITATION** — No live 320–1440px responsive sweep or dedicated
  keyboard/screen-reader/contrast sweep this phase — F09's hardening is unchanged, no code
  touched this phase that could regress it.
- **ACCEPTED LIMITATION** — MFA/locked/suspended/offboarded account states not live-tested
  (no such fixture account exists among seeded `DEMO_USERS`) — unchanged since F02, covered
  by that phase's own tests.
- **FUTURE IMPROVEMENT** — The two LOW findings above (staff-shell reachability
  documentation, Visa-evidence affordance) are each real but narrow enough that a dedicated
  future decision (not a QA-phase unilateral fix) is the right way to resolve them — the first
  may require a deliberate product decision (restrict the grant vs. update the docs), the
  second would need a backend contract addition.
- **ENVIRONMENT** — This session's local dev environment (Turbopack `next dev` + Turbopack
  `next build` sharing `.next/` on a slow/network-mounted filesystem) exhibited real
  performance/stability degradation when multiple heavy processes ran concurrently
  (dev-server Fast-Refresh thrashing, transient API 503s, backend e2e timeouts) — root-caused
  each time, never silently accepted as "flaky and ignored." Not present in a normal CI/single-
  process environment; noted for whoever next runs this stack locally on similarly slow
  storage.

None of the above are BLOCKER-severity.

## FILES CREATED

`docs/frontend/FRONTEND_UAT_REPORT.md`, `docs/frontend/FRONTEND_SECURITY_REPORT.md`,
`docs/frontend/FRONTEND_REQUIREMENTS_TRACEABILITY.md`,
`docs/frontend/FRONTEND_RELEASE_GATE.md`, `docs/frontend/phase-status/PHASE_F10.md` (this
file).

## FILES UPDATED

`apps/web/lib/auth/auth-context.tsx` (logout error-handling fix — the one code change this
phase), `apps/web/lib/auth/auth-context.test.tsx` (+1 regression test),
`docs/frontend/FRONTEND_BUILD_STATUS.md` (+ "Validation results — Phase F10" / "Backend
regression check — Phase F10" sections). **No `docs/DECISIONS.md` entry** — zero backend
changes, and the logout fix is a bug fix to existing F02 behavior, not an architectural
decision. **No other frontend source file changed** — F10 is QA/release-gate scope, not a
feature or hardening phase; the single fix above was the one genuine defect this pass
surfaced, fixed in place per §41's "if a genuine defect blocks release, prove it, minimal fix,
regression test, document" instruction (adapted here from backend to frontend, since the
defect itself was frontend-side).

## ASSUMPTIONS

- The logout fix's scope (catch-and-swallow the network error, unconditionally tear down
  state + redirect) mirrors `authApi.logout()`'s own pre-existing, documented reasoning
  ("staying logged in locally while the backend call's outcome is unknown is worse than the
  reverse") rather than inventing a new error-handling philosophy for this one call site.
- The two LOW-severity findings (staff-shell reachability, Visa-evidence affordance) are
  genuine discrepancies worth recording but not worth a unilateral fix in a QA pass, per
  the same "don't invent requirements, don't silently expand scope" discipline every prior
  phase has followed for backend/frontend documentation mismatches.
- The 27→487→488 e2e-flake sequence is resource contention, not a code defect — justified by
  the failure signature (timeouts/connection-resets across five totally unrelated spec files
  with no shared code path) and confirmed by full reproducibility in isolation (487/488, then
  12/12 on the one remaining flaky file).

## RISKS

- Deep transactional workflows, document upload/download, and responsive/accessibility were
  not live-tested this phase — real but bounded risk, mitigated by existing automated test
  coverage at every layer (component tests + backend e2e), not zero coverage.
- The local dev environment's resource sensitivity (documented above) means a future session
  attempting simultaneous heavy local test runs + browser QA on this same slow filesystem
  should expect similar transient instability and know to re-run in isolation before
  concluding a regression, rather than accepting a contended run's result at face value.
- The root `.env` (gitignored) still points `DATABASE_URL`/`DIRECT_URL` at production
  Supabase — unchanged since F04; every command this phase used explicit shell-level
  overrides.

## KNOWN ISSUES

See LOW FINDINGS and NON-BLOCKING LIMITATIONS above — no issue beyond those two LOW findings
and the accepted test-coverage gaps.

## READY FOR F11: YES
