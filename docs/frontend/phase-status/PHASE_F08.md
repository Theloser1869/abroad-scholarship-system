# PHASE STATUS — F08 (Student/Parent Portal Frontend)

## PHASE F08 STATUS: PASS

## READY FOR F09: YES

## SUMMARY

Built the complete Student/Parent Portal on top of F02–F07's foundation, API-first against
the real `PortalController`/`PortalService`/`PortalAccessService`, reusing every prior
primitive (API client, `apiUpload`, auth, RBAC, Query/cache, `Table`/`Card`/`Dialog`/`Badge`/
`StatusBadge`/`Money`/`Toast`/`QueryErrorState`) unchanged. **F08 required zero backend
changes** — the second domain phase (after F07) with no DEC entry. One route tree serves both
Student-self and Parent (F01's own documented clarification, confirmed correct): `/portal`
resolves `GET /portal/me` and either auto-redirects (single accessible student) or shows a
picker (multiple linked children); every `/portal/students/[id]/...` sub-route is identical
regardless of which case applies. 18 new routes total (`/portal` + 16
`/portal/students/[id]/...` sub-routes + 1 new public route, `/public/portal/invite/[token]`,
in a new `(public)` route group) + a staff-side addition (parent invite/revoke buttons on the
existing `/students/[id]` page).

## PORTAL ARCHITECTURE

Same Next.js app, same backend, same `(portal)/portal` route group and shell F02 already
built (`RequireAuth` + `RequirePermission(portal, access)`) — no new app, no redesign of any
F02-F07 primitive. `PortalStudentShell` (new, shared by every sub-route) is the one
authorization probe every page relies on: it calls `GET /portal/students/:id` (needed for the
header anyway) and renders the generic non-enumerating error state — never `children` — on
any 404, closing off cross-student/unlinked-child/revoked-parent access at the shell level
before any sub-page's own data call ever fires.

## STUDENT PORTAL

Profile (read-only), Roadmap+milestones+progress, Tasks (list+detail, output submit, narrow
status transition), Documents (grant-based list+download), Applications (list+detail,
checklist+evidence+currentOffer), Scholarships (list+detail), Visa (list+detail), Pre-departure
(checklist+progress), Enrollment (list), Contracts+Payments (list+nested payments),
Notifications (portal-aware inbox). Every one of these reuses the SAME staff domain type
(`Application`/`Visa`/`Enrollment`/`Contract`/`Payment`/`ScholarshipApplication`) — `PortalService`
delegates straight into the existing Phase 05-10 services, confirmed directly against source.

## PARENT PORTAL

Identical route tree to Student — F01's own documented clarification confirmed correct this
phase: "Student Portal" and "Parent Portal" are not two page sets, only how many entries
`GET /portal/me` returns for a given caller. `StudentSwitcher` renders only when more than one
student is accessible; switching always lands on the new student's Overview (never a stale
deep sub-page carried over — a child-specific detail id has no meaning for a different
student). The invitation/acceptance flow is real end-to-end: staff trigger
(`/students/[id]`'s Contacts card, new this phase) → `/public/portal/invite/[token]` (new
public page) → the parent logs in and sees themselves in `GET /portal/me`.

## CHILD SELECTOR

`StudentSwitcher` — sourced entirely from `GET /portal/me`, never inferred from email/name/URL
(F08 instruction §10). Hidden for a lone accessible student. Selecting a different child
always navigates to `/portal/students/[newId]` (Overview), never preserving the current
sub-path, so a switch can never render a stale or mismatched detail page for the wrong child.

## ROADMAP

Read-only overview (progress %, milestones with stage/metric/target/deadline) + the one real
mutation: submitting evidence for a milestone (`EvidenceUploadDialog` — upload via F07's
`uploadDocument`, then `POST .../roadmap/milestones/:id/evidence`). No "mark milestone
complete" action exists anywhere — matches `PortalService`'s own doc comment verbatim.

## TASKS

Only `visibleToStudent` tasks are ever returned (server-filtered). `ownerId`/`blocker`/
`qualityScore` are unconditionally `null` on the wire (`redactTaskForPortal`, ASM-86) — simply
never rendered, nothing to accidentally leak. The only two mutations: submitting the
student's own `output` text, and requesting one of exactly two status targets (IN_PROGRESS/
DONE) — the real backend FSM (same one staff uses) remains authoritative regardless, verified
by a dedicated test asserting a real `409 INVALID_TASK_STATUS_TRANSITION` surfaces verbatim.

## DOCUMENTS

Exactly the caller's own `DocumentAccess` grants (`listAccessibleTo`), no scan-by-owner, no
enumeration. Download only ever offered once `scanStatus === 'CLEAN'`. Same 2-step signed-URL
flow F04/F07 established, reached through the Portal-scoped endpoint
(`/portal/students/:id/documents/:documentId/download`) rather than the staff one — no raw R2
URL/bucket/storage key ever in the response to begin with.

## APPLICATIONS

Read-only except the one narrow checklist-evidence action — no submit()/status-mutation/
offer-response exposed (Portal genuinely has none of these routes). `currentOffer` (singular,
not `offers[]` like the staff detail view — confirmed against the live service) rendered when
present.

## SCHOLARSHIPS

Fully read-only — `PortalController` has no mutation route for ScholarshipApplication at all.
`internalNotes` is `null` on the wire for STUDENT_PARENT and simply never rendered (never
reconstructed via another call). Award details shown once AWARDED.

## VISA

Read-only. `internalNotes` redacted (never rendered); `interviewNotes`/`reason` are NOT
redacted and DO render (the caller's own recorded outcome, not staff strategy — confirmed by a
dedicated test asserting both halves of this distinction). No checklist section exists — the
Portal Visa endpoint has no checklist embed at all (ASM-79), a real backend-shape asymmetry
with Application, not a frontend omission.

## PRE-DEPARTURE

Read-only, server-reported checklist state grouped by category, with an aggregate done/total
count. No "mark pre-departure complete" action anywhere — completeness is enforced only at
Case Closure, entirely staff-side (unchanged since F03/F04).

## ENROLLMENT

Read-only, list-only (no detail route, no confirm/withdraw action — `PortalController` has
neither). Each card shows institution/program/dates/status directly.

## CONTRACT / PAYMENT

List-only for Contract (no detail route, same F04 precedent for Payments-are-nested); each
contract links straight to its nested Payments route. `value`/`currency`/`outstandingAmount`/
`isOverdue` all render real, un-redacted, server-computed values — STUDENT_PARENT is NOT in
`FieldPolicyService.FINANCIAL_REDACTED_FOR` (SRS "HS/PH = V của mình") — never recomputed
client-side.

## NOTIFICATIONS

Reuses F07's inbox mechanics (same event→label/icon map, same `markNotificationRead`
endpoint) — recipient-scoped, not student-scoped, so this is the exact same inbox a
staff-shell `/notifications` visit would show for this same account. Navigation is
Portal-aware (`portalNotificationHref`, new this phase): every real event resolves to its
`/portal/students/:id/...` equivalent, never F07's staff-route map — and `TASK_*` events,
which F07's staff inbox could never link (no staff Task route exists), DO resolve here,
since the Portal has a real Task detail route.

## RBAC

The entire surface is gated by one permission, `portal:access` (STUDENT_PARENT only), checked
once at the `(portal)/portal` layout — no per-domain-area grant exists inside Portal pages
(unlike every staff page). `rbac-data.ts` needed **zero changes** — `portal: ["access"]`
already existed from F02.

## FIELD SECURITY

Every redaction rule already established in F04-F07 (`internalNotes` on Scholarship/Visa/
Enrollment, `redactStudent`'s budget fields, `redactTaskForPortal`'s unconditional
blocker/qualityScore/ownerId) is rendered exactly as the backend returns it — nothing
reconstructed via a second call, nothing inferred client-side. Confirmed field-by-field
against `field-policy.service.ts` directly, not assumed by pattern-matching other entities.

## IDOR / NON-ENUMERATION

`PortalStudentShell`'s single `GET /portal/students/:id` call is the shared gate — a
cross-student id, an unlinked child's id, or a revoked parent's former child id all produce
the identical 404 and the identical generic message
("Không tìm thấy hoặc bạn không có quyền truy cập."), verified by a dedicated test. Real
backend IDOR/revocation coverage lives in `apps/api/test/portal.e2e-spec.ts` (Phase 11,
unchanged, still part of the 488-test e2e baseline this phase re-confirmed) — this phase adds
no new backend test since no backend code changed.

## CACHE PRIVACY

`queryKeys.portal.student.*` embeds `studentId` as the third segment of every key
(`["portal", "student", studentId, ...]`), verified directly by a dedicated unit test
(`lib/api/query-keys.test.ts`) asserting distinct keys for two different students across
every domain area, including the doubly-nested Contract→Payments key. `portal.me()` is the
one deliberate studentId-less exception.

## CROSS-CHILD ISOLATION

A structural consequence of the key design above, not a runtime check: a differently-keyed
cache entry has nothing to bleed from. Switching students always navigates to the new
student's Overview (never a carried-over deep sub-page), and `PortalStudentShell` re-runs its
own authorization probe for the new id on every navigation — there is no code path that could
render Child B's page using Child A's cached data.

## RESPONSIVE

Mobile-first throughout: `PortalNav` is a horizontal scrolling tab strip (not a sidebar, not
a wide table), every list is Card-based, `StudentSwitcher` is a single `<select>`. No new
breakpoint system — reuses the existing Tailwind utility classes every other phase's
components already use.

## ACCESSIBILITY

Semantic `<nav aria-label>` with `aria-current="page"` on the active tab; every dialog reuses
F02's native-`<dialog>`-based `Dialog` (focus trap, Escape-to-close, `::backdrop` for free);
every status uses `StatusBadge` (text label, never color alone); `role="alert"`/inline error
text on every form; labeled inputs throughout (`useId()`-backed `<label htmlFor>` pairs).

## REMOTE BROWSER SMOKE TEST

**NOT APPLICABLE for the Student/Parent business flow** — production currently has 1
SYSTEM_ADMIN, no Students, no Cases, no parent relationships, and F08 instruction §39
explicitly forbids fabricating production Student/Parent fixtures to test with. No live
browser smoke test (SYSTEM_ADMIN role-gate check included) was performed against
`https://abroad-scholarship-system.onrender.com` in this session — same "no reachable browser
tool in this environment" limitation every F02-F07 phase already documented, unrelated to the
production-fixtures restriction. Had a browser tool been available, the SYSTEM_ADMIN-only
portion (session/auth, `portal:access` role-gate returning the forbidden message for a
non-STUDENT_PARENT account, no unauthorized data exposure) would have been **PASS**-able
safely; the full Student/Parent journey would remain **BLOCKED BY NO PRODUCTION FIXTURES**
regardless.

## LOCAL/ISOLATED UAT

Performed via the mocked-API component/unit test suite (39 new F08 tests) against the local
dev environment's typecheck/lint/build — not a live local backend click-through (no browser
tool available in this environment, same limitation carried over from F02-F07). Every domain
area's read path, the evidence-upload mutation, the task output/status mutation, the child
switcher, the shell's 404-non-enumeration behavior, and the invitation acceptance flow are
each covered by at least one test exercising the real component against a mocked API layer
matching the live backend's actual response shapes.

## TESTS

**289/289 passing** (70 files: 250 carried over from F07 unchanged + 39 new F08 tests across
13 new test files). Covers: Portal home (empty/auto-redirect/picker), StudentSwitcher (hidden
for one, switches for many), PortalStudentShell (403/404-non-enumeration, success path),
PortalLayout (staff-role forbidden, STUDENT_PARENT shell renders), query-key cache privacy (5
tests spanning every domain area), Roadmap (empty state, milestone rendering, two-step
evidence upload), Task detail (redaction-by-omission, FSM-narrowed status buttons, real 409
surfaced, output submit), Documents (scan-status-gated download), Application detail
(checklist + currentOffer + evidence upload), Visa detail (redaction-awareness: reason/
interviewNotes render, internalNotes never does, no fabricated checklist section),
Notifications (portal-aware mark-read + navigate, empty state), portalNotificationHref (4
tests), staff Student page invite/revoke (2 new tests extending the existing F03 suite), and
the public invitation-acceptance page (success + real 409 surfaced).

## TYPECHECK

PASS — `npm run web:typecheck`, 0 errors.

## LINT

PASS — `npm run web:lint`, 0 errors, 0 warnings.

## BUILD

PASS — `npm run web:build` (Turbopack); all 18 new F08 routes (`/portal`, 16
`/portal/students/[id]/...` sub-routes, `/public/portal/invite/[token]`) compile alongside
every F01–F07 route — 64 routes total.

## BACKEND REGRESSION

PASS. **Zero backend files touched this phase** — `git status --short apps/api/ database/
docs/api/ docs/security/` shows exactly the same DEC-09/10/11/12 change set already
uncommitted from prior sessions, nothing new. Docker containers already running/healthy at
session start. `api:typecheck` PASS (0 errors), unit **182/182 PASS** (unchanged from F07),
full e2e **25 suites, 488/488 PASS** (unchanged from F07), both re-run to confirm the existing
baseline remains intact rather than assumed — full detail in `FRONTEND_BUILD_STATUS.md`'s
"Backend regression check — Phase F08".

## FILES CREATED

`lib/portal/{types,api,hooks,notification-links,notification-links.test}.ts`,
`lib/portal-access/{types,api}.ts`, `lib/api/query-keys.test.ts`,
`components/portal/{portal-student-shell,portal-nav,student-switcher,evidence-upload-dialog}.tsx`
(+ 2 test files), `app/(portal)/portal/page.tsx` (real content, +test),
`app/(portal)/portal/layout.test.tsx`, 16 `app/(portal)/portal/students/[id]/**/page.tsx`
route files (6 with their own test file: roadmap, tasks/[taskId], documents,
applications/[applicationId], visa/[visaId], notifications), `app/(public)/layout.tsx`,
`app/(public)/public/portal/invite/[token]/page.tsx` (+test), this phase-status file.

## FILES UPDATED

`lib/api/query-keys.ts` (added the `portal` namespace), `lib/api/error-messages.ts` (added F08
error codes), `lib/students/{api,hooks}.ts` (added `inviteParent`/`revokeParentAccess`),
`lib/notifications/*` (unchanged — reused as-is), `lib/documents/*` (unchanged — reused
`uploadDocument`/types as-is), `components/crm/status-badge.tsx` (added Task/PortalLinkStatus
variant+label maps), `app/(staff)/students/[id]/page.tsx` (added invite/revoke UI to the
Contacts card, +2 tests), `docs/ASSUMPTIONS.md` (ASM-79 through ASM-86),
`docs/frontend/{FRONTEND_ROUTES,FRONTEND_API_MAP,FRONTEND_PERMISSION_MAP,
FRONTEND_BUILD_STATUS}.md`. **No `docs/DECISIONS.md` entry** — zero backend changes.

## ASSUMPTIONS

- Portal has no Visa-checklist endpoint at all (ASM-79).
- Enrollment/Contract are Portal list-only, no per-record detail route (ASM-80).
- Portal notification navigation is Portal-aware, distinct from F07's staff-route map, and can
  link TASK_* events F07 never could (ASM-81).
- Portal Overview composes multiple existing endpoints client-side — no dedicated aggregate
  endpoint exists (ASM-82).
- Evidence submission is always two real backend calls (upload, then submit) — never one
  invented combined endpoint (ASM-83).
- Staff-side parent invite/revoke UI was added to the existing Student detail page — a direct,
  minimal-diff prerequisite for the Parent journey, not a redesign (ASM-84).
- `/public/portal/invite/[token]` is the one deliberately unauthenticated route this phase
  adds (ASM-85).
- Portal Task redaction is unconditional, not role-varying (ASM-86).

## RISKS

- No live-backend browser smoke test was performed (no browser tool available in this
  environment, same F02-F07 limitation) — separately, production has no Student/Parent
  fixtures to test the business flow against even if one were (F08 instruction §38/§39
  explicitly forbid fabricating them).
- The root `.env` still points at production Supabase (unchanged since F04) — every local test
  invocation this phase used explicit shell-env `DATABASE_URL`/`DIRECT_URL` overrides.
- `apiUpload`'s real multipart wire behavior for evidence submission was only exercised
  against mocked API calls, same depth as every other domain phase.
- The Overview page fires up to nine parallel requests (roadmap/tasks/applications/
  scholarships/visas/pre-departure/enrollment/contracts) on first load — each independently
  loading/erroring, never blocking the others, but a slow backend would show a page with
  several simultaneous loading skeletons rather than one combined spinner; not tested against
  a live backend's real latency.

## KNOWN ISSUES

- Contract/Enrollment remain list-only in the Portal (no detail route) — matches the live
  backend and F01's route map exactly, not a gap to close later unless the backend adds one.
- The Visa detail page has no checklist section — a real backend-shape limitation (ASM-79),
  not a frontend omission.
- `EvidenceUploadDialog`'s `ownerEntity`/`ownerId` are fixed to `"Student"`/the current
  studentId (not user-editable) — a deliberate simplification since the caller always knows
  their own context; consistent with, not a regression of, F07's manual-linkage-field
  precedent.

## READY FOR F09: YES
