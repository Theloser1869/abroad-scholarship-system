# FRONTEND GO-LIVE CHECKLIST — Phase F11

Every item below reflects this phase's actual validated state — checked items have a specific
artifact behind them (linked), never checked from inference. Unchecked items are real,
labeled gaps (see `docs/frontend/phase-status/PHASE_F11.md` "KNOWN ISSUES" for severity).

## CODE

- [x] F01–F10 PASS — `docs/frontend/phase-status/PHASE_F10.md` recorded PASS/READY FOR F11;
      this phase's full regression re-run confirms nothing broke since.
- [ ] Clean git state — **not clean**: 158 uncommitted paths (the accumulated F05–F11 work,
      never committed). Not a code-quality issue, a process one — see
      `docs/frontend/FRONTEND_RELEASE_ARTIFACT.md`. **Must be committed before any real
      deploy** (a hosting platform builds from a git ref, not a local working tree).
- [x] No secret — grepped `apps/web` fresh this phase for hard-coded credentials/URLs/tokens:
      zero found (`docs/frontend/phase-status/PHASE_F11.md` "SECRET HYGIENE").
- [x] Lockfile current — `npm ci` (deterministic, lockfile-only install) succeeded for both
      the root workspace and the frontend-specific validation this phase.

## BUILD

- [x] `npm ci` — succeeds.
- [x] Typecheck — PASS, 0 errors.
- [x] Lint — PASS, 0 errors, 0 warnings.
- [x] Tests — PASS, 306/306 (unchanged from F10 — no test-affecting change this phase).
- [x] Production build — PASS, clean (`.next` removed before the final validation build), 64
      routes.

## CONFIG

- [x] API URL — `NEXT_PUBLIC_API_URL` is environment-driven everywhere (grepped: zero
      hard-coded `onrender.com`/`supabase.co`/`r2.cloudflarestorage.com` anywhere in
      `apps/web`); a new build-time validation (`apps/web/next.config.ts`, this phase) fails
      the build outright on an unsafe value once a real hosting platform's own env var is
      detected, and warns (without breaking the established local-QA workflow) otherwise.
- [x] HTTPS — enforced by the same build-time validation for a genuine remote-platform build;
      `Strict-Transport-Security` header added this phase.
- [~] CORS — backend mechanism is correct and ready (`CORS_ALLOWED_ORIGINS` allowlist,
      `credentials: true`, never a wildcard) but **currently unset** (`render.yaml`,
      `sync: false`) — correctly so, since no frontend origin exists yet to allow. **Must be
      set to the real frontend origin as an explicit manual step at actual deploy time** —
      documented in `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` §10, not yet performed
      (no deploy has occurred).
- [~] Auth cookie — **a real, previously-undocumented cross-origin incompatibility was found
      and documented this phase**: the refresh cookie's hard-coded `SameSite=Strict` will not
      be delivered on cross-site requests once frontend and backend are on different origins,
      which breaks session-restore-on-reload and the automatic-refresh flow. A recommended
      zero-backend-change fix (same-site reverse proxy) and a documented backend-change
      fallback are both written up in `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md`'s
      "Critical finding" section — **not yet resolved**, since resolving it requires
      committing to a specific hosting platform first (out of this phase's "don't assume a
      platform" scope). This is the single most important unchecked item on this list.
- [x] Headers — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
      Permissions-Policy, HSTS all added this phase (`apps/web/next.config.ts`) and verified
      present on a real running production-mode server response.
- [x] Asset URLs — no `localhost`/dev-only path found in any static asset reference (grepped);
      fonts self-hosted via `next/font/google` (no runtime external font fetch); no
      `next/image` remote-domain configuration exists (none needed — no remote images used).

## SECURITY

- [x] IDOR — verified live in F10 (CASE_MEMBER, OWN_STUDENT incl. revoked parent, OWN_LEAD),
      unchanged this phase, no code touched that could regress it.
- [x] RBAC — verified live for all 8 roles in F10, unchanged this phase.
- [x] Field security — re-spot-checked in F10, unchanged this phase.
- [x] Document security — reviewed in F10, unchanged this phase.
- [x] Open redirect — reviewed in F10 and again this phase (`?next=` hardening, unique
      client-controlled-navigation call site) — no finding.
- [x] XSS — reviewed fresh this phase (zero `dangerouslySetInnerHTML`, zero `eval`/
      `innerHTML =`, zero `<iframe>`) — no finding.
- [x] Token hygiene — access token in-memory only, refresh token never read/stored
      client-side, zero `console.log` of any credential/token (only 2 total `console.*`
      call sites in the entire app, both classified SAFE — see PHASE_F11.md "SECURITY
      LOGGING").

## UAT

- [x] Staff — re-confirmed live this phase (production-mode server, real local backend):
      login, dashboard, CRM (Leads), Commercial (Contracts), Admission (Universities), Visa
      (checklist templates), Documents, Reports — all loaded cleanly, zero console errors.
- [x] Portal — re-confirmed live this phase (`demo.parent.linked`) — loads correctly,
      zero console errors.
- [x] Notifications — re-confirmed live this phase — loads correctly.
- [x] Documents — list page re-confirmed live this phase; a real upload/download
      click-through was not repeated this phase (unchanged since F07/F10, no code touched).
- [x] Reporting — re-confirmed live this phase — loads correctly.

## DEPLOY

- [ ] Host configured — **not performed** (F11 explicitly does not deploy or create cloud
      resources). Recommended target documented (`FRONTEND_DEPLOYMENT_RUNBOOK.md`
      "Deployment target").
- [ ] Deployment successful — **not applicable**, no deploy attempted.
- [ ] Smoke test (against a real deployed URL) — **not applicable** yet; the equivalent
      local production-mode smoke test was performed and passed this phase.
- [x] Rollback available — procedure documented (`FRONTEND_ROLLBACK.md`); nothing to roll
      back from yet since nothing has been deployed.

## Summary

Every item this phase could actually validate locally is checked. The three genuinely
unchecked items (clean git state, CORS origin set, cookie SameSite cross-origin fix) are all
**deployment-time**, not code-quality, gaps — none block the frontend's *readiness*, but the
cookie finding specifically **must be resolved (proxy or backend fallback) before the first
real cross-origin deployment goes live**, or session-restore/refresh will silently fail in
production. See `docs/frontend/phase-status/PHASE_F11.md` for full detail and severity
labels.
