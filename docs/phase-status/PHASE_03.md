# PHASE STATUS — PHASE_03 (Security)

## status
PASS

## scope
Phase 03A (Authentication, `03-security/01_AUTH.md`) + Phase 03B (RBAC + field-level
authorization, `03-security/02_RBAC.md`) + Phase 03C (Audit, `03-security/03_AUDIT.md`).
Built directly on top of the Phase 02 foundation (User/Role/Permission/RolePermission
schema, AuthGuard/AuditInterceptor scaffolding, `students` reference endpoints) — no
architecture rewrite, no duplicate User/Role/Permission/Audit concept introduced. No
Phase 04+ business feature (Lead conversion, Case workflow, Contract, Document, Task
business logic) was implemented.

## implemented

**Authentication**: real login (password + optional MFA second factor), logout, password
reset (request/confirm with single-use replay-prevented tokens), refresh-token rotation,
explicit session revocation (single + "all others"), account suspension/offboarding
(status-driven, revokes active sessions), internal MFA (TOTP + hashed single-use backup
codes, secret encrypted at rest), login-attempt tracking + brute-force lockout
(configurable threshold/duration). Full design rationale: `docs/security/AUTH_MODEL.md`.

**RBAC + field-level**: `ScopePolicyService` implements 4 scope kinds (GLOBAL,
CASE_MEMBER, OWN_STUDENT, NONE) covering Case ownership, Student self, Parent-linked
student, and (approximated, see Assumptions) Department/team scope, enforced at the
service layer on `students`/`cases`, not just via the role→permission guard.
`FieldPolicyService` redacts Budget/Finance on every `students` response by role.
Out-of-scope records return `404`, not `403` (SRS AC-02). Full matrix:
`docs/security/RBAC_MATRIX.md`.

**Audit**: `AuditLog` gained a `metadata` JSONB column (SRS 6.21 export reason/filter/
row-count/fields) and a `studentId` best-effort backfill on write. `AuditInterceptor`
(existing since Phase 02) had a real, fire-and-forget-write race condition found and
fixed during this phase (mirroring the exact bug class already fixed once in Phase 02's
idempotency interceptor — see Known Issues). `GET /audit-logs` (query/filter, admin-only)
is the query capability `03_AUDIT.md` asks for; there is no delete path anywhere for
`AuditLog` (Hard Rule #5).

**New endpoints**: `/auth/*` (12 routes), `/users/*` (5 routes, SYSTEM_ADMIN-oriented),
`/cases` + `/cases/:id` (read-only, RBAC scope reference), `GET /audit-logs`;
`students` extended with `PATCH :id/archive`, `GET /students/export`, and scope/
field-level enforcement retrofitted onto the existing `GET/PATCH` routes.

**A real bug was found and fixed during this phase's own validation**: the Phase 03 seed's
first version was purely additive (upsert-only) — it granted the new permission matrix but
never revoked a stale grant left over from Phase 02's original bootstrap seed
(`SYSTEM_ADMIN` could still read `Student` data despite the redesigned matrix saying it
shouldn't be able to). Caught by `apps/api/test/rbac.e2e-spec.ts`, root-caused, and fixed
by making the seed grant-then-prune per role. Full write-up: `docs/DECISIONS.md` DEC-02.

## files read
- `03-security/01_AUTH.md`, `03-security/02_RBAC.md`, `03-security/03_AUDIT.md`
- Phase 01/02 documentation and checkpoints already in this session's context:
  `docs/architecture/{TARGET_ARCHITECTURE,DOMAIN_MAP,DECISIONS}.md`,
  `docs/database/{ERD,DATA_DICTIONARY}.md`, `docs/api/API_CONVENTIONS.md`,
  `docs/phase-status/{01-discovery,PHASE_02}.md`, `docs/ASSUMPTIONS.md`,
  `database/schema.prisma`, `apps/api/src/**` (existing Phase 02 code)

## files created/updated
Database: `database/schema.prisma` (Session, PasswordResetToken, MfaSecret,
MfaBackupCode, `users.locked_until`, `students`/`student_contacts.portal_user_id`,
`audit_logs.metadata`), `database/migrations/*` (3 new migrations),
`database/seeds/seed.ts` (full rewrite: permission matrix + grant/prune sync + demo
users + RBAC fixture graph).

API (`apps/api/src/`): `common/context/{principal,auth-context.middleware}.ts` (session-
aware), `common/audit/audit.interceptor.ts` (metadata support + race-condition fix),
`common/security/{password,token,mfa-encryption}.util.ts` (+ specs),
`modules/identity/**` (new: auth/{auth.controller,auth.service,mfa.controller,
mfa.service,session.service,token.service,dto/*}, rbac/{scope-policy,field-policy}.service.ts
+ specs, users/{users.controller,users.service,dto/*}, identity.module.ts),
`modules/case-management/students/**` (scope/field-level/archive/export wiring),
`modules/case-management/cases/**` (new), `modules/reporting/audit-logs/**` (new),
`app.module.ts`, `main.ts` (cookie-parser), `package.json` (otplib, cookie-parser,
jsonwebtoken already present), `eslint.config.mjs` (varsIgnorePattern fix).

Tests (`apps/api/test/`): `auth.e2e-spec.ts`, `rbac.e2e-spec.ts`, `audit.e2e-spec.ts`
(new), `students.e2e-spec.ts` (updated for session-aware auth), `helpers/
{issue-session,create-test-user}.ts` (new).

Docs: `docs/security/{AUTH_MODEL,RBAC_MATRIX}.md` (new), `docs/api/API_CONVENTIONS.md`
(sections 1, 2, 11 updated), `docs/database/{ERD,DATA_DICTIONARY}.md` (Phase 03 sections
added), `docs/ASSUMPTIONS.md` (ASM-05 through ASM-09 added), `docs/DECISIONS.md` (DEC-01,
DEC-02 added), this file.

## authentication
See `docs/security/AUTH_MODEL.md` for full rationale. Summary: short-lived (15 min,
configurable) stateless JWT access token whose `jti` is re-validated against a real
`sessions` row on every request (not purely stateless — this is what makes revocation,
suspension, and offboarding take effect immediately, per SRS AC-14). Opaque, hashed,
rotating refresh tokens (7 days, configurable), delivered via httpOnly `Secure` cookie
+ response body. Passwords: `scrypt`, random salt, constant-time verification. MFA: TOTP
(`otplib`), AES-256-GCM-encrypted secret at rest (key separate from the JWT secret), 8
single-use hashed backup codes. Lockout: configurable attempt threshold/duration,
distinct `423 ACCOUNT_LOCKED` (vs. generic `401 INVALID_CREDENTIALS` for
wrong-password/unknown-user, to avoid enumeration while still surfacing the lockout state
itself). Password reset: single-use, hash-stored, replay-rejected token; always returns a
generic success shape regardless of whether the email exists.

## RBAC
`ScopePolicyService` — 4 scope kinds mapped 1:1 to the 8 roles (`docs/security/
RBAC_MATRIX.md` section 3). Enforced at the service layer (`StudentsService.getById`/
`update`/`archive`/`export`, `CasesService.getById`), not only at the guard — a caller who
passes the role→permission check still gets `404` on a specific record outside their
scope. List endpoints apply the equivalent filter so out-of-scope rows never appear in a
paginated result either. `docs/DECISIONS.md` DEC-02 documents why the permission seed is
sync (grant+prune), not additive-only, after that exact gap let a role keep an
already-revoked grant.

## permission model
`Permission(resource, action)` + `RolePermission` (Phase 02 schema, unchanged) — the
matrix now covers `students`, `cases`, `users`, `audit_logs` across the 10 actions
`02_RBAC.md` names (VIEW/CREATE/EDIT/ARCHIVE/EXPORT implemented where an endpoint exists;
APPROVE/ASSIGN/DOWNLOAD/SHARE/DELETE have no exposing endpoint yet — see `docs/security/
RBAC_MATRIX.md` section 4 for exactly why, per action). Full grant table: same document,
section 2.

## field-level security
`FieldPolicyService` — implemented and live for Budget/Finance (`Student.budget`/
`budgetCurrency`, redacted for DOCUMENT_SPECIALIST/SALES_MARKETING/SYSTEM_ADMIN, visible
otherwise). Internal-notes redaction logic implemented and unit-tested
(`canViewComment`) but not wired to a live endpoint — `Comment` CRUD is Phase 06 scope.
Passport/contract value/payment-debt/commission/visa-evidence: no endpoint exposes those
fields yet (Phase 05/09/10) — nothing to redact until then. See `docs/ASSUMPTIONS.md`
ASM-07 for the "V"/"Hạn chế"/"Không" → allow/redact simplification, and `docs/security/
RBAC_MATRIX.md` section 5 for the full per-field-group status table.

## audit
Every sensitive action list in `03-security/03_AUDIT.md` maps to a real, tested
`@Audit(action)` route: LOGIN, LOGOUT, VIEW, CREATE, EDIT, ARCHIVE, EXPORT are all
exercised end-to-end; DOWNLOAD/SHARE/APPROVE/PERMISSION_CHANGE have no endpoint yet to
audit (nothing invented ahead of the phase that builds them). `audit_logs.metadata` JSONB
added for export's reason/row-count/fields-exported (SRS 6.21). DENIED attempts (401/403)
are audited on every `@Audit`-decorated route, not just successes. No delete path exists
anywhere for `AuditLog` — verified directly (`DELETE /audit-logs/:id` → `404`, no route
registered, for every role including SYSTEM_ADMIN). Query/filter capability: `GET
/audit-logs`, admin-only (`audit_logs:view` — EXECUTIVE_DIRECTOR, SYSTEM_ADMIN); no admin
UI screen exists to drive it (see `docs/ASSUMPTIONS.md` ASM-08 — no frontend app exists in
this repository at any phase yet).

## database changes
3 new migrations (see below) on top of Phase 02's 4: 4 new tables (`sessions`,
`password_reset_tokens`, `mfa_secrets`, `mfa_backup_codes`), 4 new columns on existing
tables (`users.locked_until`, `students.portal_user_id`, `student_contacts.portal_user_id`,
`audit_logs.metadata`). No entity renamed, merged, or duplicated. Full reference:
`docs/database/{ERD,DATA_DICTIONARY}.md` (sections 10 / 4.16 respectively).

## migrations
1. `20260818110122_auth_session_mfa_scope_links` — Session, PasswordResetToken,
   MfaSecret, MfaBackupCode; `users.locked_until`; `students`/`student_contacts.
   portal_user_id`.
2. `20260818111815_audit_log_metadata` — `audit_logs.metadata` JSONB.
3. (generalization migrations from Phase 02 continued numbering; no further schema
   changes were needed beyond the two above for this phase.)

All applied via `prisma migrate dev`/`deploy` against the same dedicated project-local
Postgres container introduced in Phase 02 (`docker-compose.yml`, port 55432) — no manual
schema edits, no `db push` used for anything that shipped. (Two of the migrations in this
phase were generated via `prisma migrate diff` + a hand-created migration folder, applied
with `migrate deploy`, because `migrate dev` requires an interactive confirmation prompt
for the "adding a unique constraint" warning that this non-interactive environment cannot
answer — same pattern already used and documented in Phase 02.)

## API changes
See `docs/api/API_CONVENTIONS.md` section 11 for the full endpoint list. Summary: 12
`/auth/*` routes, 5 `/users/*` routes, 2 `/cases` routes, 1 `/audit-logs` route, plus 2 new
+ 2 retrofitted `/students` routes (archive, export; get/list/update now scope-checked and
field-redacted).

## UI changes
None. No frontend application exists in this repository at any phase — see
`docs/ASSUMPTIONS.md` ASM-08. `03_AUDIT.md`'s "query/filter UI" requirement is satisfied
by the API a UI would call (`GET /audit-logs`), not a rendered screen.

## security tests
`apps/api/test/auth.e2e-spec.ts` (12 tests) — every scenario `01_AUTH.md` names: valid
login, invalid login (wrong password + unknown username, same generic code), locked
account, expired session, revoked session (single + "revoke all others"), MFA allow/deny,
reset token replay prevention — plus account suspension and a LOGIN audit-record check.

`apps/api/test/rbac.e2e-spec.ts` (16 tests) — ALLOW + DENY for every ScopeKind
(`02_RBAC.md`'s explicit requirement), against real HTTP endpoints and a real fixture
Student/Case graph, including: case-membership allow/deny, self/parent-linked allow +
unlinked deny + cross-student deny, permission-layer denial (SALES_MARKETING,
ADMIN_FINANCE, SYSTEM_ADMIN all correctly blocked from Student data), scope-filtered list
correctness, live Budget field-level redaction, and the EXECUTIVE_DIRECTOR/SYSTEM_ADMIN
separation-of-duties boundary on `/users`.

`apps/api/test/audit.e2e-spec.ts` (8 tests) — VIEW/ARCHIVE/EXPORT audit records with
correct metadata, EXPORT validation (no reason → 400 before anything auditable happens),
a DENIED-attempt audit record, admin-only access to the query endpoint, and the "no delete
route exists" check.

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate status`: "Database schema is up to date!" (6
  migrations applied, 3 new this phase).
- **Seed**: PASS — grant/prune verified directly against the database (stale
  `SYSTEM_ADMIN` grants confirmed removed); re-run twice with unchanged row counts on the
  second run (idempotent).
- **Unit Tests**: PASS — 71/71 (`npm run api:test`; up from 16 at the end of Phase 02 —
  55 new tests: password/token/MFA-encryption utils, AuthGuard decision matrix,
  session-aware AuthContextMiddleware, MfaService, ScopePolicyService,
  FieldPolicyService).
- **Integration Tests**: PASS — 45/45 (`npm run api:test:e2e`), across 4 suites
  (`students`, `auth`, `rbac`, `audit`), run twice consecutively with no failures and no
  data-reset between runs (self-isolating).
- **RBAC Tests**: PASS — 16/16 (subset of the above, `rbac.e2e-spec.ts`).
- **Security Tests**: PASS — 20/20 (`auth.e2e-spec.ts` 12 + `audit.e2e-spec.ts` 8, subsets
  of the above).
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing-pattern `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock — not errors, does not fail the build).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.

Commands (from repo root):
```
docker compose up -d
npm install
npm run db:migrate:deploy
npm run db:seed
npm run api:test
npm run api:test:e2e
npm run api:typecheck
npm run api:lint
npm run api:build
```

## ASSUMPTIONS
5 new (ASM-05 through ASM-09), full text in `docs/ASSUMPTIONS.md`:
- **ASM-05**: `Student`/`StudentContact.portalUserId` added — required to make "Student
  self"/"Parent-linked student" scope enforceable at all.
- **ASM-06**: `DEPARTMENT_MANAGER`'s "Department/team scope" approximated as GLOBAL — no
  `Department` entity exists anywhere in the project.
- **ASM-07**: SRS §13's "V"/"Hạn chế"/"Không" collapsed to a binary allow/redact for field-
  level protection.
- **ASM-08**: No admin UI for audit query — the API is this phase's deliverable; no
  frontend app exists in the repo yet.
- **ASM-09**: `STUDENT_PARENT` granted `students:view` but not `edit` this phase —
  self-service field-editing rules are Phase 11 (Portal) scope.

2 new architecture/security decisions (DEC-01, DEC-02) in `docs/DECISIONS.md` — session
revocation model, and the seed's grant+prune (not additive-only) permission sync.

## RISKS
- Permission matrix covers only the 4 resources with real endpoints
  (`students`/`cases`/`users`/`audit_logs`). Every future controller must add its own
  `RequirePermission`/`ScopePolicyService` wiring and seed grants — nothing generic
  auto-applies to a new resource, by design (explicit over implicit), but that means it's
  also possible to forget, same as any permission system.
- One DB round-trip added per authenticated request
  (`AuthContextMiddleware` session-row check) — acceptable at current scale, flagged in
  `docs/security/AUTH_MODEL.md` as the first thing to revisit once queue/cache infra
  exists.
- `IdempotencyKey`/`Session`/`PasswordResetToken`/`MfaBackupCode` rows past their
  `expiresAt`/consumed state are never purged (no scheduled-job infra yet — Phase 12,
  same pre-existing note carried over from Phase 02's own known issues).
- MFA re-enrollment while already enabled, and MFA disablement, are both refused/not
  implemented respectively (see `docs/security/AUTH_MODEL.md` section 5) — a user who
  loses their authenticator device has no self-service recovery path in this phase beyond
  backup codes; an admin-assisted recovery flow would need to be added before this goes
  to real users with MFA turned on.

## KNOWN ISSUES
- **Fixed during this phase, documented for the record**: `AuditInterceptor`'s original
  write-then-respond logic used a fire-and-forget `tap(...)` for the success path — the
  exact same bug class already found and fixed once in Phase 02's `IdempotencyInterceptor`
  (`docs/api/API_CONVENTIONS.md` section 9). Fixed proactively here (before it caused an
  observed test failure, unlike the Phase 02 instance) by using `concatMap` to await the
  write before the response completes.
- Carried over from Phase 02, still accurate: `npm audit` reports 3 high-severity
  advisories in `deepmerge-ts` (transitive Prisma config-loader dependency, dev-tooling
  only, not reachable from any HTTP path); `eslint-visitor-keys@5.0.1`'s `EBADENGINE`
  warning against this machine's Node `22.11.0` (lint runs correctly regardless).
- `otplib` had to be pinned to `12.0.1` rather than the current major (`13.x`) — `13.x`'s
  rewritten internals depend on an ESM-only package (`@scure/base`) that fails to load
  under this project's CommonJS/ts-jest/Nest setup (`ERR_REQUIRE_ESM`). `12.0.1` is
  deprecated upstream (author recommends v13) but is a stable, previously-released version
  with no functional gap for TOTP/HOTP generation as used here — revisit when either
  otplib publishes a CJS-compatible v13+ release or this project's module system changes.
- A misleading debugging detour during this phase's own validation is worth recording so
  it isn't mistaken for a code defect later: running `jest` directly via
  `npx --prefix apps/api jest --config apps/api/jest.e2e.config.js` (instead of the
  `npm run api:test:e2e` workspace script) does not change the process's working
  directory, which made `ts-jest`'s relative `tsconfig: 'tsconfig.json'` path resolve to
  the *repository root* tsconfig (no `experimentalDecorators`) instead of `apps/api`'s —
  producing confusing decorator-related TypeScript errors that had nothing to do with the
  application code. Always use the `npm run api:*` / `npm run db:*` workspace scripts, not
  a direct `npx --prefix` invocation, when running this project's tooling.

## next dependency (for Phase 04)
- `ScopePolicyService`/`FieldPolicyService` (`apps/api/src/modules/identity/rbac/`) are
  the pattern every Phase 04 business endpoint (Lead, full Case CRUD/workflow) must reuse
  — extend `ScopeKind` usage and `RBAC_MATRIX.md`'s grant table, don't reimplement
  per-module authorization logic.
- The Lead→Contract→Student+Case saga (SRS 6.2, `docs/architecture/TARGET_ARCHITECTURE.md`
  section 12) will need to decide how/when a `Student.portalUserId` or
  `StudentContact.portalUserId` gets linked to a real login — not decided in this phase
  (ASM-05 only added the columns; population logic is a Phase 04/11 concern).
- `database/seeds/seed.ts`'s `GRANTS` table is now the authoritative permission matrix —
  Phase 04 must extend it (grant + the corresponding entries in
  `docs/security/RBAC_MATRIX.md`) for every new resource/action it introduces, following
  the DEC-02 sync (not additive-only) pattern.

READY FOR PHASE 04: YES

Không tự chuyển sang Phase 04. Chờ prompt tiếp theo.
