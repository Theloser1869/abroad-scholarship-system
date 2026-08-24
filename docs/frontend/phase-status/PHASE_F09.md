# PHASE STATUS — F09 (UX Hardening + Accessibility + Performance)

## PHASE F09 STATUS: PASS

## READY FOR F10: YES

## SUMMARY

Full-frontend UX/accessibility/performance hardening pass over F01–F08's CRM + Portal
surfaces. **No new business feature, no business-behavior change** — every change is either a
shared-component extraction of an already-duplicated pattern, an ARIA/visual/contrast fix, a
client-side redirect-target validation, or a query-freshness tuning. **Zero backend files
touched.** Three genuine, previously-undetected Next.js routing configuration bugs were found
and fixed (route-folder dynamic-slug-name conflicts) — found only because this phase actually
started `next dev` and a real browser for the first time in this project's history; `next
build` alone never caught them across F04–F08. Full detail below; see
`FRONTEND_BUILD_STATUS.md`'s "Validation results — Phase F09" / "Backend regression check —
Phase F09" for the raw command output this report summarizes.

## UX HARDENING

Systemic sweep for duplicated UX patterns, replacing each with one shared component (component-
consistency rule: reuse when a pattern repeats ≥2 times, not before): `window.confirm(...)` → a
new `ConfirmDialog` (11 call sites, 8 files) — no destructive action in the app now uses the
un-stylable, untestable browser-native confirm; raw `<textarea>` → a new `Textarea` (25 files,
all sharing `Input`'s `FORM_CONTROL_CLASSES`); the hand-rolled debounced-search `<Input
type="search">` block → a new `SearchInput` (7 list pages), which also fixed a latent duplicate-
clear-icon bug (the native WebKit search-cancel button was rendering next to the custom ✕).

## DESIGN SYSTEM

`--muted-foreground` tightened from `#6b7280` (≈4.83:1 on white, already AA) to `#4b5563`
(≈7.56:1, AAA-level margin) — computed by hand via the standard relative-luminance contrast
formula, not guessed; this token is used for table metadata, timestamps, and helper text, the
exact class of text most often skimmed or read by a low-vision user. `Input`/`Textarea`/
`SearchInput` gained an explicit `focus:ring-2 focus:ring-primary/30` alongside the pre-existing
`focus:border-primary` (WCAG 2.4.7 — a border-color-only change is too subtle a focus indicator
on some displays/zoom levels). No new color/spacing/typography tokens invented — this phase
tightened existing ones, it did not introduce a second system.

## FORMS

Audited every dialog form against F09's checklist (labels, helper text, submit-disabled-while-
submitting, preserve input on error, focus-first-invalid-field via native `required`/browser
validation, keyboard submit via native `<form onSubmit>`) — already correct across F02–F08's
forms; the one real gap found and fixed was **422/validation surfacing**:
`ApiError.details` (class-validator field-message array) had been captured on every `ApiError`
since early phases but never read anywhere in the UI. `crmErrorMessage` (`lib/api/
error-messages.ts`) now checks `CODE_MESSAGES[error.code]` first, then falls back to the joined
`details` array (the backend's actual field-level messages) before finally falling back to the
raw `error.message` — a validation failure without a specific code mapping now shows the real
reason instead of a generic string. Verified via `ErrorContractFilter`'s own spec that a
`ValidationPipe` failure really does produce `{message: [...strings], statusCode:400}` routed
into `details`, confirming this fallback fires on real backend responses, not an invented shape.

## TABLES

Audited `Table`/`TableHeaderCell` usage app-wide: every table already uses `TableHeaderCell`
exclusively for column headers (no row-header pattern exists anywhere in this app), so
defaulting `scope="col"` there is a correct blanket fix, not a guess-based one. Pagination,
sort, loading/empty/error states were already backend-metadata-driven from F03–F08 (no
"fetch all records" pattern found); no change needed there this phase.

## LOADING STATES

No spinner-only blank-screen pattern or layout-jump found in the existing `LoadingState`/
skeleton usage from F02–F08. The one real fix: `usePortalProfile` (Portal's own authorization-
probe query) now uses `staleTime: 0` instead of the global 30s default — without this, switching
between two Portal children could very briefly keep serving the previous child's cached
authorization result while the new probe was in flight, which is exactly the cross-child
data-leak class F09 §19/§27 calls out. Verified with a new test
(`portal-student-shell.test.tsx`) asserting a fully unmounted-and-remounted shell for a second
student never shows the first student's data at any point.

## ERROR STATES

401/403/404/409/422/429/500 were already distinguished correctly across F02–F08 (`ApiError`'s
retry policy never retries 401/403/404/409/422/429; `QueryErrorState` surfaces the mapped
message). Confirmed directly in this session's own RBAC testing: a SYSTEM_ADMIN account lacking
`reports:view`/`leads:view` renders the exact non-enumerating "Không có quyền truy cập. Tài
khoản của bạn không có quyền `<resource>:<action>`." message — the security-conscious wording
already established in F02 was not weakened. The `details`-array surfacing (FORMS, above) is
this phase's one real 422 improvement.

## EMPTY STATES

Audited for "explains what's empty, why, and next action" — no fake-zero pattern found;
`EmptyState` usage from F03–F08 already carries a title+description per call site. No change
needed this phase.

## ACCESSIBILITY

`TableHeaderCell scope="col"` default, `Input`/`Textarea`/`SearchInput` focus ring, danger-toast
`role="alert"`/`aria-live="assertive"` (was `role="status"`/`"polite"` — error announcements
should interrupt, not politely wait, unlike a routine success toast which correctly stays
polite). `Dialog` (native `<dialog>` + `showModal()`) was already correct — confirmed directly
in live-browser testing this phase (Escape, the header ✕, and the form's own Cancel button each
independently close it; see BROWSER TEST). No ARIA added where native HTML semantics already
covered it (native `<dialog>`, native `<table>`, native `<button>`/`<a>` throughout — no
`role="button"` on a `<button>`, no `aria-modal` hand-added onto an element that already gets it
from `showModal()`).

## KEYBOARD

Verified live in-browser this phase: Tab-based form fill-in, native `<form>` Enter-to-submit on
the login form, Escape-to-close on a real modal `Dialog`, and standard link/button activation
across Leads/Students/Cases navigation. Not separately keyboard-tested this phase: Portal
child-switch, Document upload/download, and Notification-bell keyboard flows specifically (the
browser session disconnected before reaching them — see BROWSER TEST).

## SCREEN READER

No dedicated screen-reader software pass (no such tool available in this environment, same
limitation as F02–F08 for anything beyond static ARIA/semantic-HTML review). Reviewed
structurally instead: heading hierarchy (`<h1>` per page, `<h2>` per `Dialog`/`Card` title,
`useId()`-backed label association throughout), landmark usage (`<nav aria-label>` in the
sidebar/`PortalNav`), and the toast/status announcement fix above (ERROR toasts now
`aria-live="assertive"`, matching how a screen reader user would expect a failure to interrupt).

## CONTRAST

`--muted-foreground` fix (DESIGN SYSTEM) is the one real, measured contrast change this phase.
Status badges, disabled controls, and nav links were spot-checked against the existing
`success`/`warning`/`danger`/`info` token set (unchanged since F01) and found already
AA-compliant; no further token changes made.

## RESPONSIVE

No live multi-viewport browser pass was completed this phase (the browser session disconnected
before a dedicated 320/375/768/1024/1280/1440 sweep — see BROWSER TEST); reviewed statically
instead: `PortalNav`'s horizontal-scroll tab strip and Card-based Portal lists (F08) remain
mobile-first and unchanged; staff Table pages already scroll horizontally inside their own
`overflow-x-auto` container (F03–F08 convention) rather than collapsing to cards, matching F09's
"never turn every table into cards" instruction.

## PORTAL UX

`usePortalProfile`'s `staleTime: 0` (LOADING STATES) is this phase's one Portal-specific fix. A
new test asserts cross-child isolation end-to-end (unmount Student A's shell, mount Student B's,
assert Student A's data never appears). Live child-switch UI testing (StudentSwitcher click-
through) was not completed before the browser session disconnected.

## DOCUMENT UX

No changes made or needed — F07's upload progress/scan-state/rejected-file/download/
version-history/access-error handling was reviewed and found already compliant (no raw
R2/storage-path/signed-URL exposure anywhere in the UI, confirmed by grep, not just reading one
page). Live upload/download click-through was not completed before the browser session
disconnected; the Documents list page was confirmed to load cleanly (zero console errors) via
direct navigation.

## NOTIFICATION UX

Danger-toast `aria-live="assertive"` fix (ACCESSIBILITY) is this phase's one Notification-
adjacent change. Live-browser testing confirmed the Notifications page renders real unread
items with working "Đánh dấu đã đọc" (mark-read) controls and zero console errors, for both a
staff (EXECUTIVE_DIRECTOR) and a STUDENT_PARENT account. No excessive-polling or duplicate-
notification issue found in the existing F07 implementation on review.

## REPORTING UX

No changes made or needed — F07's dashboard loading/filter/chart/table/export/empty/error
handling was reviewed and found already compliant (totals are backend-computed, never
frontend-aggregated). Confirmed live: an EXECUTIVE_DIRECTOR account's `/dashboard` renders real
KPI cards (case counts, overdue payments/tasks, revenue-by-currency, pipeline breakdowns) with
zero console errors and no visible layout shift.

## AUTH UX

**Real fix this phase**: `login-form.tsx`'s `?next=` redirect now rejects a `//`-prefixed value
(protocol-relative open-redirect) and a `/login`-prefixed value (self-loop back to the login
page), falling back to the role default in both cases — verified with 3 new tests. Verified live
this phase: login, logout (redirects to `/login?next=<original path>`), and re-login honoring a
safe `?next=` all work correctly with zero console errors; no infinite-redirect-loop or
flashing-authenticated-content issue observed.

## SECURITY UX

Grepped for token/password/credential logging in URL/query-params/console/localStorage/
sessionStorage — none found (unchanged from F02's original design: httpOnly refresh cookie,
access token held in memory only, never persisted to any browser storage). The `?next=`
open-redirect fix (AUTH UX) is this phase's one genuine security-UX hardening change.

## PERFORMANCE

Static/build analysis only (see BUNDLE) — no Lighthouse/production-traffic measurement tool was
available in this environment, same limitation as F02–F08 for anything beyond `next build`'s own
reported figures. Not fabricating a number where no tool measured one.

## NETWORK

Reviewed TanStack Query configuration (`lib/api/query-client.ts`): global `staleTime: 30_000`,
conservative retry policy (never retries 401/403/404/409/422/429; mutations never auto-retry) —
already well-designed from F02, no change needed except the one Portal-specific
`staleTime: 0` override (LOADING STATES/PORTAL UX). No waterfall, no duplicate-endpoint-
combining-into-a-frontend-aggregate pattern found on review.

## RENDERING

No blanket-`memo()` pattern found or added — the existing components already memoize only where
a specific list-re-render cost was previously identified (F04–F07), consistent with F09's "no
memoization without justification" instruction. No change made this phase.

## BUNDLE

`next build` output (Turbopack): 64 routes, compiled in 105s, TypeScript checked in 89s, 21/21
static pages generated. Server Components remain the default throughout (only interactive
leaf components are `"use client"`, unchanged posture since F01); no dynamic-`import()`
code-splitting was added this phase — no single feature was identified as heavy enough to
justify one over the existing per-route code splitting Next.js already provides automatically.

## BROWSER TEST: PARTIAL (tool was available; several critical flows verified with zero console
errors; session ended before full 13-flow coverage — see detail below)

A real Chrome browser automation connection **was available** in this environment (confirmed for
the first time across F02–F09 — prior phases' "not available" was never actually tested). Local
`apps/api` (port 3000) and `apps/web` (port 3001) dev servers were started against a local Docker
Postgres, seeded with the repo's existing `DEMO_USERS` fixtures.

**Verified live, with zero console errors/exceptions at every step** (checked via
`read_console_messages` after each navigation): Login (`admin`/`ChangeMe!123` and
`demo.director`/`DemoPass!123`), logout (correct `?next=` redirect), RBAC 403 rendering
(SYSTEM_ADMIN correctly denied `reports:view`/`leads:view` with the exact non-enumerating
message), Dashboard (real KPI data, EXECUTIVE_DIRECTOR role), Leads list + detail + create
dialog (Escape/✕/Cancel all correctly close the native `<dialog>`), Students list + detail,
Cases list + detail + the F09-fixed `cases/[id]/applications` sub-route (confirming the
route-folder rename works correctly, not just in `next build`), Documents list, Notifications
(real unread items + working mark-read), and login as a `STUDENT_PARENT` account
(`demo.parent.linked`) with the `?next=` redirect honored.

**Not completed**: Portal page itself and the Parent/child-switch privacy flow, Contract/
Visa-specific dialogs, Document upload/download click-through, and a dedicated multi-viewport
responsive sweep — the Chrome extension's connection dropped (`"Browser extension is not
connected"`) partway through the session and did not reconnect after two retry attempts,
consistent with the "avoid rabbit holes... stop after 2-3 failed attempts" guidance for browser
automation. No flow was reported as PASS without being directly checked; nothing above is a
guess.

**A tooling caveat worth recording**: this session's `computer: screenshot` action was
unreliable — it intermittently rendered a stale/cached frame that did not match the live DOM
(verified by cross-checking `document.querySelectorAll('dialog[open]')` via `javascript_tool`
against a screenshot taken at the same instant, on the same single tab, which disagreed). Every
finding above was confirmed via `read_page` (accessibility tree) or `javascript_tool` (direct DOM
query) — ground truth, not the screenshot image — specifically because of this. An earlier
apparent finding ("clicking a dialog's close button doesn't close it") did not reproduce under
DOM-ground-truth verification and was retracted as a screenshot/tab-focus artifact, not a real
bug — recorded here so a future session doesn't waste time re-chasing it.

## TESTS

**305/305 passing** (73 files: 289 carried over from F08 unchanged + 16 new F09 tests across 4
files — `confirm-dialog.test.tsx` (4), `search-input.test.tsx` (2), `error-messages.test.ts`
(5), `login-form.test.tsx` (+3 new, extending the existing F02 suite) — plus one new test added
to the existing `portal-student-shell.test.tsx` for cross-child isolation).

## TYPECHECK

PASS — `npm run web:typecheck` (`npx tsc --noEmit`), 0 errors.

## LINT

PASS — `npm run web:lint`, 0 errors, 0 warnings.

## BUILD

PASS — `npm run web:build` (Turbopack), 64 routes, 21/21 static pages generated, 105s compile +
89s typecheck. Re-run clean after the three route-folder renames (below) to confirm no leftover
slug conflicts.

## BACKEND REGRESSION

PASS. **Zero backend files touched this phase.** `api:test` (unit): **182/182 PASS**, unchanged
from F08's baseline (the one `ERROR`-level log line is `error-contract.filter.spec.ts`'s own
intentional fixture). `api:test:e2e`: **487/488 passed** on the full parallel-worker run; the
one failure was traced to a local-filesystem-storage/parallel-Jest-worker artifact of this
session's ad hoc local setup (not a code regression — the same spec passed **26/26** re-run in
isolation), reconfirming the established **488/488** baseline. Full detail, including the exact
failure/re-run output, in `FRONTEND_BUILD_STATUS.md`'s "Backend regression check — Phase F09".

## FILES CREATED

`components/crm/confirm-dialog.tsx` (+test), `components/ui/textarea.tsx`,
`components/ui/search-input.tsx` (+test), `lib/api/error-messages.test.ts`,
`docs/frontend/phase-status/PHASE_F09.md` (this file).

## FILES UPDATED

`components/ui/input.tsx` (extracted `FORM_CONTROL_CLASSES`, added focus ring),
`components/ui/table.tsx` (`TableHeaderCell` default `scope="col"`), `components/ui/toast.tsx`
(danger variant → `role="alert"`/`aria-live="assertive"`), `app/globals.css`
(`--muted-foreground` contrast fix), `lib/api/error-messages.ts` (`details`-array fallback),
`lib/portal/hooks.ts` (`usePortalProfile` `staleTime: 0`), `components/auth/login-form.tsx`
(+test — `?next=` open-redirect/self-loop hardening), `components/portal/
portal-student-shell.test.tsx` (+1 cross-child isolation test); 11 dialog call sites across 8
files (`window.confirm` → `ConfirmDialog`); 25 files (raw `<textarea>` → `Textarea`); 7 list
pages (search `<Input>` → `SearchInput`); three route-folder renames — `app/(staff)/
applications/[applicationId]/offers` → `.../[id]/offers`, `app/(staff)/cases/[caseId]/**` (9
sub-routes) → `.../[id]/**`, `app/(staff)/partners/[partnerId]/commission-rules` →
`.../[id]/commission-rules` — each with its moved `page.tsx`'s `params` type/destructuring
updated to match; `docs/frontend/{FRONTEND_ROUTES,FRONTEND_BUILD_STATUS}.md`. **No
`docs/DECISIONS.md` entry** — zero backend changes, and the route-folder rename is an internal
Next.js param-name fix, not an architectural decision. **`FRONTEND_ARCHITECTURE.md` not
updated** this phase — consistent with F02–F08's own precedent of only touching it for genuine
new architectural decisions (this phase's shared-component additions are design-system/UI-
primitive extractions, not new architecture).

## ASSUMPTIONS

- The three route-folder renames change no URL and no backend contract — verified by grepping
  every caller's own URL construction (`/cases/${id}/applications` etc.) before renaming, and by
  a clean `next build` + live-browser navigation to the renamed route afterward (ASM, this
  phase — see `FRONTEND_ROUTES.md`'s F09 note).
- `crmErrorMessage`'s new `details`-array fallback can only fire when a real backend response
  omits a `CODE_MESSAGES` entry — verified no existing test constructs an `ApiError` fixture with
  a `details` field, so this change carries zero regression risk to existing test expectations.
- `usePortalProfile`'s `staleTime: 0` trades a small amount of extra network traffic (one
  authorization re-check per Portal navigation) for correctness on the cross-child-privacy
  requirement — an intentional, documented tradeoff, not an oversight.

## RISKS

- Browser testing did not reach the Portal/child-switch flow, Contract/Visa dialogs, Document
  upload/download, or a multi-viewport responsive sweep before the Chrome extension
  disconnected — these remain verified only via typecheck/lint/build/unit-test coverage and
  static code review, the same depth as F02–F07's "no browser tool" phases, not live-clicked.
- The local dev environment's `next dev` (not `next build`) is the only way the three routing
  bugs were ever going to surface — if a future phase adds a new dynamic-segment sibling
  directory without running `next dev` at least once, the same class of bug could reappear
  silently past a clean `next build`+deploy.
- The root `.env` (gitignored) still points `DATABASE_URL`/`DIRECT_URL` at production Supabase —
  unchanged since F04; every local command this phase used explicit shell-level overrides.

## KNOWN ISSUES

- One e2e test (`admission-application.e2e-spec.ts`) failed on the full parallel-worker run in
  this session's local environment due to a local-filesystem-storage/parallel-Jest-worker
  artifact, not a code defect (passed 26/26 in isolation) — worth noting for whoever next runs
  the full e2e suite locally with `STORAGE_PROVIDER=local` under parallel workers, though this
  does not affect CI/production (which uses `STORAGE_PROVIDER=r2`).
- The `computer: screenshot` browser-automation action was unreliable in this session (stale/
  cached frames disagreeing with live DOM state, see BROWSER TEST) — a future session doing
  browser testing here should verify state via `read_page`/`javascript_tool`, not screenshots
  alone.

## READY FOR F10: YES
