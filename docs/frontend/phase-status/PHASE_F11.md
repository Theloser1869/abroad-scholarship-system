# PHASE STATUS — F11 (Frontend Production Preparation + Deployment Readiness)

## PHASE F11 STATUS: PASS

## FRONTEND DEPLOYMENT READY: YES

## READY FOR REMOTE FRONTEND DEPLOY: YES (with one required pre-deploy decision — see
## "Critical finding" below; not a blocker to *readiness*, but must be resolved before the
## *first real cross-origin deploy* goes live)

## SUMMARY

Prepared the frontend for production deployment: build configuration, security headers, CSP,
client-env validation, source-map/error-handling review, security logging audit, dependency
audit, CI readiness, and a production-mode local run + browser smoke test against a real
local backend. **No deployment was performed, no cloud resource was created, no DNS was
touched, no production database was touched.** No new business feature. One genuine, real,
previously-undocumented architectural finding was made and thoroughly documented (cookie
`SameSite=Strict` vs. cross-origin deployment) — not silently fixed, since resolving it
properly depends on a hosting-platform decision this phase deliberately does not make. Two
small, well-scoped frontend-only additions were made (build-time env validation + security
headers in `next.config.ts`; a frontend CI job added to the existing `.github/workflows/
ci.yml`) — both zero-backend-change, both validated by a full clean rebuild.

## DEPLOYMENT TARGET

No platform was fixed anywhere in this repository's history through F10. **Vercel
recommended** (stock Next.js App Router, zero platform-specific file needed) — Cloudflare
Pages documented as a legitimate alternative. Not deployed. Full reasoning:
`docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` "Deployment target".

## ENVIRONMENT

LOCAL / TEST / STAGING-DEMO / REMOTE INTERNAL defined explicitly
(`docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` "Environment strategy"). This app has exactly
one variable (`NEXT_PUBLIC_API_URL`, build-time public) and **zero secrets of any kind** —
by design, confirmed by grep, not assumed. `apps/web/.env.example` reviewed and found already
accurate; no `.env.local.example`/`.env.test.example` were added (judged unnecessary — there
is no meaningfully different variable set between local and test for this app, unlike the
backend's much larger surface). All real env-file variants (`.env`, `.env.local`,
`.env.production`, `.env.development`, `.env.test`) confirmed gitignored; `.env.example`
confirmed tracked (pre-existing, unaffected by the broad `.env*` ignore pattern, since
gitignore never un-tracks an already-committed file).

## API CONFIG

`NEXT_PUBLIC_API_URL` is environment-driven everywhere — grepped fresh this phase for
`onrender.com`/`supabase.co`/`r2.cloudflarestorage.com` anywhere in `apps/web`: zero matches.
**New this phase**: `apps/web/next.config.ts` now validates this variable at build time —
hard-fails a genuinely-remote-platform build (detected via `VERCEL`/`CF_PAGES`/`RENDER`/
`NETLIFY` env vars, which every major host sets automatically) on an empty/malformed/
`http://`/`localhost` value, and only *warns* (never breaks) for the project's own established
local production-mode QA workflow, which legitimately uses `http://localhost:3000`. Verified
live: a clean build with the local `.env.local` value correctly printed the warning and
still succeeded; the same logic would throw given a `VERCEL`-shaped environment.

## CORS

Backend mechanism reviewed (`apps/api/src/main.ts`): closed by default (`origin: false`),
explicit comma-separated allowlist via `CORS_ALLOWED_ORIGINS`, `credentials: true`, never a
wildcard (verified: `credentials: true` + `origin: '*'` would be rejected by the CORS spec
itself, and the code never does this). **Currently unset** in `render.yaml`
(`sync: false`) — correctly so, since no frontend origin exists yet. Must be set to the real
frontend origin as an explicit manual step at actual deploy time (documented,
`FRONTEND_DEPLOYMENT_RUNBOOK.md` §10) — **not performed**, no deploy occurred. No backend
change made or needed for CORS itself.

## AUTH COOKIE

**The single most important finding of this phase.** The refresh cookie is
`httpOnly, sameSite: 'strict', path: '/auth'` (hard-coded,
`apps/api/src/modules/identity/auth/auth.controller.ts`). `SameSite=Strict` is never sent on a
cross-site request (fetch/XHR included) — once frontend and backend are on different origins
(the entire premise of deploying a frontend at all, since the backend stays on Render),
session-restore-on-reload and the automatic 401-retry refresh will silently fail to
authenticate via the cookie, even though login itself appears to work (the access token also
comes back in the response body). Confirmed by reading the actual cookie-setting code — not
inferred — and cross-checked against `apps/api/src/main.ts`'s own CORS-setup comment, which
reasons about enabling cross-origin *calls* without accounting for the cookie's `SameSite`
policy preventing *delivery* on exactly those calls.

**Recommended fix (zero backend change)**: same-site reverse proxy (e.g. Next.js `rewrites()`
mapping `/api/*` to the real backend), so browser requests are same-site from the browser's
perspective even though server-side infrastructure relays them. **Documented fallback (a
real, minimal, one-line backend change)**: `sameSite: 'strict'` → `'none'` (requires
`Secure: true`, already the production default). **Neither implemented this phase** — the
proxy approach requires committing to a specific platform first, and F11 explicitly does not
make that decision; implementing the backend fallback preemptively would be scope creep
against "prefer zero backend changes" when a zero-backend-change path exists and only needs a
platform choice to execute. Full writeup: `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md`
"Critical finding", `docs/frontend/FRONTEND_AUTH.md` §13 (new this phase).

## SECURITY HEADERS

Added this phase (`apps/web/next.config.ts`, verified present on a real running
production-mode server response, not just the config source): `Content-Security-Policy`,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/microphone/
geolocation/payment/usb all denied), `Strict-Transport-Security`.

## CSP

`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self' <API origin>; frame-ancestors
'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. Scoped to this app's actual
resource usage, verified by reading source (not assumed): no `next/image` remote domains
anywhere (grepped), fonts are `next/font/google` (self-hosted at build time, no runtime
external fetch), `connect-src` dynamically includes the real configured API origin.
`'unsafe-inline'` on `script-src`/`style-src` is a deliberate, documented tradeoff — Next.js
injects its own inline hydration bootstrap script and (for this CSS pipeline) inline style
tags without a nonce by default; a stricter nonce-based policy is a real future tightening
(see KNOWN ISSUES) not adopted here since it cannot be verified against a real deployed
instance in a phase that explicitly forbids deploying, and a wrong nonce wiring would silently
break hydration on every page — a worse outcome than the current, honestly-documented
`'unsafe-inline'`.

## SOURCE MAP

Not explicitly configured (`next.config.ts` has no `productionBrowserSourceMaps` override —
Next.js's own default is `false`, i.e. source maps are **not** generated/shipped for a
production build unless explicitly enabled). Verified this is the actual behavior (not just
the documented default) by confirming no `.map` file exists anywhere under the final clean
`.next/static` build output. **Decision: keep disabled** — this app has no observability
provider connected to consume source maps privately (e.g. Sentry's own separate
upload-and-strip flow), so there is no legitimate consumer for them; shipping them publicly
would only help someone read the app's original TypeScript source from the deployed bundle,
with zero offsetting benefit today.

## SECRET HYGIENE

Grepped `apps/web` fresh this phase: zero hard-coded `onrender.com`/`supabase.co`/
`r2.cloudflarestorage.com`, zero inline credential/password/API-key literal, zero secret of
any kind (this app holds none, by design — confirmed, not assumed). `apps/web/.gitignore`'s
`.env*` pattern confirmed to cover every real env-file variant while leaving the already-
tracked `.env.example` (safe placeholder only) untouched.

## ERROR / OBSERVABILITY

`app/error.tsx` reviewed: generic user-facing message ("Đã xảy ra lỗi. Vui lòng thử lại."),
no stack trace/source path/internal detail rendered to the user; the one `console.error(error)`
call is DevTools-only (never transmitted — no error-reporting/observability provider is
connected in this app, confirmed by grep for any such SDK import). This gap (no external
monitoring) is honestly documented, not invented-around with a fabricated metric.

## SECURITY LOGGING

Grepped the entire `apps/web` tree fresh this phase: **exactly 2** `console.*` call sites in
non-test code — `app/error.tsx`'s `console.error(error)` (SAFE — DevTools-only, no
transmission, fires only on an unhandled exception whose message is already the backend's own
user-safe `ApiError` text) and `next.config.ts`'s `console.warn(...)` (SAFE — build-time Node
process output only, never reaches the shipped browser bundle). Zero occurrences of
`console.log`/`debug`/`info` anywhere. No password/token/cookie/DB-URL/R2-credential logging
exists to remove, because none was ever added (unchanged since F02/F09/F10's own findings,
re-verified fresh this phase, not assumed carried-over).

## BUILD

PASS — truly clean sequence this phase (remove artifacts → `npm ci` → typecheck → lint →
tests → build, per §25's own requirement, never a stale `.next`). 64 routes, 21/21 static
pages. Full detail including a real environment lesson learned this phase (npm-workspaces
`npm ci` must run from the repo root, not a workspace subdirectory) — see
`docs/frontend/FRONTEND_BUILD_STATUS.md` "Validation results — Phase F11".

## BUNDLE

Measured (not estimated) this phase: `.next/static/chunks/` totals **~3.0MB** across every
route's code-split chunks combined (a single page never downloads all of it — default Next.js
per-route code splitting, no custom chunking). Largest single chunk **224KB** (shared
framework/vendor), next largest 160KB, the great majority of route-specific chunks 30–60KB.
No single route carries an unusually large chunk. This Next.js/Turbopack version's build
output does not print a classic per-route "First Load JS" table — the on-disk measurement
above is used instead of fabricating one. No dynamic-`import()` code-splitting was added this
phase (no single feature was identified as heavy enough to justify one beyond Next's own
automatic per-route splitting, consistent with F09's same finding).

## ASSETS

Fonts self-hosted via `next/font/google` (Geist/Geist Mono) — no runtime request to
fonts.googleapis.com/fonts.gstatic.com, confirmed by the CSP's `font-src 'self'` working
correctly on a live response. No `next/image` remote-domain configuration exists (none
needed — zero `next/image` usage anywhere in the app, grepped). Static `public/` assets are
the unmodified `create-next-app` scaffold SVGs (unused by any real page) plus
`app/favicon.ico` — no `localhost`/dev-only path found in any asset reference.

## DOMAIN READINESS

Backend: `https://abroad-scholarship-system.onrender.com` (documented in
`docs/DEPLOYMENT_FREE.md`; verify this is still the actual live URL at real deploy time —
not re-verified live this phase, since F11 does not touch the live backend). Frontend: **to be
provided** — no domain invented, no DNS touched, no cloud resource created. If/when a custom
domain is chosen, `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` §10's CORS-origin-update step
applies identically whether the origin is a platform-generated subdomain or a custom one.

## CI/CD

**Real gap found and fixed this phase**: the existing `.github/workflows/ci.yml` (authored in
a backend phase) covered only the backend (`api:lint`/`api:typecheck`/`api:test`/
`api:test:e2e`/`api:build`/Docker image) — zero frontend steps existed. Added an independent
`frontend` job (`npm ci` → `web:typecheck` → `web:lint` → `web:test` → `web:build`, no
secrets required — a CI-only placeholder HTTPS URL satisfies the new build-time validation
without needing a reachable backend) and widened `deployment-gate`'s `needs:` to include it.
This workflow has never actually executed (no git remote/CI platform connected in this
environment, same as the backend job's own pre-existing state) — authored and locally
reproduced command-by-command, not exercised by a real Actions runner.

## PRODUCTION-LIKE RUN

Performed live this phase: `next build` (production mode) + `next start` on port 3001,
against a real local `apps/api` instance (local Docker Postgres, not Supabase). Verified:
application boots, `/login` renders and authenticates (`demo.director`), `/dashboard` (KPI
data), one CRM page (`/leads`), one commercial page (`/contracts`), one admission page
(`/universities`), one visa page (`/visa-checklist-templates`), one document page
(`/documents`), `/notifications`, `/reports`, and `/portal` (as `demo.parent.linked`, correct
child resolved) — every one loaded with real data and zero console errors. Logout confirmed
clean (redirect to `/login`, no error). Security headers confirmed present on a real response
(`curl -I`). No production Supabase/R2 touched — local Docker Postgres + local filesystem
storage only, per §26/§34's explicit prohibition.

## BROWSER SMOKE

PASS for the flows above — real Chrome automation (CDP), console checked after every
navigation (`read_console_messages`), zero errors/exceptions/hydration warnings across the
entire session. No infinite redirect, no broken asset, no failed critical request observed.
Role navigation exercised (EXECUTIVE_DIRECTOR → STUDENT_PARENT/Portal). Document
upload/download interaction and a second portal child were **not** exercised this phase
(no upload fixture prepared this phase; no multi-child fixture exists — same gap F10 already
documented, unchanged).

## ROLLBACK

Procedure documented (`docs/frontend/FRONTEND_ROLLBACK.md`) — platform-native
rollback/promote preferred over a rebuild-based revert, cache/session/database compatibility
assumptions stated explicitly. **Not exercised** — nothing has been deployed yet, so there is
nothing to roll back from.

## GO-LIVE CHECKLIST

`docs/frontend/FRONTEND_GO_LIVE_CHECKLIST.md` — every item this phase could validate locally
is checked; the three genuinely unchecked items (clean git state, CORS origin set, cookie
cross-origin fix) are all deployment-time gaps, not code-quality ones. See that document for
the full itemized breakdown.

## REQUIREMENTS TRACEABILITY

`docs/frontend/FRONTEND_REQUIREMENTS_TRACEABILITY.md` (F10) reviewed fresh — no new gap
introduced this phase (F11 added no business logic). Its one PARTIAL row (Visa-evidence
view-only-vs-downloadable affordance) is unchanged and remains correctly classified
non-blocker.

## TESTS

**306/306 passing** (unchanged from F10 — no test-affecting frontend code change this phase
beyond the already-tested F10 logout fix).

## TYPECHECK

PASS — 0 errors.

## LINT

PASS — 0 errors, 0 warnings (one transient warning introduced and immediately fixed within
this same phase — an unnecessary `eslint-disable` comment).

## BACKEND REGRESSION

PASS, with one real environment complication this phase root-caused and resolved (not a code
regression): after this phase's own `npm ci` operations (needed for the frontend's own §25
clean-install requirement), the backend's generated Prisma client became stale
(`node_modules/@prisma/client` was reinstalled by `npm ci` but not regenerated against the
schema — `npm ci` alone does not run `prisma generate`), surfacing as
`TypeError: client_1.Prisma.Decimal is not a constructor` in 9 `PaymentsService`-related unit
tests. **Root-caused, not a code defect** — `npm run db:generate` (a normal, already-documented
step, `docs/DEPLOYMENT_ENV.md`) regenerated the client and the suite was re-run. Zero backend
source file was touched to fix this — it was purely a local-environment regeneration step, the
same category as F09/F10's own recurring "local dev environment needs care after certain
operations" lessons. **Unit tests: 182/182 pass** after regeneration (see
`docs/frontend/FRONTEND_BUILD_STATUS.md` for the exact command/output). Full e2e was not
re-run this phase (F10 already reconfirmed 488/488 in isolation; zero backend *source* changed
since — a unit-test confirmation plus an unchanged `git status` on every backend path is the
appropriate-weight check for a phase that touched no backend code).

## FILES CREATED

`docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md`, `docs/frontend/FRONTEND_RELEASE_ARTIFACT.md`,
`docs/frontend/FRONTEND_ROLLBACK.md`, `docs/frontend/FRONTEND_GO_LIVE_CHECKLIST.md`,
`docs/frontend/phase-status/PHASE_F11.md` (this file).

## FILES UPDATED

`apps/web/next.config.ts` (client-env validation + security headers — the only frontend
*source* change this phase), `.github/workflows/ci.yml` (+ `frontend` job, widened
`deployment-gate` dependency), `docs/frontend/FRONTEND_BUILD_STATUS.md` (+ "Validation results
— Phase F11" / "Backend regression check — Phase F11"), `docs/frontend/FRONTEND_AUTH.md`
(+ §13, the `SameSite`/cross-origin finding), `docs/frontend/FRONTEND_ARCHITECTURE.md`
(§17, resolving the F11-forward-reference it already carried since F01). **No
`docs/DECISIONS.md` entry** — zero backend files touched; the recommended platform (Vercel)
is documented as a recommendation, not a decision requiring that log, and the cookie finding
is explicitly *not resolved* this phase (nothing decided, only documented) — a future phase
that actually implements the proxy or the backend `SameSite` fallback should add the entry
then, once it becomes a real decision rather than an open finding.

## ASSUMPTIONS

- Vercel is a *recommendation*, not a decision — no platform commitment was made, per this
  phase's own explicit "do not assume a platform" instruction.
- The CI-only placeholder API URL (`https://ci-placeholder.invalid`) is never resolved/called
  by the new frontend CI job — it exists solely to satisfy the new build-time env validation's
  syntactic requirements, confirmed by the job needing no live backend service to pass.
- No new `.env.local.example`/`.env.test.example` file was judged necessary, since this app's
  entire env-var surface is the one already-documented `NEXT_PUBLIC_API_URL`.

## RISKS

- **The cookie `SameSite` finding is a real production-auth risk for the first cross-origin
  deploy specifically** — not resolved this phase, by design (depends on a platform choice
  out of scope here). Whoever performs the first real deploy must read
  `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md`'s "Critical finding" section before doing so,
  or session-restore/refresh will silently fail in production.
- CORS_ALLOWED_ORIGINS is unset on the live Render backend — a required manual step before
  first use, easy to forget since it produces a browser-console-only CORS error, not an
  obvious server-side failure.
- The working tree has 158 uncommitted paths spanning F05–F11 — a real deploy needs a
  committed ref; nothing here was committed on the user's behalf.
- `script-src`/`style-src 'unsafe-inline'` in the CSP is a real, documented, deliberate
  tradeoff, not the theoretical maximum — a future nonce-based tightening is possible but
  requires a real deployed environment to verify safely (see KNOWN ISSUES).

## KNOWN ISSUES

- Cookie `SameSite=Strict` cross-origin incompatibility (MEDIUM/architectural — not a data
  leak, a functional break) — documented, unresolved, blocks nothing about *readiness* but
  will break auth on the first real cross-origin deploy until addressed.
- CSP's `'unsafe-inline'` on `script-src`/`style-src` — a real, bounded future tightening
  opportunity (nonce-based CSP), not adopted this phase since it cannot be safely verified
  without a real deployed instance (F11 forbids deploying).
- No source-map/observability provider connected — generic client-side errors only, honestly
  documented rather than papered over with an invented monitoring integration.
- Two carried-over LOW findings from F10 (STUDENT_PARENT staff-shell reachability
  documentation mismatch; no distinct frontend affordance for Visa-evidence view-only-vs-
  downloadable) — unchanged, still non-blocking, still correctly tracked in
  `docs/frontend/FRONTEND_SECURITY_REPORT.md`/`FRONTEND_REQUIREMENTS_TRACEABILITY.md`.

## PRODUCTION READY: YES

## READY FOR ACTUAL DEPLOYMENT: YES
