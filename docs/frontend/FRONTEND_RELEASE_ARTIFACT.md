# FRONTEND RELEASE ARTIFACT — Phase F11

Describes the exact build validated this phase. **No secret appears below.**

## Source state

- **Repository**: local working tree, `E:\abroad-scholarship-system` — no remote configured
  in this environment.
- **Last commit (`HEAD`)**: `acae5ef07c4e6c4f4b03b475a4478092e61cb96d`, 2026-08-21
  (`feat(frontend): implement frontend phases F01-F04`).
- **Working tree state**: **not clean** — 158 changed paths relative to `HEAD`, spanning every
  frontend phase this session has actually run (F05 through this F11 pass; the F01–F04 work
  is what `HEAD` itself already captures). **This is the honest, current state**: the F05–F11
  work has been implemented, validated, and documented across this project's session history,
  but never committed. There is therefore **no single commit SHA that represents "the F11
  build"** — the artifact validated below is the working tree as it stands, not a tagged
  release. Before any real deployment, this tree needs a real commit (or a series of them) —
  not performed in this phase (F11 does not commit/push on the user's behalf without being
  asked, per this session's own standing operating discipline).
- **`git status --short apps/web/` / `.github/` / `docs/frontend/`**: shows the accumulated
  F05–F11 changes (component/route additions from F05–F08, UX hardening from F09, the one
  auth fix from F10, and this phase's `next.config.ts`/`.github/workflows/ci.yml` additions) —
  nothing from this phase touches backend-owned paths (`apps/api/`, `database/`) beyond the
  pre-existing DEC-09/10/11/12 change set already present at session start and reconfirmed
  untouched every phase since F07.

## Build environment

| Item | Value |
|---|---|
| Node.js | v22.11.0 (matches `.github/workflows/ci.yml`'s `actions/setup-node@v4` pin) |
| npm | 11.7.0 |
| Next.js | 16.3.1 |
| React / React DOM | 19.2.8 |
| TypeScript | `^5` (resolves to whatever the committed lockfile pins) |
| Package manager | npm workspaces (root `package-lock.json`, committed) |

## Build output

- **Command**: `npm run build` (`apps/web` — `next build`, Turbopack).
- **Result**: PASS, exit code 0.
- **Routes**: 64 total — 21 static (`○`, prerendered), 43 dynamic (`ƒ`, server-rendered on
  demand), 1 middleware (`ƒ Proxy`).
- **Client bundle size (measured, not estimated)**: `.next/static/chunks/` totals **~3.0MB**
  across every route's code-split chunks combined (a single page never downloads all of it —
  Next.js's per-route code splitting is unmodified/default, no custom chunking added). Largest
  individual chunk: **224KB** (the shared framework/vendor chunk every page needs); the next
  largest is 160KB; the great majority of route-specific chunks are 30–60KB each. No single
  route was found carrying an unusually large chunk of its own. This Next.js/Turbopack version's
  build output does not print a classic per-route "First Load JS" table the way Webpack builds
  historically did — the on-disk measurement above is the real, verifiable number used instead
  of estimating one.
- **Security headers** (verified against a real running production-mode server response, not
  just the config source): `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-
  Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` all present
  and correctly populated (`connect-src` correctly resolved the configured
  `NEXT_PUBLIC_API_URL` origin) — see `docs/frontend/phase-status/PHASE_F11.md` for the exact
  header values captured.

## Runtime expectations

- **Server**: `next start` (or the deployment platform's equivalent managed Next.js runtime)
  — no custom server, no `output: "export"`/`"standalone"` mode configured.
- **Required environment variable**: `NEXT_PUBLIC_API_URL` (the only one this app reads) —
  must be set to the real backend's HTTPS origin before/during build (it is inlined at build
  time, not read at runtime — see `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md`).
- **No server-side secret of any kind** — this app holds none, by design.
- **Backend compatibility**: validated this phase against the same local backend commit/state
  F10 validated against — no API contract change was made or required. See "Backend
  regression" in `docs/frontend/phase-status/PHASE_F11.md`.

## Health / smoke checks

This app has no dedicated `/health` endpoint of its own (a static/SPA-shaped Next.js app has
no meaningful separate liveness check beyond "does `GET /login` return 200 with the expected
HTML"). Full smoke-test checklist: `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` §7, already
exercised once against a real local backend this phase (production-mode `next start` +
local `apps/api`) — see `docs/frontend/phase-status/PHASE_F11.md` "PRODUCTION-LIKE RUN".

## Rollback reference

See `docs/frontend/FRONTEND_ROLLBACK.md`. Since no deployment has occurred, there is no
prior deployed version to reference yet — the rollback document describes the *procedure* a
future rollback would follow, not a specific prior artifact.

## GO-LIVE UPDATE — actually deployed (this phase, supersedes the above)

The working tree described above **is now committed and deployed**:

- **Commits**: `932ae16a` (F05–F11A body, 298 files), `9fd0dd08` (pin Node 22.x via
  `apps/web/package.json` `engines`), `330ea4a` (`.gitignore` update from `vercel link`) — all
  pushed fast-forward to `origin/main` (`github.com/Theloser1869/abroad-scholarship-system`),
  no force-push, no history rewrite.
- **Deployed commit**: `330ea4a`.
- **Vercel deployment**: `dpl_3ogKi9FYztRagt2c1uWxx92CDz5e`, target `production`, status
  `Ready`. Production alias: `https://abroad-scholarship-system-web.vercel.app`.
- **Node.js (deployed)**: `22.x` (pinned via `engines.node`; Vercel's platform default had
  drifted to 24.x).
- Full go-live evidence: `docs/frontend/phase-status/PHASE_FRONTEND_GO_LIVE.md`.
