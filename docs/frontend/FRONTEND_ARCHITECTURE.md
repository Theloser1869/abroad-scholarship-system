# FRONTEND ARCHITECTURE — Phase F01

Source of truth for *why* the frontend is structured this way. Route-by-route detail lives in
`FRONTEND_ROUTES.md`; endpoint-by-endpoint detail lives in `FRONTEND_API_MAP.md`; role/permission
detail lives in `FRONTEND_PERMISSION_MAP.md`. This document only covers structural/architectural
decisions.

## 1. Framework

- **Next.js 16.3.1**, **React 19.2.8**, **TypeScript 5.x** (`^5` in `apps/web/package.json`,
  matching the root repo's TypeScript `5.9.3`).
- Pre-decided, not chosen in this phase: `docs/architecture/TARGET_ARCHITECTURE.md` §1 already
  records "Frontend | React/Next.js, TypeScript" from the backend phases. F01 only picks the
  *specific* version and router (below).
- Scaffolded via `create-next-app@latest` (App Router + TypeScript + ESLint + Tailwind
  templates), then hand-edited — not built from an empty directory, to inherit a
  known-correct baseline `tsconfig.json`/`eslint.config.mjs`/`postcss.config.mjs`.
- **Next.js 16 is very new and has breaking changes from what most training data assumes.**
  Two were hit and corrected during this phase (documented in `docs/DECISIONS.md`):
  - `error.tsx`'s recovery callback prop is now `retry`, not `reset`.
  - `middleware.ts` is deprecated in favor of `proxy.ts` (same shape, renamed
    export/file). The scaffold uses `proxy.ts`.
  Before writing framework-level code in a later phase, check
  `node_modules/next/dist/docs/` (via `AGENTS.md`, which Next itself regenerates) rather than
  assuming pre-16 conventions.

## 2. Router: App Router

App Router (`app/`), not Pages Router. Reasons: it's Next.js's current default and
actively-developed model; it gives layout nesting for free, which is exactly what the
staff-vs-portal shell split (§9) needs; and Server Components reduce the amount of
client-side data-fetching boilerplate a permission-heavy, mostly-authenticated app like this
one would otherwise need. No `src/` directory — `app/`, `components/`, `lib/` sit directly
under `apps/web/` (`--no-src-dir` at scaffold time), matching the flat style
`docs/PROJECT_STRUCTURE.md` shows for `apps/web/`.

## 3. TypeScript

`strict: true` (inherited from the create-next-app template, unchanged). Path alias `@/*` →
`apps/web/*` (e.g. `@/lib/api/client`, `@/components/ui/button`) — set in
`apps/web/tsconfig.json`, consistent with the template default rather than introducing a
second alias convention.

## 4. `apps/web` boundary

A new member of the existing root npm workspace (`"workspaces": ["apps/*"]` in the root
`package.json` already covered it — no workspace config change needed). Package name
`@abroad/web`, matching `@abroad/api`'s naming. Root-level scripts added
(`web:dev`/`web:build`/`web:lint`/`web:typecheck`/`web:start`, mirroring the existing
`api:*` scripts) — no existing `api:*` script or backend behavior was touched. `apps/web`
never imports from `apps/api/src` or `database/` directly — the only contract between them is
the HTTP API (`lib/api/client.ts`, §8), the same boundary a real deployed frontend would have.

## 5. Feature-folder organization

Per `docs/architecture/TARGET_ARCHITECTURE.md` §1: **organize by domain, not by role** —
"để tránh trùng lặp UI giữa các role xem cùng một entity với field-level khác nhau." A future
`features/` directory (not created in F01 — no business domain yet) will mirror the backend's
own domain boundary from `docs/architecture/DOMAIN_MAP.md` (identity, crm, case-management,
counseling, admission, visa, commercial, partners, documents, notifications, reporting), e.g.
`features/students/`, `features/contracts/` — never `features/consultant-view/` or
`features/admin-view/`. A single Student page renders different fields/actions for different
roles via the shared permission layer (§13), not via role-forked route trees.

## 6. `components/`

- `components/ui/` — presentational primitives with no domain/business logic: `Button`,
  `Input`, `Card`/`CardHeader`/`CardTitle`, `Table` family (`Table`, `TableHead`, `TableBody`,
  `TableRow`, `TableHeaderCell`, `TableCell`). Created in F01 (§14) because the scaffold's
  shell/placeholder pages needed *something* to render — deliberately not a component
  library (no Radix/shadcn/MUI installed, §11).
- `components/providers/` — `AppProviders`, the single mount point for every app-wide client
  provider (auth context today; TanStack Query + a permission-context wrapper are F02
  additions — see §12/§13). Root `app/layout.tsx` wraps children in this once and never needs
  to change again as providers are added.
- `components/features/` (not created yet) — future domain-specific components, one
  subdirectory per `DOMAIN_MAP.md` domain, added by the phase that needs them.

## 7. `lib/`

- `lib/api/` — `client.ts` (the `apiFetch` boundary, §8), `types.ts` (the two
  cross-cutting response shapes every endpoint shares — `PaginatedResponse<T>`, `ApiErrorBody`
  / `ApiError`).
- `lib/auth/` — `session.ts` (`Principal`/`RoleCode` types + `bootstrapSession()` signature),
  `auth-context.tsx` (`AuthProvider`/`useAuth()`) — see §12.
- `lib/permissions/` (not created yet — F02) — will hold the centralized permission-helper
  functions the master context requires (`can(principal, resource, action)` style), built
  against `FRONTEND_PERMISSION_MAP.md`. Not created in F01 because F01's own instructions
  scope "implement permissions" out (`frontend_prompts/01-foundation/
  01_FRONTEND_AUDIT_ARCHITECTURE.md` §11 equivalent for auth applies the same way here).
- `lib/utils/` — `cn.ts` (tiny className joiner; no `clsx`/`tailwind-merge` dependency added
  for something this small, see `docs/DECISIONS.md`).

## 8. API integration boundary

`lib/api/client.ts`'s `apiFetch<T>()` is the **only** place that knows the backend base URL,
attaches `Authorization: Bearer`, and parses the `{ error: {...} }` envelope into `ApiError`.
No component ever calls `fetch()` directly against the backend. It is intentionally a thin,
generic wrapper — **not** a full typed SDK: F01 does not implement a single domain endpoint
call (no `getStudents()`); each domain phase adds its own typed functions on top of
`apiFetch` when it needs them, against the real backend response shape at that time
(`frontend_prompts` explicitly forbids inventing endpoints ahead of the backend). Full
endpoint-by-endpoint detail: `FRONTEND_API_MAP.md`.

## 9. Authentication boundary

`lib/auth/` (session types + `AuthProvider`/`useAuth()`) is where session state lives —
components read "who is logged in" from `useAuth()`, never by decoding a token or calling
`GET /auth/me` themselves. F01 ships a **null-session placeholder**: `AuthProvider` always
provides `{ principal: null, isLoading: false }`, and `apiFetch`'s token getter always returns
`null`. This is deliberate (`frontend_prompts` §12: "F01 không triển khai full
authentication... Implementation đầy đủ thuộc F02") — the shape exists and typechecks/builds
today; F02 fills in the real `bootstrapSession()` call and login/refresh/logout flow without
changing what anything importing `useAuth()` looks like.

## 10. Permission boundary

Not implemented in F01 (code). Documented as data in `FRONTEND_PERMISSION_MAP.md` (all 8
roles × resource × action × scope, transcribed from `docs/security/RBAC_MATRIX.md`, the real
source of truth). F02 turns that document into `lib/permissions/` helper functions. Whatever
form those helpers take, they only ever affect **what renders** — every actual authorization
decision remains server-side (`docs/architecture/TARGET_ARCHITECTURE.md` §1: "Frontend không
tự quyết định authorization... Backend luôn re-check authorization kể cả khi client gọi thẳng
API"). A hidden nav item is a UX nicety; the real deny is the backend's 403/404.

## 11. Portal as a surface, not a separate app

One Next.js app. Two route groups under `app/`:

- `app/(staff)/...` — desktop-first, no URL prefix (route groups contribute no path
  segment), e.g. `/dashboard`, `/students`.
- `app/(portal)/portal/...` — responsive-first, URL prefix `/portal` mirroring the backend's
  own `/portal/*` route prefix exactly (`docs/api/API_CONVENTIONS.md` §11).

Both route groups nest under the **same single root layout** (`app/layout.tsx` — one
`<html>`/`<body>`, one font, one design-token stylesheet, one `AppProviders` mount). They are
deliberately *not* two separate root layouts — Next.js only reloads the full page between
routes that use *different* root layouts (`node_modules/next/dist/docs/.../route-groups.md`
"Full page load" caveat), and staff/portal share the same origin, auth mechanism, and design
tokens, so there is no reason to pay that cost. This matches
`docs/architecture/TARGET_ARCHITECTURE.md` §1 verbatim: "Portal Student/Parent... là một
surface riêng trong cùng app, không phải app tách biệt."

Backend has no separate "Student Portal" vs. "Parent Portal" distinction — one
`STUDENT_PARENT` role, one `portal:access` gate, one `GET /portal/me` that resolves *every*
student the caller may see (themselves, or any child they're an ACTIVE linked parent of —
`docs/security/RBAC_MATRIX.md` §3). The frontend portal surface follows this: one route tree,
a student-picker at `/portal` when more than one is accessible, not a parallel
`/portal/parent/...` tree. See `FRONTEND_ROUTES.md` "Student Portal / Parent Portal" note.

## 12. State management strategy

- **UI-only/local state** (open/closed modals, form field values before submit, filter-panel
  toggles): React's built-in `useState`/`useReducer`, plus `AuthContext`
  (`lib/auth/auth-context.tsx`) for the one piece of genuinely global client state. No
  Redux/Zustand/Jotai — nothing in this app needs cross-cutting client state complex enough
  to justify one, and the master context's "centralized permission helpers"/"centralized API
  client" requirements are satisfied by plain modules + React Context, not a state-management
  library.

## 13. Server-state strategy

**Decision (recorded in `docs/DECISIONS.md`): TanStack Query (`@tanstack/react-query`) for
every server-fetched, cacheable resource** (list/detail pages, the master context's required
loading/error/empty states map directly onto its `isPending`/`isError`/`data` result shape).
**Not installed in F01** — the dependency is deferred to F02, the phase that actually writes
`useQuery`/`useMutation` hooks against `apiFetch`, to avoid an unused dependency sitting in
`package.json` through a phase that cannot yet exercise it
(`frontend_prompts/01-foundation/01_FRONTEND_AUDIT_ARCHITECTURE.md`'s "no business feature"
scope + this project's explicit "tránh dependency thừa" instruction). `AppProviders` (§6) is
already the correct mount point for `QueryClientProvider` once it's added.

## 14. Styling / design system boundary

**Tailwind CSS v4** (`@tailwindcss/postcss`, CSS-first config — no `tailwind.config.js`;
tokens defined via `@theme` in `app/globals.css`) — the create-next-app default for this
Next.js version, kept rather than replaced, and the one and only styling system in this app
(no CSS Modules, no styled-components, no second system layered on top — instruction §10:
"không tạo nhiều styling systems"). No component library (Radix/shadcn/MUI/Ant) installed —
`components/ui/` primitives are hand-built Tailwind-class wrappers, exactly enough for the F01
scaffold (§6/§14 above), not a full design system.

Design tokens (`app/globals.css` `:root` + `@theme inline`): `background`/`foreground`,
`border`, `muted`/`muted-foreground`, `primary`/`primary-foreground`, and four **semantic
status colors** — `success`/`warning`/`danger`/`info` (each with a matching `-foreground`) —
shared vocabulary every future domain's status badges (Lead/Case/Contract/Application/Visa/...
status enums) map onto, rather than each domain phase inventing its own color set. Typography
uses the Geist/Geist Mono variable fonts already wired by create-next-app; no separate type
scale was added beyond Tailwind's default `text-*` utilities — not needed yet at scaffold
scope.

## 15. Environment configuration

`apps/web/.env.example` — one variable, `NEXT_PUBLIC_API_URL` (no trailing slash), read only
inside `lib/api/client.ts`. No production secret, no hard-coded Render URL anywhere in the
repo (verified: `grep -r "onrender.com" apps/web` returns nothing) — every environment
(local, staging, the live Render deployment) supplies its own value through its own
environment-variable mechanism, the same pattern `apps/api`'s `DATABASE_URL`/R2 credentials
already use (`docs/DEPLOYMENT_FREE.md`).

## 16. Testing strategy

**No test tooling installed in F01** — `frontend_prompts/01-foundation/
01_FRONTEND_AUDIT_ARCHITECTURE.md` only requires running tests "nếu frontend test setup được
yêu cầu"; none exists yet, so this is correctly N/A for F01 rather than skipped. Planned
(recorded in `docs/DECISIONS.md` as a decision, not yet executed): **Vitest + React Testing
Library** for unit/component tests (fast, ESM-native, pairs naturally with Vite-less Next.js
via `next/jest`-equivalent config), **Playwright** for the eventual F10 QA/e2e phase — chosen
for symmetry with nothing installed yet rather than as a hard commitment; the phase that first
needs tests should re-confirm this choice still fits before installing.

## 17. Build / deployment boundary

Local: `npm run web:typecheck` / `web:lint` / `web:build` from the repo root (or the
equivalent `npm run <script> -w apps/web`), all three verified passing in this phase — see
`FRONTEND_BUILD_STATUS.md`. Production deployment target (Vercel vs. a second Render service
vs. something else), CI wiring, and any `render.yaml`/CI changes are explicitly **F11
(Deployment Readiness) scope**, not decided or touched here — `apps/web` currently has no
Dockerfile, no `render.yaml` entry, and is not referenced by the existing backend
`Dockerfile`/`render.yaml` in any way (verified: neither file mentions `apps/web`).

**F11 resolution**: no hosting platform has actually been chosen yet (deploying is out of
F11's own scope) — **Vercel** is F11's *recommended*, not decided, target (unmodified stock
Next.js App Router, zero platform-specific config needed beyond env vars; see
`docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md` "Deployment target" for the full reasoning and
the documented Cloudflare Pages alternative). `apps/web/next.config.ts` gained F11 additions
that are platform-neutral by construction — standard `headers()`/build-time env validation,
no `vercel.json`/`wrangler.toml`/other platform file added, consistent with this section's
existing "no Dockerfile, no render.yaml entry" posture. A genuine, previously-undiscovered
cross-origin auth-cookie incompatibility was found during this review — see
`docs/frontend/FRONTEND_AUTH.md` §13 and `docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md`
"Critical finding" — unresolved as of F11 since resolving it properly depends on which
platform is eventually chosen.

**F11A resolution**: the recommended fix WAS implemented — `apps/web/next.config.ts` gained an
`async rewrites()` export proxying `/api/:path*` to a server-only `API_PROXY_TARGET` (never
`NEXT_PUBLIC_*`), active only when that variable is set (local dev, which never sets it,
continues calling the backend directly and completely unaffected — this remains "platform-
neutral by construction," now also "topology-neutral": local-direct and same-origin-proxied
are both first-class, switched purely by which env vars are set, no code branch on `NODE_ENV`
or a specific host). `NEXT_PUBLIC_API_URL` is now legitimately either an absolute origin
(local dev) or the relative path `/api` (proxied) — `lib/api/client.ts`'s `buildUrl` was
changed from `new URL(...)` (which throws on a bare relative string) to plain string
concatenation, since `fetch()`/`window.open()` both already accept a relative URL directly.
Implementing this surfaced one further, genuine cookie-`Path` incompatibility, fixed with a
minimal backend change — see `docs/frontend/FRONTEND_AUTH.md` §14 and
`docs/frontend/phase-status/PHASE_F11A.md` for the full verification record (real `curl`
round-trips and a real browser session, not just re-reading the code).
