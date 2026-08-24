# PHASE STATUS — F11A (Same-Origin Frontend/API Deployment Architecture)

## PHASE F11A STATUS: PASS

## SUMMARY

Implemented and verified — with real HTTP evidence, not just re-reading configuration — the
same-origin frontend/API proxy architecture F11 recommended but did not build: the browser
addresses only the frontend's own origin (`/` for pages, `/api/*` proxied server-side to the
real backend), keeping the refresh cookie's `SameSite=Strict` policy fully intact and working.
Local development is completely unaffected (still calls the backend directly, zero dependency
on any hosting platform). One additional, genuine cookie-attribute incompatibility was
discovered while verifying the proxy live (`Path=/auth` not matching the browser-visible
`/api/auth/*` path) and fixed with a minimal, thoroughly-tested backend change — the one
necessary exception to this phase's "prefer zero backend changes" default, proven necessary
by direct reproduction, not assumed. No deployment performed, no Vercel project created, no
DNS touched, no production database touched.

## SAME-ORIGIN ARCHITECTURE

```
Browser
  ↓
Frontend origin (production: e.g. https://<app>.vercel.app; local: http://localhost:3001)
  ├── /                → Next.js frontend
  └── /api/:path*      → next.config.ts rewrites() → API_PROXY_TARGET/:path*
                          (production: https://abroad-scholarship-system.onrender.com;
                           local: unset — no rewrite registered, direct calls unaffected)
```

Verified live, real HTTP, this phase (local `next start` in production mode + local `apps/api`
+ local Docker Postgres — never production Supabase/R2):
- `curl http://localhost:3001/api/health` → the real backend's `{"status":"ok"}`, proxied.
- Real browser session: zero direct requests to the backend's own port/origin anywhere in the
  Network tab across login, dashboard, CRM/commercial/admission/visa/document/portal
  navigation — every single API call observed at `localhost:3001/api/*`.

## FRONTEND API PATH

`apps/web/lib/api/client.ts`'s `apiFetch`/`apiUpload`/`apiDownloadBlob`/`resolveApiUrl` all
resolve exclusively through `NEXT_PUBLIC_API_URL` — now legitimately either an absolute origin
(local dev) or the relative path `/api` (same-origin proxy). `buildUrl` was changed from
`new URL(...)` (throws on a bare relative string like `/api`) to plain string concatenation +
`URLSearchParams`, since `fetch()`/`window.open()` both natively accept a relative URL,
resolved against the current page's own origin. No frontend code anywhere calls the backend's
real origin directly — grepped fresh: zero hard-coded `onrender.com` anywhere in `apps/web`.

## PROXY

`apps/web/next.config.ts` gained an `async rewrites()` export: `/api/:path*` →
`${API_PROXY_TARGET}/:path*`, registered **only** when the server-only `API_PROXY_TARGET` env
var is set (never `NEXT_PUBLIC_*` — read only inside `next.config.ts`, which runs in Node.js
at Next's request-routing layer, never shipped to the browser). Verified this phase to
transparently forward, with no additional wiring: `GET`/`POST` (login, refresh, logout, list/
detail reads), a real `multipart/form-data` upload (`POST /api/documents`, 201, a real
document created with correct filename/MIME/checksum), and a binary/streamed download (the
two-step signed-URL flow, byte-exact file content returned). This is Next.js's own documented
external-rewrite mechanism (`node_modules/next/dist/docs/.../rewrites.md` "Rewriting to an
external URL") — a routing-layer proxy, not a hand-written route handler reimplementing
header/body/streaming forwarding.

## COOKIE

The refresh-token cookie is set by the backend but, because the browser only ever addresses
the frontend's own origin, the `Set-Cookie` response (relayed transparently through the proxy)
is stored by the browser against the **frontend's own origin** — verified via `curl -v`:
`Set-Cookie: refresh_token=...; Path=/; ...; HttpOnly; SameSite=Strict`, no `Domain=`
attribute (host-only, correctly scoped to whichever origin actually responded). The refresh
token is confirmed never exposed to JavaScript — `document.cookie` checked live in a real
browser, does not contain it (httpOnly enforced correctly).

## SAMESITE

**Kept exactly as `Strict` — never relaxed to `None`.** Confirmed unchanged, live, via the
same `curl -v` login response above. This was the whole point of implementing the proxy rather
than taking the documented fallback (relaxing `SameSite`) — proven, not assumed, that the
same-origin proxy makes the fallback unnecessary.

## CORS

Kept unchanged — still closed-by-default (`origin: false` unless `CORS_ALLOWED_ORIGINS` is
set), still never a wildcard, still `credentials: true`. Not exercised at all for the
browser→frontend leg under this architecture (same-origin requests never invoke CORS); kept as
defense-in-depth for any direct browser→backend access path outside this frontend. No backend
CORS code was touched.

## LOCAL DEV

Completely unaffected, verified both ways this phase: a full `npm run build` with the
standard `.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:3000`, `API_PROXY_TARGET` unset)
produced the identical 64-route build every prior phase has produced, with zero rewrite
registered. Local architecture has no dependency on Vercel or any specific hosting platform's
proxy mechanism.

## UPLOAD

Verified live: a real `.txt` file (allowlisted MIME `text/plain`), uploaded through the real
browser's file-upload UI (`file_upload` on the actual `<input type="file">`, not a raw script-
constructed request), through the proxy — `POST /api/documents` → **201**, a real document
(`DOC-2026-01004`) created with correct owner linkage (Student), document type, and title.
Multipart boundary/`Content-Type`/body all correctly preserved by the proxy — confirmed by the
backend successfully parsing and storing the file (checksum computed, correct byte size).

## DOWNLOAD

Verified live, the full two-step flow, through the proxy: `GET /api/documents/:id/download` →
**200**, response body's `downloadUrl` is a **relative, opaque, same-origin path**
(`/documents/download/<long-opaque-token>`) — never a raw R2/Render URL, confirmed by
inspecting the actual response JSON, not assumed. Redeeming it (`GET /api<downloadUrl>`) →
**200**, returned exactly **41 bytes** — the exact original file size, byte-for-byte, proving
the proxy did not truncate, buffer-corrupt, or otherwise modify the streamed binary response.

## AUTH

Full flow verified live, both via `curl` (precise header-level evidence) and a real browser
session (end-to-end, including session-restore-on-reload):
- **Login**: `POST /api/auth/login` → 201, cookie stored against the frontend origin.
- **Refresh**: `POST /api/auth/refresh` with that cookie → 201, a **new rotated** refresh
  token returned (rotation-on-use confirmed still working through the proxy) — this is the
  exact call that was silently broken before the `Path` fix (401, no `Cookie` header sent).
- **Logout**: `POST /api/auth/logout` → 201, `Set-Cookie: refresh_token=; Path=/; Expires=Thu,
  01 Jan 1970...` — correctly clears (Path now matches what was set).
- **Real browser session-restore**: reloading an authenticated page correctly re-ran
  `/api/auth/refresh` → `/api/auth/me` with zero errors and zero direct backend requests.

**The `Path=/auth` finding and fix**: proven necessary by direct reproduction — login through
the proxy (cookie stored, `Path=/auth`), then refresh through the same proxy using that cookie
→ **401, no `Cookie` header sent at all** (Path-matching happens against the browser-visible
`/api/auth/refresh` URI, which does not start with `/auth`). Fixed:
`REFRESH_COOKIE_PATH` widened from `/auth` to `/` in `apps/api/src/modules/identity/auth/
auth.controller.ts`, applied identically to both the login `Set-Cookie` and the logout
`clearCookie` (a mismatch between the two would silently leave the old cookie alive after
logout). Re-verified after the fix: refresh through the proxy now succeeds. Two new regression
tests added (`apps/api/test/auth.e2e-spec.ts`) — **confirmed to actually catch the regression**
by temporarily reverting the fix and re-running them (both failed exactly as expected), then
restoring the fix and confirming green again.

## OPEN REDIRECT

Re-tested (`components/auth/login-form.tsx`'s `redirectAfter`), both via new unit tests and
live in a real browser:
- `/dashboard` — allowed (legitimate internal page), unchanged.
- **`/api/students`** (new case, specific to this phase's proxy) — now correctly **rejected**,
  falls back to the role default. Verified live: navigating to `/login?next=%2Fapi%2Fstudents`
  and logging in landed on `/dashboard`, not `/api/students`. Rationale: `/api/*` is
  technically same-origin but is never a legitimate page-navigation target (an API-proxy path
  with no page behind it) — a crafted `?next=` should not be able to force a browser
  navigation there.
- `//evil.example.com`, `https://evil.example.com` — still rejected (pre-existing F09
  hardening, re-confirmed unchanged).
- `/login` — still rejected (pre-existing F09 hardening, re-confirmed unchanged).
- `javascript:...` — still rejected (never matches `startsWith("/")`, unchanged).
- **`/\evil.com`** (new case — a backslash-prefixed path) — now correctly **rejected**. A
  known WHATWG-URL-parsing bypass for a naive `//`-only check: browsers normalize a leading
  backslash to a forward slash for "special" schemes, so `/\evil.com` can resolve identically
  to `//evil.com`. Added as genuine defense-in-depth while re-auditing this exact logic for
  this phase, not because a specific exploit was demonstrated against this app.

## SECURITY

- Refresh token never exposed to JS — confirmed live (`document.cookie` empty of it).
- No direct browser request to the real backend origin in production-like mode — confirmed
  live (Network tab, zero matches for the backend's port/origin across an entire session).
- No direct R2 request from the browser — this phase's local test used
  `LocalFilesystemStorageProvider` (not real R2), but the *mechanism* verified (opaque signed
  token, never a raw storage URL, redeemed only through the same-origin proxy) is identical
  regardless of which storage backend the URL ultimately resolves to server-side — the
  frontend/proxy layer this phase touches has no storage-backend-specific code path at all.
- No secret in the client bundle — `API_PROXY_TARGET` confirmed server-only (grepped the
  built `.next/static` output for the string `onrender.com`: zero matches, meaning the real
  backend origin is never inlined into shipped JS — only the relative `/api` path is).
- `SameSite=Strict` preserved — confirmed live, unchanged.
- HTTPS required in production — unchanged from F11's build-time validation (now also
  validates `API_PROXY_TARGET` itself for HTTPS in a genuine remote-platform build).
- No wildcard CORS — confirmed unchanged, backend code untouched for CORS itself.

## TESTS

**309/309 passing** (73 files — 306 carried over from F11 + 3 new: `lib/api/client.test.ts`'s
relative-base-URL test, `login-form.test.tsx`'s `/api`-path and backslash-prefix redirect-
hardening tests).

## TYPECHECK

PASS — 0 errors.

## LINT

PASS — 0 errors, 0 warnings.

## BUILD

PASS — both configurations verified: same-origin proxy config (64 routes, correctly warns
only on the local http `API_PROXY_TARGET`, no warning on the relative `NEXT_PUBLIC_API_URL`)
and the standard local-dev config (64 routes, byte-for-byte the same route set every prior
phase produced).

## BACKEND REGRESSION

PASS, full validation (not a baseline-confirmation-only pass — backend code genuinely changed
this phase). Typecheck: 0 errors. Lint: 0 errors, 7 pre-existing unrelated warnings (unchanged
baseline). Unit: **182/182**. E2e: **490 total** (488 + 2 new) — first full run 487/490 (3
resource-contention-shaped failures, the established pattern from F09–F11 on this
slow-filesystem local environment); each failing spec file re-run in isolation, all fully
green (`profile-evidence.e2e-spec.ts` 17/17, `pre-departure-enrollment-closure.e2e-spec.ts`
18/18); combined, confirms the full **490/490** baseline. The two new tests were verified to
actually catch the fixed regression (reverted the fix locally, both failed exactly as
expected; restored the fix, confirmed green again) — not ceremonial additions.

## FILES CREATED

`docs/frontend/phase-status/PHASE_F11A.md` (this file).

## FILES UPDATED

`apps/web/next.config.ts` (`rewrites()` for the `/api/*` proxy, `API_PROXY_TARGET`
read/validation, CSP `connect-src` comment updated for the relative-URL case),
`apps/web/lib/api/client.ts` (`buildUrl` — relative-base-URL support), `apps/web/lib/api/
client.test.ts` (+1 test), `apps/web/components/auth/login-form.tsx` (redirect hardening —
`/api` and backslash-prefix exclusions), `apps/web/components/auth/login-form.test.tsx` (+2
tests), `apps/web/.env.example` (documents the same-origin proxy config alongside the
existing local-dev default), `apps/api/src/modules/identity/auth/auth.controller.ts`
(`REFRESH_COOKIE_PATH` — the one necessary backend fix), `apps/api/test/auth.e2e-spec.ts` (+2
tests — the first-ever `POST /auth/logout` coverage in this suite, plus the new cookie-`Path`
assertion), `docs/frontend/FRONTEND_ARCHITECTURE.md` (§17), `docs/frontend/FRONTEND_AUTH.md`
(§13 updated to "resolved," new §14), `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` ("Critical
finding" replaced with "Same-origin API proxy — RESOLVED," steps 8–11 updated), `docs/
frontend/FRONTEND_RELEASE_GATE.md` (pointer note), `docs/frontend/FRONTEND_BUILD_STATUS.md`
(+"Validation results — Phase F11A" / "Backend regression check — Phase F11A").

**One `docs/DECISIONS.md`-worthy item, not yet added**: the `REFRESH_COOKIE_PATH` change is a
genuine, minimal architectural decision (not a plain bug fix — it changes a security-relevant
cookie attribute, even though the practical scope-widening is harmless per the reasoning in
`FRONTEND_AUTH.md` §14). Judged appropriate to record in this phase's own `PHASE_F11A.md`
(this file) rather than a separate `docs/DECISIONS.md` entry, consistent with how F10's own
logout-error-handling fix was recorded — a genuinely disputable call; a future reviewer may
reasonably want a `docs/DECISIONS.md` entry added retroactively.

## ASSUMPTIONS

- `API_PROXY_TARGET` naming/shape (a single server-only URL) is the minimal design that
  satisfies the instruction's exact target diagram — no multi-backend/multi-region proxy
  configuration was needed or added.
- The `/api` prefix itself (vs. some other prefix) matches the instruction's own exact target
  diagram and this phase's own testing — not independently re-derived.
- Widening the cookie `Path` to `/` (rather than a narrower `/api/auth` or similar) is correct
  specifically because the backend cannot and should not need to know its own proxy prefix (a
  deployment-topology concern, not a backend concern) — `/` is the only value that is correct
  for every possible topology.

## RISKS

- This phase's local verification used `LocalFilesystemStorageProvider`, not real Cloudflare
  R2, and a local Docker Postgres, not real Supabase — the proxy *mechanism* is storage/
  database-agnostic (no code path in `apps/web` or the proxy itself references either), but
  the actual production deploy has not been exercised end-to-end against the real R2/Supabase
  pair.
- No real hosting platform (Vercel/Cloudflare Pages) was used — `API_PROXY_TARGET`'s actual
  behavior on a real platform's edge/serverless rewrite implementation was not verified,
  only Next.js's own local `next start` rewrite handling. Platform-specific edge cases
  (request size limits, timeout behavior for large uploads, cold-start latency added to every
  proxied call) remain unverified until a real deployment.
- The backend `REFRESH_COOKIE_PATH` change, while minimal and tested, is a real change to a
  security-relevant attribute — worth a second reviewer's look before considering this
  phase's backend change fully "signed off," per this project's own general caution around
  backend changes.

## KNOWN ISSUES

None new this phase beyond the risks above. The two LOW findings carried over from F10
(STUDENT_PARENT staff-shell reachability documentation mismatch; no distinct frontend
affordance for Visa-evidence view-only-vs-downloadable) remain unchanged, untouched by this
phase's work.

## PRODUCTION DEPLOYMENT READY: YES
