# FRONTEND AUTH — Phase F02

Source of truth for everything below: `docs/security/AUTH_MODEL.md` (the backend's own
write-up) + `apps/api/src/modules/identity/auth/**` + `apps/api/src/common/context/
auth-context.middleware.ts` + `apps/api/src/common/guards/auth.guard.ts`. Nothing in this
document or the code it describes invents backend behavior — every claim here was verified
against the real backend source before being implemented.

## 1. Token strategy

| Token | Where it lives | Why |
|---|---|---|
| Access token (JWT, 15 min default) | **In-memory only** (`lib/auth/token-store.ts`, a module-level variable) — never `localStorage`/`sessionStorage`. | It's meant for `Authorization: Bearer` (AUTH_MODEL.md §3), and any JS-readable browser storage is exactly the XSS exfiltration surface a bearer token in memory avoids. Cost: a full page reload loses it — see §2. |
| Refresh token (opaque, rotates on every use) | **Never stored client-side at all.** The backend sets it as an `httpOnly`, `SameSite=Strict`, `path=/auth` cookie; this app relies on the browser forwarding that cookie automatically (`credentials: "include"` on every request) and never reads it. | AUTH_MODEL.md §3 says explicitly: "when one [frontend] is built, it should prefer the cookie and never touch the body value for storage." The login/refresh response body also contains a `refreshToken` field (for non-browser clients) — this app's code (`lib/auth/auth-api.ts`'s `applyLoginResult`) deliberately never reads it. |
| Display profile (`username`/`email`/`fullName`) | In-memory only, in `AuthContext`'s `displayUser` — populated ONLY from an actual login/MFA-verify response body. | See §5, "Known backend gap." |

**Verified, not assumed**: `lib/auth/token-store.test.ts` has a test that stubs
`document.cookie`'s getter and asserts a full login→logout cycle never invokes it.

## 2. Session bootstrap (on app start)

Because the access token is memory-only, it does not survive a page reload. Bootstrap
(`AuthProvider`'s mount effect, `lib/auth/auth-context.tsx`) therefore runs in this order —
deliberately different from a naive "call `/auth/me` first" approach, which would always 401
immediately after a reload with nothing to show for it:

1. Call `POST /auth/refresh` with an **empty body** (`{}`) — the httpOnly cookie, if a valid
   one exists, is what actually authorizes this call.
2. **Refresh fails** (no cookie, expired, or already-rotated) → `UNAUTHENTICATED`. This is the
   ordinary "anonymous visitor" case, not an error — most page loads for a signed-out user
   hit this path.
3. **Refresh succeeds** → a fresh access token is now in memory. Call `GET /auth/me` to
   resolve the `Principal` (`userId`/`roleCode`/`sessionId`).
4. `GET /auth/me` succeeds → `AUTHENTICATED`.
5. Anything else unexpected (network failure, 5xx on either call) → `ERROR`, a distinct
   state from `UNAUTHENTICATED` — `RequireAuth` shows a real "couldn't verify your session"
   message here, not a silent redirect to login that would look like nothing happened.

## 3. Auth state machine

Five explicit `AuthStatus` values (F02 instruction §8 — never a bare `principal === null`
standing in for both "still loading" and "definitely signed out"):

```
INITIALIZING → (bootstrap in flight, first render only)
AUTHENTICATED → (principal resolved, real session)
UNAUTHENTICATED → (no session — either never logged in, or a refresh definitively failed)
REFRESHING → (a login()/mfaVerify() call is in flight — reused for this too, not a 6th state)
ERROR → (bootstrap failed unexpectedly — not the same as "not logged in")
```

`RequireAuth` (`components/shell/require-auth.tsx`) renders a loading skeleton for
`INITIALIZING`/`REFRESHING`, an error message for `ERROR`, redirects (`router.replace`,
preserving `?next=<original path>`) for `UNAUTHENTICATED`, and only then renders the
protected shell for `AUTHENTICATED`.

## 4. Refresh flow — single-flight, not per-request

**The race this avoids**: three components each firing an API call the instant an access
token expires would each independently see a 401 and each try to refresh — but the backend's
refresh token **rotates on every use** (AUTH_MODEL.md §2: the presented token is revoked and
replaced). Two concurrent `POST /auth/refresh` calls racing each other means the loser
presents an already-rotated token and gets `401 INVALID_REFRESH_TOKEN`, corrupting a session
that should have been fine.

**The fix** (`lib/api/client.ts`): a single module-level `refreshPromise`. The first caller
to hit a 401 starts the actual `POST /auth/refresh` call and stores the in-flight promise;
every other caller (concurrent 401s, or `AuthProvider`'s own bootstrap-time refresh) awaits
that SAME promise instead of starting a second one. **Verified**: `lib/api/client.test.ts`
"three concurrent 401s trigger exactly one POST /auth/refresh call."

**On refresh success**: the failed request is retried exactly once with the new token
(`_isRetry` flag prevents a second retry loop if the retried request somehow 401s again).

**On refresh failure**: the access token is cleared, `notifySessionExpired()` fires (a plain
callback registry in `token-store.ts` — `lib/api/` never imports React), `AuthProvider`'s
listener (registered on mount) transitions to `UNAUTHENTICATED`, clears the React Query
cache, and redirects to `/login`. The original request's caller still receives a real
`ApiError` (never hangs waiting forever) — its own error handling (e.g. a React Query
`onError`) still runs.

**Endpoints that never trigger this dance** (`AUTH_ENDPOINTS_NO_RETRY` in `client.ts`):
`/auth/login`, `/auth/refresh`, `/auth/mfa/login-verify`, `/auth/logout` — a failed login
attempt must never try to "refresh" its way past `INVALID_CREDENTIALS`.

## 5. Login + MFA flow

`POST /auth/login` returns one of two shapes (`LoginResponse` in `lib/auth/session.ts`,
mirroring `AuthController.login` exactly):

- `{ accessToken, refreshToken, expiresInMinutes, user }` — password (and, if MFA isn't
  enabled, everything) checked out; the caller is authenticated.
- `{ mfaRequired: true, mfaToken }` — password was correct but a TOTP/backup code is still
  required. `LoginForm` (`components/auth/login-form.tsx`) switches to the MFA step and calls
  `POST /auth/mfa/login-verify { mfaToken, code }` to complete it, which returns the same
  first shape on success.

**Known backend gap: no display-name-bearing self endpoint on session restore.** `GET
/auth/me` returns only `{ userId, roleCode, sessionId }` — no `username`/`fullName`. The
richer `user` object only ever comes back from the login/MFA-verify response body itself.
Practical effect: `AuthContext.displayUser` is populated right after an in-tab login, but is
`null` after a silent-refresh session restore (e.g. the user reloads the page). `UserMenu`
(`components/shell/user-menu.tsx`) handles this by falling back to the role label
(`roleLabel(roleCode)`) instead of showing a blank name. **This was not silently worked
around** (no client-side caching of PII across reloads, no invented endpoint) — flagging it
here is the deliberate resolution per this phase's own instruction ("Nếu backend source hiện
tại khác documentation... ghi discrepancy nếu cần. Không tự invent API"). A future backend
change (e.g. `GET /auth/me` returning the full safe profile, or a dedicated `GET /users/me`)
would let this be fixed without any frontend architecture change — `displayUser` and
`principal` are already separate fields for exactly this reason.

**MFA enrollment** (`POST /auth/mfa/enroll` / `/enroll/confirm`) is **not built in F02** — it
requires an already-authenticated session and is a user-settings feature, not part of the
login/bootstrap flow this phase's "Auth Shell" scope covers. Only the login-time MFA
*challenge* (verifying a code from an already-enrolled device) is implemented.

Passwords are never logged (`lib/auth/login-form.tsx` has no `console.log` on this path,
verified by a test asserting no console call ever contains the typed password) and are
cleared from component state immediately after every submit attempt, success or failure.

## 6. Logout

`AuthContext.logout()`: calls `POST /auth/logout` (revokes the session server-side — the very
next `GET /auth/me`-equivalent check anywhere, including a still-open second tab's next
request, will 401), clears the access token, clears the React Query cache
(`queryClient.clear()` — no stale AUTHENTICATED-only data lingers visible after logout),
clears `principal`/`displayUser`, and redirects to `/login`. The backend call happens inside
a `try/finally` (`lib/auth/auth-api.ts`) — client state is cleared even if the network call
itself fails, since staying "logged in" locally while the backend call's outcome is unknown
is worse than the reverse.

## 7. Route protection

Two layers, matching F02 instruction §9's three categories:

- **PUBLIC** — `app/(auth)/login`, the root `/` landing page. No `RequireAuth`.
- **AUTHENTICATED** — `app/(staff)/*` and `app/(portal)/portal/*`, gated by
  `<RequireAuth>` in their respective layouts.
- **PERMISSION-GATED** — `<RequirePermission resource action>` wraps a specific
  section/page (used today on the Portal layout itself, gated on `portal:access`; a future
  Admin/Finance/Reporting page in F03+ wraps its content the same way).

**Why `proxy.ts` (formerly `middleware.ts`) cannot do this instead**: cookies are
origin-scoped. The refresh_token cookie is set by the *backend's* origin
(`NEXT_PUBLIC_API_URL`), a different origin from this Next.js app in every real deployment
(different port locally, different domain/subdomain in production) — so the frontend's own
server-side `proxy.ts` never receives that cookie on a request to itself and has no way to
know whether a session exists. Route protection is therefore necessarily a **client-side**
gate (`RequireAuth`, checking `AuthContext` state) — exactly the "UX convenience, not the
security boundary" framing F02 instruction §9 requires: the backend independently
re-authorizes every actual API call regardless of what any frontend gate does or doesn't do.

## 8. Permission resolution

`lib/permissions/rbac-data.ts` is a transcribed, UX-only mirror of
`docs/security/RBAC_MATRIX.md` §2/§3 (backend source of truth: `database/seeds/seed.ts`
`GRANTS`). `can(roleCode, resource, action)` / `canAny` / `canAll` (`lib/permissions/
use-permissions.ts`) are pure functions plus a `usePermissions()` hook bound to the current
session's role. Used by: `Sidebar` (hides whole nav groups when every item in them is
denied, not just individual items), `RequirePermission` (section/page-level gate).

**This is UX only.** Every one of these checks is re-verified server-side on every real
request. A stale or wrong entry in `rbac-data.ts` degrades to "hid a button that would have
worked" or "showed a button that gets a real 403" — never to an unauthorized action actually
succeeding, because nothing in this layer skips or replaces the backend's own
`AuthGuard`/`RequirePermission`/`ScopePolicyService` checks.

## 9. Scope-aware UX (not scope-aware authorization)

`rbac-data.ts` also carries `STUDENT_CASE_SCOPE`/`LEAD_SCOPE`/`CONTRACT_PAYMENT_SCOPE`
(`GLOBAL`/`CASE_MEMBER`/`OWN_STUDENT`/`OWN_LEAD`/`NONE` per role, from RBAC_MATRIX.md §3) —
informational only, for a future list page to decide whether to show an "all records" vs.
"my records" filter toggle. **It must never be used to decide whether one specific record is
reachable.** No F02 code treats `/students/:id` as accessible merely because the route
exists or because the caller's role has `CASE_MEMBER` scope in general — the backend's actual
response (200 with the record, or 404 for both "doesn't exist" and "not in your scope" — see
§10) is the only source of truth for that, and no code path in this phase tries to guess it
in advance.

## 10. 401/403/404/409/422/429 handling

Full convention detail: `docs/frontend/FRONTEND_API_MAP.md` §1. Summary of what F02 actually
wires up:

- **401** → the refresh-and-retry flow above (§4); a definitive failure clears session state
  and redirects to `/login`.
- **403** → `RequirePermission`'s forbidden UI, or (for an action inside an already-rendered
  page) the caller's own error handling using `error.code === 'PERMISSION_DENIED'`.
- **404** → rendered generically ("not found") — F02 code never attempts to distinguish
  "doesn't exist" from "exists but out of scope" (`lib/api/client.test.ts` has a test
  constructing both cases identically and asserting the resulting `ApiError`s are
  structurally indistinguishable, proving no such logic exists to accidentally leak this).
- **409/422/429** — not specially handled by any F02 UI yet (no mutation flows exist before
  F03+); `ApiError.code`/`ApiError.raw` carry everything a future mutation handler needs
  (e.g. `IDEMPOTENCY_KEY_REUSED` on 409, `RATE_LIMITED` on 429).
- **5xx** — generic `ApiError`, `requestId` preserved for support/debugging (never a stack
  trace, SQL, or filesystem path — the backend's own `ErrorContractFilter` already guarantees
  that; the frontend has no code that could show any of that even if the backend leaked it).

## 11. Environment variables

`apps/web/.env.example` — only `NEXT_PUBLIC_API_URL` is actually read by any code
(`lib/api/client.ts`). `NEXT_PUBLIC_APP_NAME`/`NEXT_PUBLIC_DEFAULT_LOCALE` were considered
(F02 instruction §21 lists them as optional) but not added — nothing in the codebase reads
them yet (the app name is a literal in `app/layout.tsx`'s `metadata`, the locale is a literal
`lang="vi"`); adding unused env vars was judged worse than the (currently zero) cost of
hard-coding two values that aren't expected to vary per environment.

### Local development: CORS

`npm run web:dev` runs on port **3001** specifically to avoid colliding with `apps/api`'s
default port 3000 when both run locally. For the httpOnly-cookie flow to work against a
locally-running backend, the backend's `CORS_ALLOWED_ORIGINS` env var must include this app's
exact origin, `http://localhost:3001` (`apps/api/src/main.ts`: CORS is closed — `origin:
false` — unless explicitly configured, and `credentials: true` + a wildcard origin is
rejected by the spec, so this must be an exact match, not `*`). This is a local `.env`
change, not a backend code change.

## 12. What is explicitly NOT in F02

- Full notification center (bell badge/unread-count only — `components/shell/
  notification-bell.tsx` — F07 owns the inbox UI).
- MFA enrollment UI (§5).
- Password reset UI (`/auth/password-reset/*` exists on the backend, unused by any F02 page).
- Session list/revoke-other-sessions UI (`GET /auth/sessions`, `POST /auth/sessions/:id/
  revoke` exist on the backend, unused by any F02 page) — a natural Admin/Account-settings
  feature for a later phase.
- Any business-domain page (Leads/Students/Cases/... — F03+).
