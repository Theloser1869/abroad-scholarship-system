# PHASE FRONTEND GO-LIVE — real Vercel deployment

**NO secrets appear in this document.** Every env var value below is either public (the
relative `/api` path) or explicitly noted as set-but-not-reproduced.

## 1. Pre-flight (§4)

- Branch: `main`. Remote `origin`: `https://github.com/Theloser1869/abroad-scholarship-system.git`
  (matches the repo named in this phase's own instructions).
- Working tree at phase start: **not clean** — 170 uncommitted paths, `HEAD` still at
  `acae5ef` (F01–F04 only). This is the accumulated, already-validated F05–F11A body of work,
  never committed — the "deployment-ready changes are unpushed" case (§5), not a broken/
  in-progress state. User confirmed proceeding with commit + push.

## 2. GitHub (§5)

- Secret scan before commit: grepped the full diff and every new untracked file for
  credential-shaped patterns (`api[_-]?key`, `secret`, `password`, `token`, `private[_-]?key`
  followed by a long value) — zero genuine matches (only docstring mentions of env var
  *names*, and `...` placeholders in `docs/DEPLOYMENT_FREE.md`). Confirmed `.env`/
  `.env.local` are git-ignored and were not staged.
- Commits, in order, all pushed fast-forward (no force, no history rewrite):
  1. `932ae16a` — `feat(frontend): implement frontend phases F05-F11A` (298 files: the full
     staff CRM, student portal, auth hardening, same-origin proxy, and the backend cookie-Path
     fix).
  2. `9fd0dd08` — `chore(web): pin Node 22.x for Vercel builds`.
  3. `330ea4a` — `chore(web): ignore .vercel/ and .env* (added by vercel link)`.
- `git fetch` + `git rev-parse origin/main` confirmed remote SHA matches local `HEAD` exactly
  after each push.

## 3. Vercel project (§6)

- No Vercel MCP/API token was available; `vercel` CLI is not installed globally but works via
  `npx vercel` and was already authenticated (`vercel whoami` → `theloser1869`) once the user
  signed in via their own terminal.
- No existing project on the account (`vercel project ls` → none) — created one, did not
  connect to or duplicate any existing project/repo: `theloser/abroad-scholarship-system-web`.
- Connected the existing GitHub repo (`vercel git connect`) — no second repository created.
- **Root Directory had to be corrected**: `vercel link` run from inside `apps/web/` set Root
  Directory to `.` (wrong for this npm-workspaces monorepo) and left Node at the platform
  default (24.x). Fixed via `vercel project update`: Root Directory → `apps/web`, install
  command → `npm ci`, build command → `npm run build`. Node version has no CLI flag exposed by
  this Vercel CLI version, so it was pinned instead via `apps/web/package.json`'s new
  `engines: { "node": "22.x" }` (Vercel reads this as an alternative to the dashboard picker) —
  committed as `9fd0dd08`.

## 4. Build config (§7)

Matches the F11A-validated plan in `FRONTEND_DEPLOYMENT_RUNBOOK.md` §3–§4 exactly: Next.js
(auto-detected), Node 22.x, `npm ci`, `npm run build`, Root Directory `apps/web`.

## 5. Environment variables (§8–§9)

| Variable | Value | Scope | Visibility |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api` | Production, Preview | Non-sensitive (public — this is the intended, safe relative path) |
| `API_PROXY_TARGET` | `https://abroad-scholarship-system.onrender.com` | Production, Preview | **Sensitive** — value not retrievable via `vercel env ls` even by the project owner |

Confirmed via `vercel env ls`: **exactly these two variables exist**, nothing else. No
`NEXT_PUBLIC_`-prefixed proxy variable. None of the 8 explicitly-forbidden secrets
(`DATABASE_URL`, `DIRECT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `AUTH_JWT_SECRET`,
`AUTH_MFA_ENCRYPTION_KEY`, `DOCUMENT_SIGNING_SECRET`, `ESIGN_WEBHOOK_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`) were ever set on Vercel.

**A real bug caught during setup**: the first attempt to set `NEXT_PUBLIC_API_URL="/api"` via
`vercel env add ... --value "/api"` in Git Bash silently produced the literal Windows path
`C:/Program Files/Git/api` (MSYS's automatic POSIX-path-to-Windows-path conversion for
arguments starting with `/` — the same class of issue F11A already documented for local env
vars, now recurring against a remote target). Caught by pulling the value back
(`vercel env pull`) and inspecting it rather than trusting the "Added" confirmation message;
fixed by removing and re-adding with `MSYS_NO_PATHCONV=1` set, then re-verified correct.

## 6. Rewrite (§10)

Uses the existing `apps/web/next.config.ts` `rewrites()` implementation unmodified — no
hand-written proxy route added. Live-confirmed after deploy: `GET /api/auth/me` on the
production URL returns `401` (a real backend response relayed through the proxy), not a
Next.js 404 (which would mean the rewrite never registered).

## 7. CORS (§11)

`CORS_ALLOWED_ORIGINS` was **not** set via any CLI/API — the operator set it directly in the
Render dashboard to exactly `https://abroad-scholarship-system-web.vercel.app` (no wildcard,
no regex, single exact origin), since no verified official tooling was available in this
session for Render and an unofficial third-party `render-cli` npm package was deliberately not
trusted against the live backend.

## 8. Deployment (git-triggered, not manual)

Connecting the Vercel project to GitHub, combined with the two follow-up pushes (Node pin,
`.gitignore`), auto-triggered a **Production** deployment directly — Vercel treats `main` as
the production branch by default, so there was no separate "preview first" step available
once git was connected (worth knowing for future projects if a staged rollout is wanted).

- Deployment ID: `dpl_3ogKi9FYztRagt2c1uWxx92CDz5e`
- Status: **Ready**
- Production alias: `https://abroad-scholarship-system-web.vercel.app`
- A separate manual `vercel deploy` attempt (run from inside `apps/web/`, which double-applies
  the Root Directory setting against an already-scoped upload) failed with a
  "Root Directory does not exist" error — self-inflicted CLI usage mistake, unrelated to the
  real git-triggered deployment, which was unaffected and succeeded.

## 9. Live verification — cookie/same-origin (§12) and network (§13)

Performed in a real Chrome tab against `https://abroad-scholarship-system-web.vercel.app`,
logged in as the real `SYSTEM_ADMIN` bootstrap account (the user typed the password directly;
it was never seen or handled by the assistant).

- **Login**: succeeded, landed on `/dashboard`.
- **`document.cookie`**: empty string / length 0 at every check — the refresh cookie is never
  visible to JavaScript (`HttpOnly` confirmed behaviorally).
- **Session-restore/refresh**: on every fresh navigation, `POST /api/auth/refresh` → `201`
  (token rotation happening, not just a cached success) followed by `GET /api/auth/me` → `200`
  and `GET /api/notifications` → `200`. Observed across 4 separate navigations.
- **Network origin**: every single request captured across the whole session — page loads,
  static chunks, all `/api/*` calls — targeted `abroad-scholarship-system-web.vercel.app`.
  Explicit filtered searches for `onrender.com` and `r2.cloudflarestorage` in the captured
  network log: **zero matches**, across the entire session.
- **Logout**: `POST /api/auth/logout` → `201`, client redirected to `/login?next=%2Fdashboard`.
  Immediately confirmed the session was genuinely revoked server-side, not just the cookie
  cleared client-side: navigating back to `/dashboard` triggered a fresh
  `POST /api/auth/refresh` which returned **`401`** (the prior valid session no longer works).

## 10. Document/R2 flow (§14) — NOT TESTED, honestly disclosed

No live upload/download click-through was performed. The only account available
(`SYSTEM_ADMIN`) deliberately holds zero business-data grants by RBAC design (confirmed
live — every business page shows a graceful "Không có quyền truy cập" permission-denied
state, e.g. `reports:view`, `students:view`), and per `docs/DEPLOYMENT_FREE.md` production has
zero Student/Case/Document rows. No portal or business-role test account was provided, and
creating fake production data solely to force a PASS was explicitly out of scope. This is
recorded as an open gap, not fabricated as a pass.

## 11. App functional smoke test (§15)

- Public login: **PASS**.
- Auth (logout/refresh/session-restore): **PASS** (see §9 above).
- Staff pages checked live: `/dashboard`, `/leads`, `/students` — all render a clean,
  graceful RBAC permission-denied state (expected — `SYSTEM_ADMIN` has no business grants by
  design) with **zero console errors** on any of the three pages.
- Business-flow pages (contracts, payments, applications, visa, partners, documents,
  notifications-with-data, reports-with-data) and Portal: **not tested**, same reason as §10 —
  no account with business-data access and no fixtures to exercise.

## 12. Open redirect (§16)

Full 7-case live re-test would require ~7 separate logins (the malicious `next=` values are
only evaluated at login-submit time). User opted for a spot-check of the 3 highest-value
cases, backed by the F11A unit tests (already passing, in the exact deployed commit) for full
coverage:

| Case | Result |
|---|---|
| `next=/dashboard` | **Allowed** — landed on `/dashboard` after login. |
| `next=/api/auth/me` | **Rejected** — landed on `/dashboard` (the F11A-hardened `/api`-prefix check), not the API path. |
| `next=https://evil.example` | **Rejected** — landed on `/dashboard`, never navigated externally. |

Remaining 4 cases (`//evil.example`, `/\evil.example`, `javascript:...`, `data:...`) rely on
the already-passing `login-form.test.tsx` unit tests in this exact deployed commit
(`932ae16a`), not re-verified live this phase.

## 13. Security check — client bundle (§17)

All 14 production JS chunks referenced from `/`, `/login`, and `/dashboard` were downloaded
directly (`curl`) and grepped for: `onrender.com`, `API_PROXY_TARGET`, `supabase.co`,
`r2.cloudflarestorage`, and all 8 explicitly-forbidden secret names. **Zero matches.**
Confirmed `"/api"` (the intended public relative path) is present as expected.

## 14. Render backend (§18)

No backend architecture change. The one backend code change in the whole F05–F11A→GO-LIVE
span was F11A's `REFRESH_COOKIE_PATH` fix (already deployed to Render prior to this phase,
per session history) — nothing further changed here. The only backend-side action this phase
was the CORS origin, performed by the operator directly in the Render dashboard (§7). No
migration, seed, reset, R2 change, or credential rotation was performed or requested.

## 15. Custom domain (§19)

No custom domain exists. Used the Vercel-provided domain
(`https://abroad-scholarship-system-web.vercel.app`) for this first validation, as instructed.

## 16. Deployment checks (§20)

- Build succeeded: **yes** (Vercel build log, Ready status).
- Deployment status: **Ready**.
- HTTPS: **yes** (`https://` origin, Vercel-managed TLS).
- No redirect loop: confirmed (`/` → `200`, direct page loads observed without loops).
- Root page, static assets (JS/CSS/fonts), and `/api/*` all loaded/responded correctly (§9,
  §13).
- Auth works end-to-end (§9, §11).
- No console errors observed on the 3 pages checked (§11).

## 17. Same-origin proof (§21)

| Item | Value |
|---|---|
| Browser page origin | `https://abroad-scholarship-system-web.vercel.app` |
| API request origin (observed) | `https://abroad-scholarship-system-web.vercel.app` (every request, no exceptions) |
| Proxy target (`API_PROXY_TARGET`) | `https://abroad-scholarship-system.onrender.com` (server-only, never sent to the browser — confirmed via §13's bundle scan) |
| Direct Render requests from browser | **0** (explicit filtered search of the full captured network log) |
| Direct R2 requests from browser | **0** (same) |
| Refresh cookie attributes | `HttpOnly` (confirmed behaviorally — invisible to `document.cookie`), `SameSite=Strict` and `Path=/` (unchanged backend code from F11A, already e2e-tested; not independently re-observed at the raw header level in this phase since browsers withhold `Set-Cookie` from all JS, including via `fetch()` — the functional proof is that refresh succeeds through the proxy and fails after logout, which is exactly the behavior these attributes are meant to produce) |

## 18. Production data safety (§22)

No `prisma migrate reset`/`db push`, no seed run, no business data created/deleted/modified,
no documents touched. The only "test data" created this phase was the live browser session
itself (login/logout cycles under the pre-existing `SYSTEM_ADMIN` bootstrap account) — no new
account, record, or fixture was created.

## 19. Rollback reference (§23)

| Item | Value |
|---|---|
| Previous deployed frontend commit | none — this is the first-ever frontend deployment |
| Deployed frontend commit | `330ea4a` |
| Vercel deployment ID | `dpl_3ogKi9FYztRagt2c1uWxx92CDz5e` |
| Timestamp | 2026-08-24 16:14 +07:00 |
| Backend compatibility | Render backend already carries the F11A `REFRESH_COOKIE_PATH` fix this frontend depends on; no backend rollback needed alongside a frontend rollback since no backend change accompanied this deploy |

Rollback was not executed — not necessary; procedure is `docs/frontend/FRONTEND_ROLLBACK.md`.

## 20. Honest gap summary

Not fabricated as PASS, recorded as genuinely untested:
- Document/R2 upload-download flow through the deployed proxy (real R2, not the local
  filesystem provider F11A used).
- Business-data staff pages (contracts, payments, applications, visa, partners, reports-with-
  data) and the student/parent Portal — no account with grants, no fixtures, no fake data
  created by design.
- 4 of 7 open-redirect cases (relies on passing unit tests in the deployed commit, not live
  re-verification).
- Post-deploy Vercel runtime error-log scan / drains — no monitoring integration configured on
  this project; not set up this phase (out of the stated scope, which explicitly excludes new
  feature/infra work beyond the deployment itself).

## FINAL GO-LIVE DECISION: GO-LIVE

The deployment is live, same-origin, secret-free, and the auth/session/logout/redirect
mechanisms that were the entire point of F11A are verified working in production against the
real backend. The recorded gaps are pre-existing scope limits (no business-data test account,
no monitoring integration) rather than defects found and left unresolved — none of them are
CRITICAL/HIGH security findings, and none involve exposed secrets or a broken auth/session
mechanism.
