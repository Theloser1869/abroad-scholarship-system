# FRONTEND ROLLBACK — Phase F11

**This document describes a procedure. It is not being executed in this phase** — no
deployment has occurred yet (see `docs/frontend/FRONTEND_RELEASE_ARTIFACT.md`), so there is
nothing to roll back from. Written for whoever operates the first, and every subsequent, real
deployment.

## Rollback to previous successful commit

Every major frontend hosting platform (Vercel, Cloudflare Pages, Netlify) keeps immutable
build artifacts per deployment and offers an "instant rollback" / "promote a previous
deployment" action in its dashboard — this is the **preferred rollback path**, since it
re-serves an already-built, already-verified artifact rather than re-running a build (a
re-build could itself fail, or silently pick up an unrelated dependency update if the
lockfile isn't pinned — it is, here, but the point generalizes). Only fall back to a
`git revert`-and-redeploy if the platform's own rollback mechanism is unavailable or the
platform is not one of the above.

Steps (platform-generic):
1. Identify the last known-good deployment (by commit SHA and/or deploy timestamp, from the
   platform's deployment history).
2. Use the platform's rollback/promote action to make that deployment live again — this
   should take effect within seconds to a couple of minutes, not require a fresh build.
3. Verify with the same smoke-test checklist used for a forward deploy
   (`docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` §7).
4. If the platform has no rollback mechanism: `git revert` the problematic commit(s) (never
   `git reset --hard` a shared branch), push, and let the normal deploy pipeline rebuild —
   slower, but still safe, since `npm ci` against the reverted lockfile state is deterministic.

## Deployment history

Not yet applicable — no deployment has occurred. Once one exists, the platform's own
deployment list (commit SHA + timestamp + build log per entry) is the authoritative history;
this document does not duplicate it.

## Environment compatibility

A rolled-back frontend build remains compatible with the *current* backend as long as no
backend API contract, RBAC grant, or schema change has shipped between the two frontend
versions being switched between — this project's backend has changed relatively slowly and
deliberately (`docs/security/RBAC_MATRIX.md`/`docs/api/API_CONVENTIONS.md` are the source of
truth for what the frontend can assume). **Before rolling back, check whether the backend has
shipped a breaking change since the target (older) frontend commit was built** — if it has,
a frontend-only rollback is not safe on its own; the backend would also need to be rolled back
in step, or the older frontend patched forward for the new contract instead. This project's
current F01–F11 history has never shipped a frontend-visible breaking API change without a
corresponding frontend update in the very same phase — but that history is not a guarantee
for whatever ships after F11.

## Cache considerations

- **CDN/edge cache**: most platforms (Vercel, Cloudflare Pages) invalidate their edge cache
  automatically on a rollback/promote action — verify this is actually true for whichever
  platform is chosen before relying on it silently happening.
- **Browser cache**: Next.js's own build-hash-named static assets (`_next/static/<build-id>/
  ...`) mean an old browser tab holding stale JS will request the *old* build's exact
  asset URLs — which a rollback restores, so this is actually safe (no "old JS talking to a
  wrong-shaped new API" mismatch window, unlike a naive in-place file overwrite would risk).
  The one edge case: a browser tab that was mid-navigation to a *newer* build's asset URL at
  the exact moment of rollback could see a transient 404 for that one asset — resolved by a
  page reload, not a systemic issue.
- **TanStack Query cache**: entirely client-side, in-memory, cleared on every page reload and
  on every logout (`queryClient.clear()`, `lib/auth/auth-context.tsx`) — a rollback never
  needs to account for stale server-state cache surviving across it.

## Database compatibility assumption

**This is a frontend-only rollback document — it assumes the database schema and data are
unaffected by a frontend rollback**, since this frontend has no migration of its own and
performs no schema-affecting operation. If the incident being rolled back from involved bad
*data* written through the frontend while a defective version was live (not merely a broken
UI), a frontend rollback alone does not undo that data — that is a backend/database concern,
out of this document's scope (see `docs/production/DISASTER_RECOVERY.md` for the backend's own
procedure).

## Frontend-only rollback constraints

- A frontend rollback **cannot** fix an incident whose root cause is backend-side (a bad
  backend deploy, a bad migration, a backend RBAC misconfiguration) — verify where the actual
  defect lives before rolling back the frontend specifically; rolling back the wrong tier
  wastes the incident-response window without fixing anything.
- A frontend rollback **can** fix: a bad frontend build (broken page, a regression introduced
  in a frontend-only change, a misconfigured `NEXT_PUBLIC_API_URL` pointing at the wrong
  backend), since none of those have any server-side state to reconcile.
- Session state: rolling back the frontend does not invalidate any user's already-issued
  access token or refresh-cookie session (auth state lives entirely on the backend +
  in-memory client state) — a rollback does not force a mass logout, which is the expected
  and desired behavior for a UI-only incident.
