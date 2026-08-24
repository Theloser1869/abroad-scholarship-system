# FRONTEND DEPLOYMENT RUNBOOK — Phase F11

**This document prepares a deployment. It does not perform one.** No cloud account, project,
DNS record, or hosting connection was created by this phase. Every numbered step below is
written for whoever runs the actual deployment, using the deployment target they choose —
see "Deployment target" below for why no specific platform is assumed.

## Deployment target

No frontend hosting platform has been fixed anywhere in this repository's documentation as of
F11 (`docs/DEPLOYMENT_FREE.md`'s own architecture diagram labels the frontend "(future)" —
unbuilt/undeployed at every phase through F10). Per this phase's own instruction ("Do NOT
assume Vercel if documentation has another target... If no platform has been fixed: document
the recommended target, prepare platform-neutral config where possible, do not deploy"):

**Recommended target: Vercel**, for these concrete, evidence-based reasons — not a default
assumption:
- This app is unmodified stock Next.js App Router (no custom server, no non-standard build
  output) — Vercel is Next.js's own maintained deployment target and requires zero
  platform-specific config beyond environment variables.
- The backend (Render) already accepts an arbitrary, operator-configured
  `CORS_ALLOWED_ORIGINS` — nothing about the backend favors one frontend host over another.
- The project's existing free-tier posture (Render free web service + Supabase free tier +
  Cloudflare R2 free tier, `docs/DEPLOYMENT_FREE.md`) is naturally continued by Vercel's own
  free (Hobby) tier for a low-traffic internal/demo deployment.

**Cloudflare Pages** is a legitimate documented alternative (same free-tier-friendly
reasoning, and would put the frontend on the same platform family as R2 if that's ever judged
valuable) — the config below is written to be as platform-neutral as reasonably possible
(standard `next build` output, environment variables, no Vercel-specific file added — see
"Platform-neutral config" below) so switching is a configuration change, not a rewrite.

**No platform-specific config file has been added** (no `vercel.json`, no
`wrangler.toml`/Cloudflare Pages `_headers`/`_redirects`) — F11 §21 explicitly says "Do not
add platform-specific files unless needed," and none of this app's requirements (headers,
redirects, env vars) need a platform file: security headers are already handled portably via
`next.config.ts`'s standard `headers()` export (works identically on Vercel and Cloudflare
Pages' Next.js runtime), and no redirects/rewrites are needed at all.

## Same-origin API proxy (F11A) — RESOLVED, implemented and verified live

F11 identified (but did not implement) a real cross-origin cookie incompatibility. **F11A
implemented the recommended fix and verified it end-to-end** — real `curl` round-trips and a
real browser session, not just re-reading the code. This section documents the exact resulting
architecture.

### Frontend Origin ↔ API path ↔ Proxy target

```
Browser
  ↓
Frontend origin (e.g. https://<app>.vercel.app, or http://localhost:3001 locally)
  ├── /                → Next.js frontend (pages, same as always)
  └── /api/:path*      → next.config.ts rewrites() → API_PROXY_TARGET/:path*
                          (the real backend, e.g. https://abroad-scholarship-system.onrender.com)
```

- **Frontend code never calls the backend origin directly.** `lib/api/client.ts`'s
  `apiFetch`/`apiUpload`/`apiDownloadBlob`/`resolveApiUrl` all resolve through
  `NEXT_PUBLIC_API_URL`, which is `/api` in this same-origin config (a relative, same-origin
  path — not an absolute URL). `buildUrl` was changed from `new URL(...)` (throws on a bare
  relative string) to plain string concatenation, since `fetch()` and `window.open()` both
  already accept a relative URL directly, resolved against the current page's own origin.
- **`API_PROXY_TARGET`** (server-only, never `NEXT_PUBLIC_*`, never inlined into the client
  bundle) is the real backend origin the Next.js server-side rewrite proxies to. Read only
  inside `next.config.ts`, which executes in Node.js at Next's own request-routing layer.
- The rewrite (`apps/web/next.config.ts`) is **only registered when `API_PROXY_TARGET` is
  set** — unset (the local-dev default) means zero rewrites, zero interference with local
  dev's existing direct-to-`localhost:3000` calls.
- Verified live this phase (real HTTP, not assumed from documentation): `GET /api/health` →
  the real backend's health response, proxied; `POST /api/auth/login` → real login; `POST
  /api/documents` (multipart) → a real document created; the two-step signed-download flow
  (`GET /api/documents/:id/download` → opaque relative `downloadUrl` → `GET /api<downloadUrl>`)
  → the exact original file bytes returned. All method types the app actually uses (GET, POST,
  PATCH, DELETE, multipart) pass through Next.js's own external-rewrite mechanism unmodified —
  it is a routing-layer proxy, not a hand-written route handler reimplementing header/body/
  streaming forwarding.

### Cookie architecture

The refresh-token cookie (`httpOnly`, `Secure` in production, `SameSite=Strict` — **kept
unchanged**, never relaxed to `None`) is set by the *backend*, but because the browser only
ever addresses the *frontend's* origin (`/api/auth/login`, not the backend's own domain), the
`Set-Cookie` response — relayed transparently through the proxy — is stored by the browser
against the **frontend's own origin**. Verified live via `curl -v`: `Set-Cookie: refresh_
token=...; Path=/; ...; HttpOnly; SameSite=Strict`, with no `Domain=` attribute (host-only,
correctly scoped to whichever origin the browser actually received the response from).

**A second, distinct issue was found and fixed while verifying this**: the cookie's original
`Path=/auth` did not match the browser-visible `/api/auth/*` request path (Path-matching
happens against the pre-proxy URI, invisible to the rewrite) — refresh/logout would have
silently never received the cookie. Fixed backend-side (`REFRESH_COOKIE_PATH` widened to `/`,
the only topology-agnostic value) — full detail in `docs/frontend/FRONTEND_AUTH.md` §14. The
refresh token is never exposed to JavaScript at any point (`document.cookie` confirmed not to
contain it, live, in a real browser).

### CORS behavior

With this same-origin architecture, the browser's own outbound requests are same-origin (to
the frontend), so **CORS is not exercised for the browser→frontend leg at all** — the
frontend-server→backend leg (inside the `rewrites()` proxy) is a server-to-server request,
which CORS does not apply to (CORS is a browser-enforced mechanism). The backend's
`CORS_ALLOWED_ORIGINS` allowlist is **kept unchanged** (still closed-by-default, still never a
wildcard, still `credentials: true`) — it remains the correct, necessary safeguard for any
*direct* browser→backend access path that might exist independently of this frontend (a
different client, a future mobile app, direct API testing) — proxying the frontend's own
traffic does not reduce the backend's own need for a real CORS policy, and this phase did not
weaken it.

### Local development behavior

**Completely unaffected, verified unchanged.** `NEXT_PUBLIC_API_URL=http://localhost:3000`
(absolute, direct) remains the default in `apps/web/.env.local` — `API_PROXY_TARGET` is never
set locally, so `next.config.ts`'s `rewrites()` returns an empty array and the frontend
continues calling the backend directly, exactly as every prior phase (F02–F11) established.
Local architecture has no dependency on Vercel or any specific platform's proxy mechanism.

## Environment strategy

| Environment | `NEXT_PUBLIC_API_URL` | `API_PROXY_TARGET` | Notes |
|---|---|---|---|
| LOCAL (`next dev`) | `http://localhost:3000` (in `apps/web/.env.local`, gitignored) | unset | Backend runs locally too, called directly (no proxy); `CORS_ALLOWED_ORIGINS=http://localhost:3001` on the backend. |
| TEST (Vitest) | Not read — all API calls are mocked at the module boundary (`vi.mock` on `lib/*/api.ts`), no real `fetch` happens | unset | No env var needed for `npm run web:test`. |
| STAGING/DEMO (a preview deploy on the chosen platform) | `/api` (F11A same-origin proxy) | The same real Render backend URL as REMOTE INTERNAL, OR a dedicated staging backend if one is ever stood up — **not decided in this phase**, since no staging backend exists today | Platform preview-deployment env vars (Vercel: Preview environment variables) should be set explicitly for both, never left to silently inherit Production's value by accident. |
| REMOTE INTERNAL (production frontend deploy) | `/api` (F11A same-origin proxy) | The real deployed Render API's public HTTPS URL | Set once, in the hosting platform's Production environment-variable store — never committed, never hard-coded (see `apps/web/next.config.ts`'s build-time validation). `API_PROXY_TARGET` is server-only — never `NEXT_PUBLIC_*`. |

Build-time vs. runtime vs. secret, for this app specifically (unlike the backend, which has a
much larger APP/DATABASE/AUTH/STORAGE/EMAIL/JOBS/WEBHOOK surface):

- **Build-time public var**: `NEXT_PUBLIC_API_URL` — the only one that exists. Inlined into
  the client JS bundle at `next build` time (standard Next.js `NEXT_PUBLIC_*` behavior) —
  changing it requires a new build, not just a runtime restart.
- **Runtime-only / server-only var**: none exist in this app today. `apps/web` has no
  server-only secret of its own (unlike `apps/api`'s `AUTH_JWT_SECRET`/R2 credentials/etc.) —
  it is a pure client-rendered SPA-over-App-Router talking to the backend's own API, never a
  BFF holding secrets of its own.
- **Secret**: **none exist in `apps/web` at all**, by design (`frontend_prompts/00-context/
  00_FRONTEND_MASTER_CONTEXT.md`: "Frontend không được... chứa secret, DB URL, R2 credential").
  There is therefore no `NEXT_PUBLIC_*`-vs-secret confusion risk to guard against beyond what
  `apps/web/next.config.ts`'s build validation already enforces (URL well-formedness, HTTPS,
  non-localhost) — there is nothing else to leak.

## 1. Prepare repository

1. Confirm a clean git state for the commit being deployed — `git status --short` shows no
   unexpected uncommitted change relevant to `apps/web`, `next.config.ts`, `.github/
   workflows/ci.yml`, or `docs/frontend/`.
2. Confirm the lockfile (`package-lock.json`, root — npm workspaces) is committed and
   up to date (`npm ci` succeeds without modifying it).
3. Confirm `apps/web/.env.example` still documents the one required variable accurately.

## 2. Configure environment variables

On the chosen hosting platform's dashboard (never in a committed file):

| Variable | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api` (F11A same-origin proxy — see "Same-origin API proxy" above) | Production environment |
| `API_PROXY_TARGET` | The real backend's public HTTPS URL (currently `https://abroad-scholarship-system.onrender.com` — confirm the actual live value at deploy time, do not assume it is unchanged). Server-only, never `NEXT_PUBLIC_*`. | Production environment |
| `NEXT_PUBLIC_API_URL` | `/api`, same as Production | Preview environment |
| `API_PROXY_TARGET` | A distinct value for Preview/Staging if a separate backend exists for it; otherwise the same production URL, set explicitly (not inherited by accident) | Preview environment |

## 3. Connect hosting platform

Platform-specific (Vercel recommended, §"Deployment target" above): connect the GitHub
repository, set the **Root Directory** to `apps/web` (this is an npm-workspaces monorepo —
the platform must build from the workspace subdirectory, not the repo root), and confirm
framework auto-detection identifies Next.js correctly.

## 4. Build

| Setting | Value |
|---|---|
| Framework | Next.js (auto-detected) |
| Node version | **22** (matches `.github/workflows/ci.yml`'s `actions/setup-node@v4` — keep these in sync if either changes) |
| Install command | `npm ci` (deterministic, lockfile-only — never `npm install` for a deploy build) |
| Build command | `npm run build` (from `apps/web`'s own `package.json` — equivalently `next build`) |
| Output | Next.js's standard `.next/` build output (no custom `output: "export"`/`"standalone"` configured — the platform's own Next.js runtime serves it) |

The build itself will fail loudly (not silently ship a broken app) if `NEXT_PUBLIC_API_URL` is
missing, malformed, `http://`, or `localhost` **once the platform's own recognized environment
variable is present** (`VERCEL`/`CF_PAGES`/`RENDER`/`NETLIFY` — see `apps/web/next.config.ts`
§F11 comment) — this is the "build should fail on an unsafe production API URL" requirement,
verified this phase (§"Final production build" below).

## 5. Deploy

Platform-specific — triggered by a push to the connected branch (Vercel: automatic on every
push once connected, same `autoDeploy`-on-commit pattern the backend's `render.yaml` already
uses) or a manual deploy trigger. **Not performed in this phase.**

## 6. Verify health

This app has no dedicated `/health` route of its own (unlike the backend) — a successful
deploy is confirmed by the platform's own build/deploy status plus `GET /login` (or any
public route) returning `200` with the expected HTML.

## 7. Smoke test

See `docs/frontend/FRONTEND_UAT_REPORT.md` (F10) and this phase's own production-like local
run (§"Production-like local run" below) for the exact flow list — repeat the same list
against the real deployed URL once one exists: login, dashboard, one CRM page, one commercial
page, one admission page, one visa page, one document page, notifications, portal, reports.

## 8. Verify auth

Login → dashboard/portal redirect by role, logout → redirect to `/login`, a full page reload
while authenticated → session restore. **Verified locally this phase** with the real
same-origin proxy config (real `curl` round-trips + a real browser session): login sets the
cookie against the frontend's own origin, a page reload correctly re-runs `/api/auth/refresh`
→ `/api/auth/me` with zero direct requests to the backend origin visible in the Network tab,
and logout correctly clears the cookie. Re-run this same check against the real deployed URL —
local verification proves the mechanism works, not that the specific production config is
correct (a real deploy could still have `API_PROXY_TARGET` misconfigured, etc.).

## 9. Verify API connectivity

Open browser DevTools → Network on the deployed URL, confirm every request targets the
frontend's **own** origin under `/api/*` (never the backend's real domain directly — see
"Same-origin API proxy" above) and receives real responses, not CORS-blocked or 404 failures.
An `/api/*` request 404ing (rather than reaching the backend) means `API_PROXY_TARGET` is
unset or the rewrite didn't register — check the platform's environment variables.

## 10. Verify CORS

The backend's `CORS_ALLOWED_ORIGINS` (`render.yaml`, currently `sync: false` / unset) is **not
required for this same-origin architecture's browser→frontend leg** (same-origin requests
don't invoke CORS at all) — but still worth setting to the frontend's real origin as defense-
in-depth for any direct browser→backend access path outside this frontend (a future mobile
client, direct API testing, or a deploy where the proxy is somehow bypassed). Verify the
backend's CORS policy remains closed-by-default and never a wildcard, unchanged from before
this phase.

## 11. Verify documents

Upload and download a real document as a real authenticated user. **Verified locally this
phase through the real same-origin proxy**: a real multipart upload (`POST /api/documents`,
201) created a real document; after the async scan job completed, the two-step signed-URL
download flow (`GET /api/documents/:id/download` → an opaque, relative, same-origin
`downloadUrl` — never a raw R2/Render URL — → `GET /api<downloadUrl>`) returned the exact
original file bytes (byte-for-byte size match confirmed). This proves the proxy correctly
forwards multipart bodies and binary/streamed responses. **Re-run against the real deployed
backend + R2** — this phase's local test used `LocalFilesystemStorageProvider`, not real R2;
the proxy mechanics are identical either way, but the real storage backend was not exercised.

## 12. Verify portal

Log in as a real (or controlled test) `STUDENT_PARENT` account, confirm the Portal surface
loads and the same RBAC/IDOR behavior verified in F10 (`FRONTEND_UAT_REPORT.md`) holds against
the real deployed pair.

## 13. Verify rollback if necessary

See `docs/frontend/FRONTEND_ROLLBACK.md`. **Not performed in this phase** — no deployment has
occurred yet, so there is nothing to roll back from.

## 14. GO-LIVE — actually performed (this phase)

Every step above was executed for real against Vercel + the real Render backend. Full detail,
evidence, and the honest list of what was and wasn't live-verified:
`docs/frontend/phase-status/PHASE_FRONTEND_GO_LIVE.md`. Summary:

- Project: `theloser/abroad-scholarship-system-web`, Root Directory `apps/web`, framework
  Next.js (auto-detected), install `npm ci`, build `npm run build`, Node pinned to `22.x` via
  `apps/web/package.json`'s `engines` field (Vercel's own dashboard-only Node selector isn't
  reachable from the CLI; `engines.node` is the CLI-reachable equivalent).
- Env vars set exactly as planned: `NEXT_PUBLIC_API_URL=/api` (Production+Preview,
  non-sensitive) and `API_PROXY_TARGET=https://abroad-scholarship-system.onrender.com`
  (Production+Preview, **Sensitive** visibility — value not retrievable via `vercel env ls`).
  No `NEXT_PUBLIC_`-prefixed proxy var exists. **Hit the known MSYS/Git-Bash path-mangling bug
  again** setting `NEXT_PUBLIC_API_URL` (silently became a literal Windows path) — caught via
  `vercel env pull` verification, fixed with `MSYS_NO_PATHCONV=1`.
- First deploy: a `git push` to `main` on the newly git-connected Vercel project auto-triggers
  a **Production** deployment directly (Vercel's default branch behavior), not a Preview —
  worth knowing before connecting git on a fresh project if a staged preview-first rollout is
  wanted. Deployment `dpl_3ogKi9FYztRagt2c1uWxx92CDz5e`, Ready, production alias
  `https://abroad-scholarship-system-web.vercel.app`.
- CORS: `CORS_ALLOWED_ORIGINS` set on Render to exactly that origin (operator-performed in the
  Render dashboard, per this repo's policy of not using unverified third-party tooling against
  the live backend).
- Live browser verification (real admin login, real Vercel URL): cookie invisible to
  `document.cookie`, `/api/auth/refresh` + `/api/auth/me` succeed through the proxy with zero
  direct requests to `onrender.com`/R2 observed, logout revokes the session server-side
  (post-logout refresh → `401`), 3 of the 7 open-redirect cases spot-checked live (remainder
  covered by the already-passing F11A unit tests in the same deployed commit), production JS
  bundle scanned clean of all listed secrets and the Render URL.
- Not live-verified: the real document/R2 upload-download flow and the broader staff
  business-flow smoke test (§7/§11) — the only account available (`SYSTEM_ADMIN`) deliberately
  holds zero business-data grants by design, and no portal/business-fixture test account was
  provided; creating fake production data to force a pass was out of scope by explicit
  instruction. Documented as an open gap, not fabricated as a pass.
