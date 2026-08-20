# PHASE STATUS — PHASE_02 (Foundation)

## status
PASS

## scope
Phase 02A (Database Foundation, `02-foundation/01_DATABASE_FOUNDATION.md`) + Phase 02B
(API Foundation, `02-foundation/02_API_FOUNDATION.md`). DB schema for the 29 required
entities + 3 justified infra/security additions, and the API conventions layer
(auth context, authorization context, validation, pagination/filter/sort/search, error
contract, request ID, audit hook, idempotency), demonstrated end-to-end through a
`students` reference endpoint set. No business endpoints beyond `students` were built —
that is explicitly out of scope per `02_API_FOUNDATION.md`.

## implemented
- npm workspace repo (`apps/*`) initialized, matching `docs/PROJECT_STRUCTURE.md` /
  `docs/architecture/TARGET_ARCHITECTURE.md` (modular monolith, `apps/api/modules/<domain>`).
- Dedicated, isolated Postgres 16 container (`docker-compose.yml`) for this project only —
  the host also had an unrelated pre-existing Supabase stack (`E:\study-abroad`, a
  different project) running in Docker; it was left untouched.
- Prisma schema (`database/schema.prisma`) with all 29 required entities + `DocumentAccess`
  (justified) + `BusinessIdSequence`/`IdempotencyKey` (infra, not business entities) — see
  `docs/database/DATA_DICTIONARY.md` section 2 for the justification of each addition.
- 4 migrations applied to a real database (not `db push`), Prisma Client generated.
- Foundation seed (`database/seeds/seed.ts`): 8 roles (SRS section 3), a minimal 3-row
  foundation permission set scoped to what the reference endpoints exercise, granted to
  `SYSTEM_ADMIN`/`EXECUTIVE_DIRECTOR`, and one bootstrap System Admin user. Idempotent
  (upsert-based) — re-running does not duplicate rows (verified).
- API foundation (`apps/api/src/common/`): Prisma service/module, request-ID middleware,
  auth-context middleware (JWT-decode scaffold, not full login), deny-by-default
  `AuthGuard` (role→permission check via `RolePermission`), error-contract exception
  filter, audit interceptor, idempotency interceptor (backed by `IdempotencyKey`), shared
  pagination/filter/sort/search DTO, centralized business-ID generator
  (`IdGeneratorService`, transactional `SELECT ... FOR UPDATE` counter).
- Reference endpoints: `GET /students`, `GET /students/:id`, `POST /students`,
  `PATCH /students/:id` (`apps/api/src/modules/case-management/students/`) — wired through
  every one of the above conventions.
- Tests: 16 unit tests (pure-logic: sort/pagination parsing, AuthGuard decision matrix,
  JWT-decode edge cases) + 9 integration tests (`apps/api/test/students.e2e-spec.ts`)
  against the real NestJS app + real Postgres container — no mocking of DB or HTTP layer.
- A genuine concurrency bug was found and fixed by the integration tests during this
  phase: the idempotency interceptor originally persisted the dedupe record
  fire-and-forget (`void this.store(...)`), which let a fast retry race the write and
  create a duplicate row instead of replaying the cached response. Fixed by awaiting the
  store inside the response pipeline (`concatMap`) before completing the response. See
  `docs/api/API_CONVENTIONS.md` section 9 for the writeup and the regression test that now
  guards it.

## files created/updated
Root: `package.json`, `package-lock.json`, `tsconfig.json`, `docker-compose.yml`,
`.env.example`, `.env` (git-ignored), `.gitignore`.

Database: `database/schema.prisma`, `database/migrations/*` (4 migrations),
`database/seeds/seed.ts`.

API (`apps/api/`): `package.json`, `tsconfig.json`, `tsconfig.build.json`,
`tsconfig.eslint.json`, `nest-cli.json`, `eslint.config.mjs`, `jest.config.js`,
`jest.e2e.config.js`, `src/main.ts`, `src/app.module.ts`,
`src/common/{prisma,context,decorators,guards,filters,audit,idempotency,id,dto}/*`,
`src/modules/case-management/{case-management.module.ts,students/**}`,
`test/{jest-e2e-setup.ts,students.e2e-spec.ts}`.

Docs: `docs/database/ERD.md`, `docs/database/DATA_DICTIONARY.md`,
`docs/api/API_CONVENTIONS.md`, `docs/ASSUMPTIONS.md` (added ASM-04), this file.

## database changes
See `docs/database/ERD.md` and `docs/database/DATA_DICTIONARY.md` for the full schema.
Summary: 29 required tables + `document_access` (justified addition) + 2 infra tables
(`business_id_sequences`, `idempotency_keys`) = 32 application tables +
`_prisma_migrations`.

## migrations
1. `20260818031144_init_foundation` — initial 31-table schema.
2. `20260818031729_add_infra_business_id_sequence` — added `BusinessIdSequence`.
3. `20260818032138_generalize_business_id_sequence_bucket` — generalized its `year Int`
   column to `bucket String` (needed to also support country-scoped codes like
   `PT-CC-NNNNN`, not just year-scoped ones).
4. `20260818033551_drop_unused_idempotency_response_status` — dropped
   `IdempotencyKey.responseStatus`, which turned out to be unusable (Nest sets the final
   HTTP status after the interceptor chain resolves, so the column could never be read
   back reliably) — removed rather than left as dead/misleading data. Table was empty of
   real data at drop time (verified via a data-loss warning from Prisma before proceeding).

All migrations applied via `prisma migrate dev`/`deploy` against the real dedicated
Postgres container — no manual schema edits, no `db push` used for anything that shipped.

## seed changes
`database/seeds/seed.ts` — 8 roles, 3 foundation permissions, 6 role-permission grants,
1 bootstrap `admin` user. Idempotent by design (upsert / find-then-create), verified by
running it twice and confirming row counts did not change on the second run.

## API foundation
See `docs/api/API_CONVENTIONS.md` for the full convention. Summary of what exists as real,
tested code vs. what is intentionally deferred:

| Convention | Status |
|---|---|
| Authentication context | Scaffold: JWT-decode into `Principal`, no login/issuance yet (Phase 03) |
| Authorization context | Deny-by-default guard + role→permission check; scope/case-ownership/field-level deferred to Phase 03 RBAC |
| Validation | Full — global `ValidationPipe`, DTOs on every route |
| Pagination / filter / sort / search | Full — shared `ListQueryDto` + whitelisted sort |
| Error contract | Full — global exception filter, one JSON shape |
| Request ID | Full — middleware + echoed header + audit linkage |
| Audit hook | Full mechanism (opt-in `@Audit()`, writes on success/deny/error); before/after diffing left for the phase that implements real edits |
| Idempotency | Full — `@Idempotent()` + `IdempotencyKey` table, race condition found and fixed |
| Consistent HTTP status | Nest defaults kept as the convention, documented |

## tests
- Unit (`apps/api/src/**/*.spec.ts`, Jest): 16/16 passing.
- Integration (`apps/api/test/students.e2e-spec.ts`, Jest + Supertest, real app + real DB):
  9/9 passing, including two full re-runs in a row without resetting data in between
  (proves the suite is self-isolating, not just passing once by luck).

## VALIDATION RESULTS

- **Migration**: PASS — `prisma migrate status` reports "Database schema is up to date!"
  against 4 applied migrations.
- **Seed**: PASS — ran twice; second run left row counts unchanged (8 roles / 3 permissions
  / 6 role_permissions / 1 user).
- **Unit Tests**: PASS — 16/16 (`npm run api:test`).
- **Integration Tests**: PASS — 9/9 (`npm run api:test:e2e`), run twice consecutively with
  no failures.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint` (ESLint 9 flat config + typescript-eslint), zero
  errors/warnings.
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.

Commands (from repo root, `E:\abroad-scholarship-system`):
```
docker compose up -d
npm install
npm run db:migrate:deploy   # or db:migrate:dev when adding new migrations
npm run db:seed
npm run api:test
npm run api:test:e2e
npm run api:typecheck
npm run api:lint
npm run api:build
```

## ASSUMPTIONS
- **ASM-04** (new, this phase): One `Role` per `User` (no many-to-many `UserRole`) — the
  Core Entities list in `00_MASTER_CONTEXT.md` names `RolePermission` but no `UserRole`,
  taken as the intended cardinality. Full text in `docs/ASSUMPTIONS.md`.
- Carried over from Phase 01 and still load-bearing here: ASM-01 (Profile Development maps
  onto the `counseling` domain — not yet touched, no conflict), ASM-02 (e-signature manual
  flow — `contracts.signed_document_id` is a plain string reference, not yet wired to any
  provider, consistent with the deferral), ASM-03 (Visa/pre-departure not modeled yet —
  correctly absent from this phase's schema).

No new entry was needed in `docs/DECISIONS.md` (root) — no requirement conflict was found
between the two Phase 02 instruction files, SRS, or `00_MASTER_CONTEXT.md`.

## RISKS
- `AuthGuard`'s permission check currently only covers the 3 permissions seeded for the
  `students` demo (`students:view/create/edit`). Phase 03 must seed/author the full
  permission matrix (module × action, SRS 6.1/13) before any other business endpoint can
  rely on `@RequirePermission` meaningfully — otherwise every such route 403s by default
  (which is the correct deny-by-default behavior, but worth calling out so Phase 03 doesn't
  get surprised by an "everything is forbidden" starting state).
- Response bodies are not field-filtered by role yet (`budget`, when it exists on other
  entities' equivalents, is visible to any role that can view the record at all). Phase 03
  RBAC must add this before Contract/Payment/Visa-adjacent endpoints go live — those carry
  genuinely sensitive fields per SRS section 13, unlike `Student.budget` used here.
- `IdempotencyKey` rows are never purged (no scheduled-job infra exists yet — that's
  `12-platform/02_INTEGRATIONS_JOBS.md`). Low risk at this stage (dev-only, low volume) but
  should not be forgotten once real traffic exists.

## KNOWN ISSUES
- `npm audit` reports 3 high-severity advisories, all the same root cause: a
  stack-exhaustion issue in `deepmerge-ts`, a transitive dependency of Prisma's own config
  loader (`@prisma/config`). It is a dev-tooling dependency (not shipped in the built
  `apps/api/dist` output, not reachable from any HTTP-facing code path), and the suggested
  fix (`npm audit fix --force`) would downgrade `prisma` to 6.12.0, an older release with
  fewer features than the 6.19.3 in use. Left as-is; worth re-checking when Prisma ships a
  patched version.
- `eslint-visitor-keys@5.0.1` (a transitive dep of the ESLint 9 toolchain) declares an
  engines requirement of `^20.19.0 || ^22.13.0 || >=24`; this machine runs Node `22.11.0`,
  slightly below `22.13.0`. npm prints an `EBADENGINE` warning on every install but lint
  ran correctly with zero errors — not currently a real blocker, flagged in case a future
  ESLint/toolchain update starts actually requiring it.
- The Postgres container this phase depends on
  (`docker-compose.yml` → `abroad-scholarship-postgres`, port `55432`) must be running
  (`docker compose up -d`) for migrations/seed/integration tests to work. It is currently
  running and healthy, but is not started automatically by anything outside Docker itself
  — Phase 03 onward should keep starting it the same way (no change needed, just noting it
  is a manual/docker-managed dependency, not a system service).

## next dependency (for Phase 03)
- `docs/api/API_CONVENTIONS.md` section 1–2 (`AuthContextMiddleware`, `AuthGuard`) is the
  exact scaffold Phase 03 (`03-security/01_AUTH.md`, `02_RBAC.md`) must build real
  login/session/MFA and the full scope/case-ownership/field-level policy engine on top of
  — without renaming/duplicating `Principal`, `@RequirePermission`, or `RolePermission`.
- `docs/database/DATA_DICTIONARY.md` section 5 ("Deliberately deferred DB-level
  enforcement") lists every business rule Phase 03+ still needs to enforce at the service
  layer.
- The seeded `roles`/`permissions`/`role_permissions` rows are a minimal bootstrap, not the
  full matrix — Phase 03 will need to seed the complete SRS 6.1/13 permission set.

READY FOR PHASE 03: YES

Không tự chuyển sang Phase 03. Chờ prompt tiếp theo.
