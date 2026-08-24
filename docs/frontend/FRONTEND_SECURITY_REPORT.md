# FRONTEND SECURITY REPORT — Phase F10, addended F11 (deployment-readiness finding, §14)

Scope: `frontend_prompts/10-qa/10_FRONTEND_QA_SECURITY_UAT.md` security checklist, executed
against the running `apps/web` frontend talking to a real local `apps/api` + Postgres
instance, cross-checked against `docs/security/RBAC_MATRIX.md` and
`docs/security/SECURITY_TEST_REPORT.md` (the backend's own Phase 13 security audit). Every
finding below is either a live, real-browser-verified request/response (network evidence
captured via Chrome DevTools Protocol), or a direct source-code read — never inferred from
route names or assumed from documentation.

**Result: CRITICAL = 0. HIGH = 0. MEDIUM = 1 (fixed this phase, regression test added).
LOW = 1 (documentation discrepancy, not a code defect).**

## 1. Authentication

| Check | Result | Evidence |
|---|---|---|
| Access token storage | PASS — in-memory only (`lib/auth/token-store.ts`), never `localStorage`/`sessionStorage`. Grepped `apps/web` for `localStorage`/`sessionStorage`: the only match is a comment explaining why it's deliberately NOT used. | Static read, confirmed unchanged since F02 (`docs/frontend/FRONTEND_AUTH.md` §1). |
| Refresh token | PASS — never read/stored client-side; relies on the backend's `httpOnly`/`SameSite=Strict` cookie. | Static read (`lib/auth/auth-api.ts`). |
| Login (real backend) | PASS — `admin`/`ChangeMe!123` (SYSTEM_ADMIN) and all 12 `DEMO_USERS` fixture accounts authenticate correctly against the running local API. | Live browser, `POST /auth/login` → 200/201, correct principal resolved each time. |
| Logout invalidates session server-side | PASS — `POST /auth/logout` (201) followed by any subsequent protected navigation redirects to `/login`; no stale authenticated content flashes. | Live browser, verified across 8 role logout/login cycles. |
| Logout resilience on network failure | **MEDIUM (fixed this phase)** — see §6 below. | Live browser (found under real load), source fix + new test. |
| Session bootstrap (`?next=` preserved through redirect) | PASS. | Live browser, `RequireAuth` redirects to `/login?next=<original path>`, honored on next successful login. |

## 2. RBAC — role → permission (coarse gate)

All 8 backend roles were logged into against the real API this phase (`admin`,
`demo.director`, `demo.manager`, `demo.consultant.a`, `demo.consultant.b`,
`demo.docspecialist`, `demo.sales`, `demo.sales.b`, `demo.finance`, `demo.student.self`,
`demo.parent.linked`, `demo.parent.unlinked`, `demo.parent.revoked`). For every role, the
rendered nav and every direct-URL permission probe below matched `docs/security/
RBAC_MATRIX.md` §2 exactly — no over-permissive or under-permissive rendering found.

| Role | Direct-URL probe | Real backend response | Result |
|---|---|---|---|
| SYSTEM_ADMIN | `/dashboard`, `/students/:id` (real id), `/leads`, `/portal` | 403 `PERMISSION_DENIED` — `reports:view`/`students:view`/`leads:view`/`portal:access` each named exactly | PASS — zero business-domain access, as documented |
| EXECUTIVE_DIRECTOR | `/dashboard` | 200, full KPI/financial data rendered | PASS |
| DEPARTMENT_MANAGER | `/dashboard`, `/portal/students/:id` | 200 (nav identical to ED minus Admin/Users); 403 `portal:access` | PASS |
| CONSULTANT | see §3 (CASE_MEMBER) | — | PASS |
| DOCUMENT_SPECIALIST | `/contracts` | 403 `contracts:view` | PASS — zero financial grant, matches RBAC_MATRIX |
| SALES_MARKETING | `/students`, `/contracts` | 403 `students:view` / (nav never shows Contracts at all) | PASS |
| ADMIN_FINANCE | `/leads/:id` (real id), `/contracts/:id` (REVIEW status) | 403 `leads:view`; 200 with zero visible approve/amend/edit/send/sign trigger buttons outside their FSM-eligible state | PASS — confirms both the permission gate (no `contracts:approve`) and that no dialog-only button was mistakenly counted as "visible" (verified via `dialog.open`-aware DOM query, not a naive `querySelectorAll`) |
| STUDENT_PARENT | see §3/§4 | — | PASS, with one documentation discrepancy — see §7 |

## 3. IDOR / non-enumeration — CASE_MEMBER scope (CONSULTANT)

Live, with real network evidence (not just rendered text) — a case belonging to
`demo.consultant.a` (`CASE-2026-04243`, id `273f23ea-358c-4933-9791-75b3b73265e9`):

| Caller | `GET /cases/:id` | `GET /cases/:id/members` | `GET /cases/:id/timeline` | Frontend rendering |
|---|---|---|---|---|
| `demo.consultant.a` (OWNER/member) | 200 | 200 | 200 | Real case data (`CASE-2026-04243`) |
| `demo.consultant.b` (not a member) | **404** | **404** | **404** | "Không tìm thấy hoặc bạn không có quyền truy cập." — identical wording to a genuinely-nonexistent id, no distinguishing detail |
| `demo.docspecialist` (not a member of this specific case) | **404** | — | — | Same non-enumerating message |

**PASS** — confirms SRS AC-02 end-to-end through the real frontend, not just the backend's
own e2e suite: an out-of-scope case returns 404 (never 403), and the frontend never renders
anything that would let a caller distinguish "doesn't exist" from "exists but not yours."

## 4. IDOR / non-enumeration — OWN_STUDENT scope (STUDENT_PARENT) — **highest-priority check**

Student A (`HS-2026-90001`, id `690f34fd-daa7-48c4-b666-ba0fe68e1d34`) is self-linked to
`demo.student.self` and parent-linked (ACTIVE) to `demo.parent.linked`.

| Caller | Route tested | Real backend response | Result |
|---|---|---|---|
| `demo.student.self` | `/portal` → auto-resolves | `GET /portal/me` → own record | PASS — sees own data |
| `demo.parent.linked` | `/portal` → auto-resolves; `/students/:id` (staff route, same id) | `GET /portal/me`, `GET /portal/students/:id`, `GET /students/:id` all → 200, real data | PASS — sees linked child's data through **both** the Portal and the staff shell (see §7) |
| `demo.parent.unlinked` (never linked to Student A) | `/portal/students/:id`, `/students/:id` (same id, direct URL) | **`GET /portal/students/:id` → 404**; staff route → 404-equivalent generic message | **PASS (DENY)** |
| `demo.parent.revoked` (was ACTIVE, now `portalStatus = REVOKED`, same `portalUserId` still set) | `/portal` (root — resolves accessible children), `/portal/students/:id` (direct) | `GET /portal/me` → empty list ("Chưa có học sinh nào được liên kết với tài khoản này."); `GET /portal/students/:id` → **404** | **PASS (DENY)** — proves revocation is checked live (`portalStatus`), not a stale/cached null-check; confirms the exact Phase-11 fix `RBAC_MATRIX.md` §3 documents, now re-verified through the real frontend |

**PASS** — this is the single most security-critical UAT scenario in the entire application
(a wrong answer here means one family could see another family's student data) and it is
confirmed correct end-to-end, with real network responses, not inferred from UI text alone.

**Not tested live this phase**: an in-session Parent→Child-A→Child-B switch with **two**
children on one account (no such multi-child fixture exists among the seeded `DEMO_USERS`;
fabricating one was out of scope per §15/§40 — "no new business feature," and the mega-prompt
explicitly forbids fabricating production-shaped fixtures solely to force a pass). This
specific mechanism (`PortalStudentShell` re-running its own authorization probe on every
navigation, `usePortalProfile`'s `staleTime: 0` from F09, and a dedicated cross-child-isolation
unit test asserting Child A's data is never visible while Child B's shell is mounting) remains
covered by the F08/F09 automated test suite (`portal-student-shell.test.tsx`), not by a live
click-through this phase. Documented, not silently claimed PASS.

## 5. IDOR / non-enumeration — OWN_LEAD scope (SALES_MARKETING)

| Caller | Lead tested | Real backend response | Result |
|---|---|---|---|
| `demo.sales` (owner) | own fixture lead | 200, visible in `/leads` list | PASS |
| `demo.sales.b` (owns nothing) | same lead, direct URL | **404**, "Không tìm thấy hoặc bạn không có quyền truy cập." | **PASS (DENY)** |

## 6. Auth resilience — logout under network failure — MEDIUM (fixed)

**Finding**: `AuthProvider.logout()` (`lib/auth/auth-context.tsx`) awaited
`authApi.logout()` with no `try/catch` of its own, and `UserMenu`'s button fires it as
`void logout()` (no `.catch()` at the call site either). `authApi.logout()` already clears
the in-memory access token in its own `try/finally` even when the network call fails — but
because the exception then propagated out of `AuthProvider.logout()` uncaught, the
**state teardown and redirect (`setPrincipal(null)`, `setStatus("UNAUTHENTICATED")`,
`queryClient.clear()`, `router.push("/login")`) never ran**.

**Impact**: under a real network failure during logout (observed live this phase — the local
API server was transiently returning `503`/connection-reset under heavy concurrent test-suite
load), the user's in-memory access token was silently gone (so their *next* API call would
already behave as unauthenticated / trigger the refresh flow) while the UI kept showing the
stale authenticated page with no visible error and no redirect — a confusing, broken-looking
state, and a genuine unhandled-promise-rejection surfaced in the console (caught live via
`read_console_messages`, 6 occurrences, stack trace confirmed: `apiFetch → logout →
AuthProvider.useCallback[logout] → onClick`). Not a data-exposure issue — the token was
correctly gone — but a real UX/error-handling defect the F10 "no uncaught promise errors"
browser-QA bar exists to catch.

**Fix**: `AuthProvider.logout()` now wraps `authApi.logout()` in its own `try { } catch { }
finally { }` — the state teardown and redirect happen unconditionally in `finally`, and the
network failure is swallowed (matches `authApi.logout()`'s own established "best-effort,
staying logged in locally while the backend call's outcome is unknown is worse than the
reverse" reasoning, just applied one level higher than before). `apps/web/lib/auth/
auth-context.tsx`.

**Regression test**: `apps/web/lib/auth/auth-context.test.tsx` — "still clears auth state and
redirects to /login when the network logout call fails" — mocks `authApi.logout` to reject
with the exact `TypeError: Failed to fetch` observed live, asserts `UNAUTHENTICATED` +
`router.push("/login")` still occur. **306/306 tests pass** after the fix (was 305).

**No business logic changed** — this is a client-side error-handling fix to existing F02 auth
code, zero backend files touched, zero new business feature.

## 7. LOW — Documentation discrepancy: STUDENT_PARENT can reach the staff shell, not only Portal

`docs/frontend/FRONTEND_AUTH.md` §7 and `docs/frontend/FRONTEND_PERMISSION_MAP.md`'s
STUDENT_PARENT section both assert: *"this role never sees the staff `(staff)` shell at
all... a STUDENT_PARENT hitting any staff route gets 403 from the coarse permission check
before any scope logic runs, since none of the staff-resource grants above are present."*

**This is factually incorrect against the actual RBAC grants and was reproduced live**:
`docs/security/RBAC_MATRIX.md` §2 shows STUDENT_PARENT genuinely holds `view` grants on
`students`/`cases`/`contracts`/`payments`/`documents`(+`download`)/and every counseling/
admission/visa resource (OWN_STUDENT-scoped) — not zero. Confirmed live: `demo.parent.linked`
successfully loaded `/students/690f34fd-...` (the real staff-shell student detail page, full
sidebar nav, not the Portal shell) and saw their linked child's full record.

**Not a security leak** — the exact same `ScopePolicyService.assertStudentAccessible` /
revocation-aware OWN_STUDENT check gates both the staff route and the Portal route (§4 above
proves the DENY paths work identically on both), so a STUDENT_PARENT reaching this page via
the staff URL sees nothing they couldn't already see through Portal. It is a **UX/
documentation inconsistency**: the desktop-oriented, non-mobile-first staff UI (with its own
sidebar, unrelated CRM nav items, etc.) is reachable by a Portal user, which the design intent
(`FRONTEND_ARCHITECTURE.md` §11: "Portal... là một surface riêng") did not anticipate. No
write-action button renders for STUDENT_PARENT on these pages (their grants are `view`-only,
confirmed by the RBAC_MATRIX table), so this does not enable any unintended mutation.

**Resolution this phase**: documented, not silently fixed. Correcting this would mean either
(a) narrowing STUDENT_PARENT's staff-resource grants (a backend RBAC change, out of F10
scope per §41 "prefer zero backend changes"), or (b) adding a frontend-only redirect/guard
hiding staff routes from STUDENT_PARENT (a new authorization-adjacent frontend behavior not
requested by any F01–F09 instruction, and arguably a "new feature" under §40's no-new-feature
rule). Flagged here for a future phase to decide deliberately, not decided unilaterally in a
QA pass.

## 8. Field-level security

Reviewed `FieldPolicyService`'s redaction rules (`docs/security/RBAC_MATRIX.md` §5) against
every corresponding frontend render site — unchanged since F04–F08, spot-re-verified this
phase by reading `lib/*/types.ts` + the rendering component for each: `internalNotes` (Lead/
Case timeline comments, LOR, ScholarshipApplication, Visa, Enrollment, Partner),
`Task.blocker/qualityScore/ownerId` (Portal path), `Contract.value`/`Payment.amount` (redacted
for CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/SYSTEM_ADMIN). **No frontend code path
re-fetches or reconstructs a redacted field via a second endpoint** — grepped every domain's
`lib/*/api.ts` for a second GET call keyed off an entity already rendered; none found. No
finding.

## 9. Document security

Reviewed (static + one live check): upload/download flow uses the established two-step
signed-URL redemption (`resolveApiUrl(downloadUrl)` + `window.open(..., "_blank",
"noopener,noreferrer")`), download gated on `document.scanStatus === "CLEAN"` client-side
*and* re-checked server-side (per `SECURITY_TEST_REPORT.md` §9, unchanged). Grepped
`apps/web` for `r2.cloudflarestorage`/`amazonaws.com`/any hard-coded storage host: none
found — every document URL is backend-issued and short-lived. No finding.

## 10. Open redirect / `?next=` handling

Reviewed live and via source: `login-form.tsx`'s `redirectAfter` (hardened in F09) rejects a
`//`-prefixed value (protocol-relative open redirect) and a `/login`-prefixed value
(self-loop), falling back to the role default. Re-confirmed this phase: `?next=` is the
**only** place in the entire frontend that reads a client-controlled navigation target
(grepped for `useSearchParams` — one call site total). No `javascript:`/`data:`-scheme
navigation vector exists (no `<a href={userInput}>` pattern anywhere — the only user-supplied
URLs rendered as `<a href>` are `University.website`/`Partner.website`, both backend-validated
via `class-validator`'s `@IsUrl()`, which rejects non-http(s) schemes). No finding.

## 11. XSS / client-side security

`dangerouslySetInnerHTML`: zero occurrences anywhere in `apps/web` (grepped). No `eval`/
`Function(...)`/`innerHTML =` pattern found. No `<iframe>` anywhere in the app. `console.log`/
`console.debug`/`console.info` of any kind: zero occurrences outside test files (grepped) — no
risk of accidentally logging a token/password, consistent with F02's own established
discipline (`lib/auth/login-form.tsx`'s password-never-logged test, unchanged). No finding.

## 12. Secret scanning

Grepped `apps/web` for hard-coded URLs (`onrender.com`, `r2.cloudflarestorage`,
`amazonaws.com`), inline credentials (`password =`, `apiKey =`, `secret =`), and any
`.env`-shaped literal: zero matches outside `.env.example`'s documented placeholder. The one
environment variable the frontend reads (`NEXT_PUBLIC_API_URL`) carries no secret by design
(it's a public base URL). No finding.

## 13. Export security

Not independently re-tested live this phase (no ED/DM export click-through was performed);
reviewed against the backend's own `SECURITY_TEST_REPORT.md` §13 (export scope matches
list-endpoint scope, field redaction carried into exports, export reason/actor logged) — the
frontend's `/reports` export page (F07) calls the same `GET /reports/cases/export` endpoint
with no client-side field selection or row filtering of its own (confirmed by reading `app/
(staff)/reports/page.tsx` — the export button passes through the same query params the
dashboard already uses, no locally-computed override). No finding, but flagged as **NOT
LIVE-TESTED** rather than claimed PASS from a click-through.

## Findings summary

| # | Severity | Area | Status |
|---|---|---|---|
| 1 | MEDIUM | `AuthProvider.logout()` unhandled rejection on network failure — UI stuck, no redirect | **Fixed this phase**, regression test added (`auth-context.test.tsx`) |
| 2 | LOW | `FRONTEND_AUTH.md`/`FRONTEND_PERMISSION_MAP.md` incorrectly claim STUDENT_PARENT never reaches the staff shell | Documented (this report + `PHASE_F10.md`); not a security leak; correction deferred to a future phase's deliberate decision |

**Release gate relevant totals: CRITICAL = 0. HIGH = 0.** No known sensitive-data exposure
found. IDOR verified DENY for CASE_MEMBER (cross-case), OWN_STUDENT (unlinked + revoked
parent), and OWN_LEAD (cross-owner) scopes, each with real backend network evidence, not
inferred from rendered text alone.

## 14. F11 addendum — cookie `SameSite=Strict` cross-origin finding

**New this phase, not a re-finding of anything above.** The refresh cookie's
`sameSite: 'strict'` (`apps/api/src/modules/identity/auth/auth.controller.ts`, hard-coded) is
never delivered by the browser on a cross-site request. This has no impact on F10's own
findings (F10's UAT ran same-origin, `localhost:3001` ↔ `localhost:3000`, where `SameSite=
Strict` behaves identically to any laxer setting) — it is a **deployment-readiness** finding,
not a same-origin security defect, which is why it was not and could not have been found
during F10's own scope. Severity: real functional break (session-restore/refresh silently
fails), not a data-exposure issue — the cookie is still never delivered anywhere it
shouldn't be; it simply fails to be delivered somewhere it *should* be once cross-origin.
**Not counted in the CRITICAL/HIGH/MEDIUM/LOW totals above**, since it is not an F10-scope
security defect — tracked instead in `docs/frontend/phase-status/PHASE_F11.md` and
`docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md`'s "Critical finding" as a deployment
prerequisite. Full detail there and in `docs/frontend/FRONTEND_AUTH.md` §13.
