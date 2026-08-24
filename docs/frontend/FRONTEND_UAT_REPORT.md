# FRONTEND UAT REPORT — Phase F10

Real browser (Chrome, via CDP automation), real local `apps/api` + Postgres backend, real
seeded `DEMO_USERS` fixture accounts (`database/seeds/seed.ts` — non-production only).
"Result" reflects what was actually observed, not inferred. Console was checked for errors/
uncaught rejections after every navigation (via `read_console_messages`); network requests
were checked directly (via `read_network_requests`) wherever a status code, not just rendered
text, was the meaningful assertion. Where a workflow was not exercised live, it is marked
**NOT TESTED** with the reason — never inferred as PASS.

**A session-specific tooling note, recorded so a future session doesn't re-diagnose it**: the
`computer: screenshot` action was found to intermittently return a stale/cached frame that did
not match the live DOM in this session (confirmed by cross-checking a screenshot against a
`document.querySelectorAll('dialog[open]')` JS query taken at the same instant, on the same
single browser tab). Every result below was therefore verified via `read_page` (accessibility
tree), `javascript_tool` (direct DOM/`document.body.innerText` query), or
`read_network_requests` (real status codes) — never from a screenshot alone.

## EXECUTIVE_DIRECTOR (`demo.director`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | Real `POST /auth/login`, principal resolved |
| Dashboard (executive KPIs) | PASS | Real case counts, overdue payments/tasks, revenue-by-currency, pipeline breakdown rendered from `/reports/executive` |
| Nav reflects full grant set (everything except Admin/Jobs/Audit/Portal) | PASS | `Người dùng` (read-only) shown, `Jobs`/`Audit log`/Portal absent |
| Console clean | PASS | Zero errors/exceptions across the session |

## DEPARTMENT_MANAGER (`demo.manager`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| Dashboard | PASS | Same content shape as ED |
| Nav = ED's set minus Admin entirely (not even read-only Users) | PASS | Confirmed no "QUẢN TRỊ" section rendered at all |
| Portal denied (staff role hitting `portal:access`) | PASS (DENY) | `GET /portal/students/:id` → 403 `portal:access`, exact message |

## CONSULTANT (`demo.consultant.a` = case member, `demo.consultant.b` = not a member)

| Workflow | Result | Evidence |
|---|---|---|
| Login (both accounts) | PASS | |
| Nav: Students/Cases/Tasks/Counseling/Admission-execution/Visa-execution only, no Leads/Contracts/Partners/Admin | PASS | |
| Own case (`CASE-2026-04243`) — view own case, members, timeline | PASS | 200 on `/cases/:id`, `/cases/:id/members`, `/cases/:id/timeline` |
| Cross-case access (consultant.b → consultant.a's case) | **PASS (DENY)** | 404 on all three endpoints, non-enumerating message — see `FRONTEND_SECURITY_REPORT.md` §3 |
| `cases/[id]/applications` sub-route (F09 route-fix) | PASS | Loads without 404/routing error, confirming the F09 route-folder rename works correctly live, not just in `next build` |

## DOCUMENT_SPECIALIST (`demo.docspecialist`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| Nav: Students/Cases(view)/Tasks/Admission/Visa/Partners(view)/Documents, no Leads/Contracts | PASS | Matches `RBAC_MATRIX.md` exactly |
| Documents list page | PASS | Loads, zero console errors |
| Cross-case IDOR (not a member of consultant.a's case) | **PASS (DENY)** | 404, non-enumerating |
| Contracts denied (zero grant) | **PASS (DENY)** | 403 `contracts:view` |

## SALES_MARKETING (`demo.sales` = owns fixture lead, `demo.sales.b` = owns nothing)

| Workflow | Result | Evidence |
|---|---|---|
| Login (both accounts) | PASS | |
| Nav: Leads + read-only catalog (Universities/Programs) + Visa checklist templates only | PASS | No Students/Cases/Contracts/Documents/Partners |
| Own lead access | PASS | 200, real lead data |
| Cross-owner lead IDOR (sales.b → sales's lead) | **PASS (DENY)** | 404, non-enumerating |
| Students denied (zero grant) | **PASS (DENY)** | 403 `students:view` |

## ADMIN_FINANCE (`demo.finance`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| Nav: Contracts, Payments (nested), Partners/Commission (view+execution) only, no Students/Cases/Leads/Documents/Admission/Visa | PASS | |
| Contract detail (real, REVIEW status) | PASS | Real contract `HD-2026-01612` renders |
| Zero visible approve/amend action on a REVIEW contract | PASS | Confirmed via dialog-aware DOM query (only genuinely-visible, non-dialog-internal buttons counted) — no `contracts:approve` grant, `Duyệt hợp đồng` trigger correctly absent |
| Leads denied (zero grant) | **PASS (DENY)** | 403 `leads:view` |

## STUDENT_PARENT

### Self (`demo.student.self`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| Portal auto-resolves to own record | PASS | `GET /portal/me` → 1 student, auto-redirect, no picker |
| Own profile/overview | PASS | Real data (`HS-2026-90001`) |

### Parent — linked (`demo.parent.linked`, single child)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| Portal auto-resolves to linked child | PASS | |
| Staff-route access to same child (`/students/:id`) | PASS (see security report §7 for the documentation-discrepancy note) | 200, real data — same OWN_STUDENT scope enforced both ways |

### Parent — unlinked (`demo.parent.unlinked`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| Access to Student A via Portal (direct URL) | **PASS (DENY)** | 404 |
| Access to Student A via staff route (direct URL) | **PASS (DENY)** | Non-enumerating message |

### Parent — revoked (`demo.parent.revoked`, was ACTIVE, now REVOKED, same `portalUserId`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| `/portal` root (resolves accessible children) | **PASS (DENY)** | Empty state: "Chưa có học sinh nào được liên kết với tài khoản này." |
| Direct access to former child via same already-issued session | **PASS (DENY)** | `GET /portal/students/:id` → 404 (real network status, not just rendered text) — proves live `portalStatus` re-check, not a cached/stale allow |

### Parent child-switch (2+ children on one account)

**NOT TESTED** — no seeded fixture account has more than one linked child (`demo.parent.linked`
has exactly one). Fabricating a second child-link for this account was judged out of scope
(§15/§40: no new business feature/data solely to force a test to run). This mechanism remains
covered by F08/F09's automated test suite
(`components/portal/portal-student-shell.test.tsx`'s cross-child-isolation test), not by a live
click-through this phase.

## SYSTEM_ADMIN (`admin`)

| Workflow | Result | Evidence |
|---|---|---|
| Login | PASS | |
| Nav: Admin (Users/Audit log/Jobs, all "sắp có" placeholder) only | PASS | Zero business-domain nav rendered |
| Dashboard denied (zero `reports:view`) | **PASS (DENY)** | 403, exact resource:action named |
| Students denied (zero grant, tested against a real student id) | **PASS (DENY)** | 403 `students:view` |
| Portal denied (zero `portal:access`) | **PASS (DENY)** | 403 `portal:access` |

## Auth UX (all roles)

| Workflow | Result | Evidence |
|---|---|---|
| Login → dashboard/portal redirect by role | PASS | |
| Logout → immediate session invalidation, redirect to `/login` | PASS | Server-side revocation confirmed (subsequent protected navigation redirects) |
| Logout resilience under network failure | **Found broken, fixed this phase** | See `FRONTEND_SECURITY_REPORT.md` §6 |
| `?next=` preserved and honored across logout/re-login | PASS | |
| No infinite redirect loop observed across 8 role logout/login cycles | PASS | |

## CRM / Commercial / Profile / Admission / Visa / Partner — deep workflow click-through

**NOT TESTED this phase** (create/edit/status-transition/close/amend/refund/etc. dialogs were
not individually exercised live). These are already covered by the F03–F09 component/unit
test suites (mocked-API layer, matching real response shapes) and by the backend's own
488-test e2e suite (real HTTP + real DB, re-confirmed passing this phase — see
`FRONTEND_BUILD_STATUS.md`). Given the scope of a single QA pass and the time already spent on
the higher-priority RBAC/IDOR/auth verification above, a full transactional click-through
(Lead→Student→Case→Contract→Assessment/Roadmap→Application→Offer/Scholarship→Visa→Enrollment→
Closure) was not additionally performed live — documented as a gap, not claimed PASS.

## Document upload/download, Notification mark-read, Responsive/Accessibility live sweep

**Partially tested / NOT TESTED**: Notifications page confirmed live (real unread items,
working mark-read control, zero console errors) for both a staff and a Portal account.
Document *list* page confirmed loading cleanly for DOCUMENT_SPECIALIST. Document
upload/download click-through, and a dedicated 320/375/768/1024/1280/1440px responsive sweep,
were **NOT TESTED** this phase — the same F02–F09 limitation (this session's Chrome
automation connection dropped once already this project cycle; browser time this phase was
prioritized toward the RBAC/IDOR/auth-security verification above, judged the higher-value use
of limited, occasionally-unstable browser-automation time). Static code review found no
regression risk in either area (F07's Document flow and F09's responsive/accessibility
hardening were unchanged this phase).

## Summary

8/8 backend roles logged into and verified against a real backend this phase. Every RBAC
nav/permission check and every IDOR/non-enumeration check attempted **passed**. One real bug
(logout error handling) was found and fixed with a regression test. No CRITICAL or HIGH
finding. Deep transactional workflow click-through, document upload/download, and a live
responsive/accessibility sweep were not performed live this phase — each is either covered by
existing automated tests or documented as a gap, never silently assumed passing.
