# PHASE STATUS — F02 (API Client + Auth + RBAC + App Shell)

## PHASE F02 STATUS: PASS

## READY FOR F03: YES

## SUMMARY

Built the frontend's foundational plumbing on top of F01's scaffold: a centralized typed API
client with single-flight refresh-on-401 handling, a 5-state auth machine backed by the
backend's real JWT-access-token + httpOnly-refresh-cookie model, a working login page
(including the MFA challenge step), a UX-only RBAC permission layer mirroring
`docs/security/RBAC_MATRIX.md`, and a permission-aware app shell (sidebar/topbar/breadcrumbs/
user menu/notification-bell foundation) wrapping both the staff and portal route groups behind
a real (client-side) protected-route boundary. No business-domain page was built — only
`/dashboard` and `/portal` placeholder content exist behind the new auth gate, unchanged from
F01 otherwise.

## KEY DECISIONS (see `docs/DECISIONS.md` for full write-ups)

- Access token: in-memory only (`lib/auth/token-store.ts`), never `localStorage`. Refresh
  token: never read/stored client-side at all — the httpOnly cookie is the sole transport.
- Session bootstrap always attempts a silent `POST /auth/refresh` first (the in-memory token
  never survives a reload), only calling `GET /auth/me` if that succeeds.
- Single-flight refresh lock (`lib/api/client.ts`) — verified by a test asserting 3 concurrent
  401s produce exactly one `POST /auth/refresh` call, avoiding a race against the backend's
  refresh-token rotation.
- `RequirePermission`/`Sidebar` are UX-only; the backend remains the sole authorization
  authority (verified structurally: a 404 for a missing record and a 404 for an out-of-scope
  record produce identical `ApiError` shapes — the frontend has no logic that could leak the
  difference even if it tried).
- TanStack Query installed this phase (per DEC-08's own trigger condition) for server state;
  React state/Context for auth/UI state (unchanged from F01's plan).
- `happy-dom` used instead of jsdom for Vitest (documented environment-tooling workaround, not
  a silent swap — see `FRONTEND_BUILD_STATUS.md` "Known issues").

## KNOWN BACKEND GAP (flagged, not worked around)

`GET /auth/me` returns only `{ userId, roleCode, sessionId }` — no display name is recoverable
after a silent-refresh session restore, only right after an in-tab login. Documented in
`docs/frontend/FRONTEND_AUTH.md` §5; `UserMenu` falls back to the role label rather than
inventing a client-side cache of PII or a fake endpoint.

## VALIDATION

Typecheck PASS · Lint PASS (0 errors/warnings) · Build PASS (5 routes) · Tests PASS (50/50,
9 files) · Backend regression PASS (typecheck/lint unchanged, zero backend files touched).
Full detail: `docs/frontend/FRONTEND_BUILD_STATUS.md`.

## NOT IN SCOPE (explicitly deferred, not omissions)

MFA enrollment UI, password-reset UI, session-list/revoke-other-sessions UI, full notification
inbox (bell/unread-count foundation only — F07 owns the rest), every business-domain page
(F03+).
