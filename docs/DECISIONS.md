# ARCHITECTURE / BUSINESS DECISIONS

Mỗi quyết định phải ghi: ID, context, options, decision, reason, impact.

---

## DEC-01 — Access-token session revocation checked per-request against the database (Phase 03)

**ID**: DEC-01
**Context**: `03-security/01_AUTH.md` requires "revoke session" and SRS AC-14 requires that
offboarding "revoke session đang hoạt động theo policy" — the previously-issued access
token must lose access, not just future logins. A pure stateless JWT access token cannot
satisfy this: once issued, it works until its own expiry regardless of what an admin does
afterward.
**Options**:
1. Pure stateless JWT access tokens, no server-side session record at all — simplest,
   fastest (no DB hit per request), but revocation can only ever take effect at the
   token's natural expiry.
2. Short-lived stateless access token + a server-side `Session` row keyed by the token's
   `jti`, re-validated on every authenticated request.
3. Fully server-side sessions (opaque session id only, no JWT), validated per request —
   same DB cost as option 2 but loses the self-contained-claim benefits of a JWT (role
   embedded in the token, useful for the RolePermission lookup already needed anyway).
**Decision**: Option 2 — short-lived (`AUTH_ACCESS_TOKEN_TTL_MINUTES`, default 15) JWT
access token carrying `{ sub, roleCode, jti }`; `jti` is a real `sessions` row id,
re-checked (existence, `revokedAt`, `expiresAt`, and the owning user's `status`) on every
request by `AuthContextMiddleware`.
**Reason**: Only option 2/3 satisfy AC-14's "revoke session đang hoạt động" as an
observable behavior (verified directly by `apps/api/test/auth.e2e-spec.ts` "revoked
session"), and option 2 keeps the JWT payload's `roleCode` claim, which `AuthGuard` already
needs to look up next to the DB check.
**Impact**: One indexed DB lookup added to every authenticated request. Accepted at the
project's current scale; a session-validity cache is the natural place to remove this cost
once the queue/cache infra from `docs/architecture/TARGET_ARCHITECTURE.md` section 5
(Redis/BullMQ) exists — not before. Full write-up: `docs/security/AUTH_MODEL.md` section 1.

---

## DEC-02 — RolePermission seed is sync (grant + prune), not additive-only

**ID**: DEC-02
**Context**: Phase 02's original seed granted `students:view/create/edit` to
`SYSTEM_ADMIN` and `EXECUTIVE_DIRECTOR` as a bootstrap convenience. Phase 03 redesigned the
permission matrix per SRS section 3 (`docs/security/RBAC_MATRIX.md`) and deliberately
removed `students:*` from `SYSTEM_ADMIN`. The first version of the Phase 03 seed only
`upsert`ed the grants listed in its `GRANTS` table, never removing a `RolePermission` row
that used to exist but is no longer listed — `apps/api/test/rbac.e2e-spec.ts` caught this
directly: `SYSTEM_ADMIN` could still read Student records that its own documented
permission table says it shouldn't be able to.
**Options**:
1. Keep the seed purely additive (`upsert`-only) and rely on a manual migration/script to
   remove stale grants whenever `GRANTS` changes.
2. Make the seed the single source of truth: for every role, grant everything listed in
   `GRANTS` AND delete any `RolePermission` row for that role not in the current `GRANTS`
   set.
**Decision**: Option 2 — `database/seeds/seed.ts` now does grant-then-prune per role on
every run.
**Reason**: Option 1 is exactly what caused the privilege-creep bug: a role kept a
permission it should have lost simply because nothing ever re-ran a cleanup step. A
security-relevant configuration (who can access what) should not depend on someone
remembering a separate manual step — the seed script re-asserting the *complete* desired
state, every time it runs, removes that failure mode structurally rather than relying on
discipline.
**Impact**: `database/seeds/seed.ts`'s `GRANTS` constant is now authoritative — a
`RolePermission` row that exists in the database but isn't in `GRANTS` will be deleted the
next time the seed runs. Any manual/ad-hoc permission grant made outside the seed (e.g.
directly in a running database) will not survive a re-seed — this is intentional, not a
bug to work around.

---

## DEC-03 — Two Phase 02/03 defects found and fixed by Phase 04's own integration testing

**ID**: DEC-03
**Context**: Building and testing `LeadsService.convert()`'s merge path (04-core-crm/
01_LEAD.md duplicate-detection requirement) surfaced two pre-existing defects that had
gone unnoticed because nothing before Phase 04 exercised these exact code paths:

1. `Lead.convertedStudentId` was `@unique` (Phase 02 schema) — a real Postgres
   constraint violation the instant a second Lead legitimately merged into an
   already-converted Student.
2. `ErrorContractFilter` (Phase 02) only forwarded `code`/`message`/`details` from a
   thrown exception's body — every other custom field a service attached (`candidates`,
   `lockedUntil`, `allowedTransitions`, `openTaskCount`, etc.) was silently dropped from
   the JSON response, undetected until a Phase 04 test actually asserted on
   `error.candidates`.

**Options** (for each): patch around the symptom in Phase 04 code only, vs. fix the
actual Phase 02/03 defect in place.
**Decision**: Fixed both at the source — see `docs/ASSUMPTIONS.md` ASM-11 for the schema
fix (migration `20260818131515_fix_lead_converted_student_not_unique`,
`Student.leadOrigin` → `leadOrigins`), and `apps/api/src/common/filters/
error-contract.filter.ts` for the filter fix (now passes through every extra body
property except the reserved `code`/`message`/`statusCode`/`error`/`details`, plus a new
`error-contract.filter.spec.ts` to guard the regression).
**Reason**: Per the explicit Phase 04 instruction ("Xác định root cause. Sửa trong phạm vi
Phase 04. Chạy lại regression tests") — a defect discovered while doing Phase 04 work,
even if its root cause lives in earlier-phase code, gets fixed at the root, not patched
around, and the fix must be re-verified by the full regression suite (done: 100 unit + 77
e2e, both re-run twice for repeatability).
**Impact**: Every earlier phase's error responses that happened to include extra
structured fields (e.g. `ACCOUNT_LOCKED`'s `lockedUntil`, any `INVALID_STATUS_TRANSITION`'s
`allowedTransitions`) now actually deliver those fields to the caller — this is a
behavior change (previously-silent data loss is now visible data), not a breaking one: no
caller could have been relying on a field that was always absent.

---

## DEC-04 — A Phase 02 `IdempotencyInterceptor` defect found and fixed by Phase 05's own testing

**ID**: DEC-04
**Context**: `apps/api/test/payments.e2e-spec.ts`'s duplicate-transaction-protection test
(POST `/payments/:id/record` replayed with the same `Idempotency-Key`) found that the
replayed response's `Prisma.Decimal` fields (`amount`, `paidAmount`, `refundedAmount`) came
back as JSON *numbers*, while the original (first) response — serialized the normal way,
through Express's `res.json()`, which calls `Decimal.toJSON()` — had returned them as
*strings*. Root cause: `IdempotencyInterceptor.store()` handed the raw response object
(with live `Decimal` instances inside it) directly to `prisma.idempotencyKey.create()`
against a `Json` column; Prisma's own wire serialization of a `Decimal` into a `Json`
column produces a plain number, not the app-level `toJSON()` string form.
**Options**: work around it only in the Payment test/response shape, vs. fix
`IdempotencyInterceptor` itself.
**Decision**: Fixed at the source — `store()` now round-trips the body through
`JSON.parse(JSON.stringify(body))` before persisting, guaranteeing the stored JSON is
byte-identical in shape to what the original HTTP response actually sent, regardless of
what Prisma's `Json`-column wire serialization would otherwise do to nested `Decimal`/
`Date`/etc. values.
**Reason**: `IdempotencyInterceptor` exists specifically for "transaction-sensitive"
endpoints (its own doc comment names "contract creation, payment recording" as the
motivating examples) — 05-commercial's Contract/Payment routes are exactly the traffic
this component was built to protect, so a type-drift bug in a *replayed* response for
money fields is a live correctness defect for this phase's own domain, not a
tangentially-related one. Fixed at the root per the same standing rule DEC-03 established
(root-cause fixes, not symptom patches, re-verified by the full regression suite).
**Impact**: Every idempotent-marked route across every phase that returns a `Decimal` (or
any other type whose JSON serialization isn't a plain value-preserving round-trip, e.g.
`BigInt`) now returns a byte-identical body on a replayed request as it did on the first
request. No caller could have been relying on the previous type-drift behavior, since it
was undocumented and only affected the second-and-later replay of the exact same
Idempotency-Key. Full regression re-run clean: 149 unit + 141 e2e (100 unit + 77 e2e from
Phase 04, plus 49 unit + 64 e2e added by Phase 05).

## DEC-05 — Application's Phase 02 `@@unique([studentId, programId])` relaxed to a service-layer "at most one active" check (Phase 08)

**ID**: DEC-05
**Context**: Phase 02's foundation slice modeled `Application` with a DB-level
`@@unique([studentId, programId])` constraint (documented at the time as "one Application
per Student/Program pair — SRS 6.11"). 08-admission/02_APPLICATION.md — the first phase to
actually build Application's real service/workflow — requires: "Prevent duplicate active
applications for the same student/program unless business rule explicitly allows it,"
matched on "Student + Program + intended intake," and explicitly: "Nếu business rule cho
phép resubmission/reapplication: mô hình hóa rõ ràng, không dùng một bản ghi Application
duy nhất để che giấu nhiều lần nộp" (a genuine reapplication must be modeled as its own
row, never hidden inside one overwritten record). These two requirements directly
conflict: the Phase 02 hard unique constraint makes a second, legitimate Application row
for the same (student, program) — e.g. reapplying after a REJECT, or a later intake cycle
— permanently impossible, for the life of the row, even though `ApplicationStatus`
includes exactly the terminal states (`REJECT`, `WITHDRAWN`) a reapplication scenario
would naturally follow.
**Options**: (a) keep the DB-level unique constraint and read "no duplicate" as "ever, DB-
enforced" — satisfies the letter of 02_APPLICATION.md's duplicate-prevention sentence but
makes the same file's very next sentence (reapplication must be modeled as a new row)
structurally impossible; (b) drop the constraint down to a service-layer "no ACTIVE
duplicate" check, scoped to `(studentId, programId, intendedIntake)`, evaluated against
non-terminal statuses only — mirrors the already-established precedent for "at most one X
active at a time" rules in this codebase (Case: "at most one non-closed/archived Case per
Student," enforced in `CasesService`, not a DB unique index — see ERD.md section 3).
**Decision**: (b). `applications.student_id, program_id` is now a plain (non-unique)
composite index (query performance only); `ApplicationsService.assertNoActiveDuplicate`
rejects `POST /cases/:caseId/applications` with `409 ACTIVE_APPLICATION_EXISTS` only when
an existing Application for the same `(studentId, programId, intendedIntake)` is not
already `REJECT` or `WITHDRAWN`. A genuine reapplication after either terminal status
creates a new row with its own id/history; the prior row's data is never touched.
**Reason**: 08-admission/02_APPLICATION.md's own two duplicate-related sentences only
cohere under interpretation (b) — under (a) they contradict each other. This is a
technical-requirements conflict between an already-PASSed Phase 02 schema decision and a
concrete, explicit Phase 08 instruction, not an ambiguity to quietly resolve with an
assumption (`docs/ASSUMPTIONS.md`), and not a bug in Phase 02's original code (the Phase
02 foundation-slice constraint was a reasonable "no real workflow exists yet" placeholder,
correctly deferred detail to whichever phase built the real Application service — this
one). Following the same standing rule as DEC-03/DEC-04: found by this phase's own design
work before any data existed under the old constraint (zero `Application` rows existed at
migration time — confirmed via a row count check before applying), fixed at the schema
level via an additive migration (`DROP CONSTRAINT`/`DROP INDEX` + `CREATE INDEX`, no data
loss), re-verified by the full regression suite.
**Impact**: `Application` now supports legitimate reapplication (SRS 6.11's "Application
là transaction độc lập" now correctly allows more than one transaction per student/program
pair across time, provided no more than one is ever concurrently active). No caller could
have been relying on the old hard-unique behavior, since no `POST /applications` (or
equivalent) endpoint existed before this phase — this is the first phase Application ever
had a real create path. Verified directly: rejecting a second active application for the
same (student, program, intake); allowing a new row after WITHDRAWN; allowing two
simultaneously-active rows for genuinely different intakes. Full regression re-run clean:
231 e2e (Phase 01-07 unchanged) + 64 new Phase 08 e2e, 295 total; 161 unit unchanged.

## DEC-06 — `StudentContact.portalUserId`'s Phase 03 `@unique` constraint relaxed to a plain index (Phase 11)

**ID**: DEC-06
**Context**: Phase 03B modeled `StudentContact.portalUserId` (the "linked parent" pointer
backing RBAC's OWN_STUDENT scope, `docs/ASSUMPTIONS.md` ASM-05) as `String? @unique`. Phase
11's own instruction file requires a Parent Access Model supporting "phụ huynh có nhiều
con" (a parent with multiple children) and multi-student context selection at
`GET /portal/me` — one Parent `User` account legitimately needs to link to more than one
`StudentContact` row (one per child). The Phase 03 `@unique` constraint makes this
structurally impossible: the second `StudentContact.portalUserId` write for the same
`User` would violate the unique index outright, for the life of both rows.
**Options**: (a) keep the DB-level unique constraint and require a separate `User` account
per child a Parent has in the system — contradicts "một Parent, nhiều Student" being a
completely ordinary real-world case the phase instruction explicitly anticipates, and would
force `PortalAccessService.acceptInvitation` to either violate the constraint or silently
create a duplicate/fragmented Parent identity per child; (b) drop the constraint to a plain
(non-unique) index — mirrors DEC-03's/DEC-05's precedent of relaxing an over-eager Phase 02/
03 uniqueness assumption once a later phase's real workflow proves it wrong, scoped to
exactly the column that was wrong.
**Decision**: (b). `student_contacts.portal_user_id` is now a plain (non-unique) index
(query performance only, via `@@index([portalUserId])`); every `ScopePolicyService`
OWN_STUDENT-aware method additionally requires `portalStatus = 'ACTIVE'` on the specific
`StudentContact` row being evaluated (`docs/ASSUMPTIONS.md` ASM-46), so relaxing the
uniqueness does not weaken per-relationship revocability — each child's link is revoked
independently by revoking that child's own `StudentContact` row, not by touching the shared
`User`.
**Reason**: 11-portal/01_STUDENT_PARENT_PORTAL.md's own Parent Access Model section names
multi-child support as a concrete requirement, not a hedge — under interpretation (a) it is
simply unimplementable without either a schema change or a User-identity workaround neither
the phase instruction nor `docs/ASSUMPTIONS.md` ASM-04 (one Role per User, one User per
person) would sanction. This is a technical-requirements conflict between an already-PASSed
Phase 03 schema decision and a concrete Phase 11 requirement, not an ambiguity to quietly
resolve with an assumption — found during this phase's own design work before any
`portalUserId` value existed for a StudentContact (the seed fixture predating this phase,
`demo.parent.linked`, needed its own upsert `where` clause updated from `{portalUserId:...}`
to a fixed-UUID `where: {id:...}` as a direct consequence — no data loss, confirmed via the
migration's generated SQL and a row-count check before applying).
**Impact**: A Parent `User` can now hold `ACTIVE` (or any-status) links to more than one
`StudentContact` row simultaneously. No caller could have been relying on the old
hard-unique behavior, since no invite/accept flow existed before this phase — this is the
first phase parent-portal linking ever had a real create path. Verified directly: a single
Parent `User` accepting a second invitation for a different child does not violate any
constraint and both links remain independently ACTIVE/revocable; `GET /portal/me` correctly
lists both children for that one account. Full regression re-run clean: 372 e2e (Phase
01-10 unchanged) + 30 new Phase 11 e2e (`portal.e2e-spec.ts`), 402 total — see
`docs/phase-status/PHASE_11.md`; 163 unit (2 `scope-policy.service.spec.ts` tests updated +
2 added for the paired revocation-awareness fix).

---

## DEC-07 — Frontend stack: Next.js 16 (App Router) + Tailwind CSS v4, one `apps/web` app with two route-group surfaces (Phase F01)

**ID**: DEC-07
**Context**: `docs/architecture/TARGET_ARCHITECTURE.md` §1 already fixed "React/Next.js,
TypeScript" and "một ứng dụng web duy nhất (`apps/web`)... Portal... một surface riêng trong
cùng app" as architectural constraints during the backend phases. Phase F01
(`frontend_prompts/01-foundation/01_FRONTEND_AUDIT_ARCHITECTURE.md`) needed to turn that into
a concrete, buildable stack: exact Next.js version/router, styling system, and how the
staff/portal surface split is actually implemented.
**Options**:
1. Pages Router (Next.js's older model) — more training-data-familiar, but loses built-in
   nested layouts, which the staff-vs-portal shell split needs.
2. App Router, two separate root layouts (one per surface) via route groups.
3. App Router, one shared root layout + two route groups (`(staff)`, `(portal)`) as nested
   (non-root) layouts.
**Decision**: App Router, option 3. Styling: Tailwind CSS v4 (the current `create-next-app`
default for this Next.js version), no component library (Radix/shadcn/MUI) installed at
scaffold time.
**Reason**: Option 1 forgoes the exact nested-layout mechanism the surface split is built on.
Option 2 is technically workable but triggers Next.js's "multiple root layouts → full page
reload between them" behavior for two surfaces that share the same origin, auth cookie, and
design tokens — no benefit, real cost. Tailwind v4 was kept as-is rather than swapped for
plain CSS Modules or a second system, per this phase's own "chọn một solution nhất quán...
không tạo nhiều styling systems" instruction; a component library was deliberately deferred
(F01 instruction: "tránh dependency thừa... không cài toàn bộ UI ecosystem chỉ để scaffold")
since no page yet needs one beyond the four hand-built primitives (`components/ui/`).
**Impact**: `apps/web/app/layout.tsx` is the only root layout (`<html>`/`<body>`/fonts/
`AppProviders`); `app/(staff)/layout.tsx` and `app/(portal)/portal/layout.tsx` are ordinary
nested layouts. Next.js 16 is new enough that two documented pre-16 conventions changed and
had to be corrected during this phase (verified against `node_modules/next/dist/docs/`, not
assumed from training data): `error.tsx`'s recovery callback prop is `retry`, not `reset`;
the `middleware.ts` file convention is deprecated in favor of `proxy.ts` (identical shape,
renamed file/export) — `apps/web/proxy.ts` uses the new name. A future Next.js major-version
upgrade should re-check that directory again before assuming either convention is still
current.

---

## DEC-08 — Server-state library chosen (TanStack Query) but not installed until F02 (Phase F01)

**ID**: DEC-08
**Context**: `frontend_prompts/00-context/00_FRONTEND_MASTER_CONTEXT.md` requires "loading/
error/empty/403/404/401 states" and server-side pagination/filtering everywhere the backend
supports it. F01's own scope explicitly excludes implementing domain data-fetching hooks
(`frontend_prompts/01-foundation/01_FRONTEND_AUDIT_ARCHITECTURE.md` §11-equivalent: "Không:
implement domain hooks").
**Options**:
1. Install `@tanstack/react-query` now, in F01, so F02 can start writing hooks immediately.
2. Decide and document the choice now; install it only when F02 actually writes the first
   `useQuery`/`useMutation` hook.
3. Defer the *decision* itself to F02 as well.
**Decision**: Option 2.
**Reason**: F01's own instructions explicitly warn against unnecessary dependencies
("tránh dependency thừa") — installing a data-fetching library with zero call sites through
an entire phase is exactly that. Option 3 risks each future phase re-litigating the choice;
recording the decision now (with its reasoning: TanStack Query's `isPending`/`isError`/`data`
result shape maps directly onto the master context's required loading/error/empty states,
and its cache/pagination-aware query-key model fits the backend's page-based
`{ data, meta }` convention naturally) fixes it without paying the install cost early.
**Impact**: `apps/web/package.json` has no data-fetching dependency yet. `components/
providers/app-providers.tsx` is already the designated mount point for
`QueryClientProvider` once F02 adds it — no other file needs to change when that happens.

---

## DEC-09 — Minimal backend fix: `Lead`/`Case` list+detail now include a display-safe student/owner summary; `GET /cases` gained a `studentId` filter (Phase F03)

**ID**: DEC-09
**Context**: Building the F03 CRM frontend (Leads/Students/Cases) surfaced two real backend
gaps, not frontend design choices: (1) `LeadsService.list()`/`getById()` and
`CasesService.list()`/`getById()` returned bare `ownerId`/`studentId` foreign keys with no
included relation — a list/detail page cannot show an owner's or student's name without
either an N+1 fetch per row or pulling the entire User/Student table client-side, both of
which `frontend_prompts/03-crm/03_CRM_FRONTEND.md`'s own instructions explicitly forbid
("Không load toàn bộ Student dataset chỉ để render tên. Dùng API relation/response thật").
(2) `GET /cases` had no way to filter by `studentId` at all, so a Student 360 view's "current
case(s)" section had no query to call other than the same forbidden full-table-scan.
(3) `CasesService.listMembers()` returned bare `CaseMember` rows (`userId` only) — the same
gap, for the member-list UI.
**Options**:
1. Work around it in the frontend (fetch the full Case/Lead/Student/User lists and join
   client-side) — explicitly forbidden by the frontend phase's own instructions, and a real
   scalability/security problem (pulling every User row, including ones the caller has no
   business reason to see, just to resolve a name).
2. Invent a new dedicated endpoint (e.g. `GET /cases/summary`) duplicating existing logic.
3. Minimally extend the two existing endpoints: add a `select`-scoped (never a bare
   `include: { owner: true }`, which would leak `passwordHash`) relation on the two already-
   existing queries, and add one new optional, scope-respecting query filter.
**Decision**: Option 3.
**Reason**: This is squarely "API bug thật cần sửa để CRM hoạt động," not "sửa backend chỉ
để frontend dễ code hơn" (`frontend_prompts` F03 §31's own distinction) — the CRM list/detail
UI the phase explicitly requires literally cannot be built correctly without it, and no
existing behavior changes (both are additive: a new nested field on the response, a new
optional filter that only narrows an already-scope-filtered query). Option 2 would duplicate
the exact same scope-filtering/pagination logic `CasesService.list()` already has, violating
the same "no duplicate entity/concept" principle this codebase applies everywhere else.
**Reason (security)**: the owner/student "summary" is deliberately a Prisma `select`, never a
bare relation `include`, specifically to avoid leaking `passwordHash`/`mfaSecret`-adjacent
columns through an unrelated list endpoint — verified directly by a new e2e assertion
(`expect(detail.body.owner).not.toHaveProperty('passwordHash')`).
**Impact**: `LeadsService`/`CasesService` return `LeadWithOwner`/`CaseWithRelations` instead
of bare `Lead`/`Case` from `list()`/`getById()` (additive types, existing callers unaffected —
verified via `npm run api:typecheck`, 0 errors). `CaseQueryDto` gained an optional `studentId`
field, scope-checked exactly like every other filter (a caller without access to a given
Case still sees zero rows for that `studentId` — verified by a new e2e test). No migration, no
schema change, no existing endpoint's URL/method/permission changed. Regression: `api:
typecheck` PASS, `api:lint` PASS (0 new warnings), full unit suite 182/182 PASS, full e2e
suite 478/478 PASS (run against the local Docker Postgres, `docker-compose.yml`'s `postgres`
service — never against the production Supabase database in `.env`), plus 3 new e2e
assertions (2 in `case-management.e2e-spec.ts`, 1 in `lead-conversion.e2e-spec.ts`) added
specifically for this change, all passing.

## DEC-10 — Minimal backend fix: `Contract` list+detail now include a display-safe student summary (Phase F04)

**ID**: DEC-10
**Context**: Building the F04 Commercial frontend (Contracts) surfaced the exact same gap
DEC-09 already fixed for Lead/Case, this time on `ContractsService.list()`/`getById()`: both
returned a bare `studentId` foreign key with no included relation, so a Contract list/detail
page could not render which student a contract belongs to without either an N+1 fetch per
row or a forbidden full-table scan of Students (`frontend_prompts/04-commercial-profile/
04_COMMERCIAL_PROFILE_FRONTEND.md` inherits the same "no client-side full-table filtering"
rule F03 already established).
**Options**: identical menu to DEC-09 — (1) frontend-side full-table join, forbidden; (2) a
new dedicated summary endpoint, duplicating `list()`/`getById()`'s existing scope-filtering
logic; (3) minimally extend the two existing endpoints with a `select`-scoped relation.
**Decision**: Option 3, exactly mirroring DEC-09's precedent — a new `STUDENT_SUMMARY_SELECT`
constant in `contracts.service.ts` (`{ id, studentCode, fullName }`, never a bare `include:
{ student: true } }`, which would leak `Student.budget`/`budgetCurrency` regardless of the
caller's own field policy), added to `list()`/`getById()`'s Prisma queries only.
**Reason**: same as DEC-09 — this is a genuine "API bug thật cần sửa để CRM hoạt động," not a
convenience shortcut; the fix is additive (a new nested field on two already-existing
endpoints' response), changes no existing endpoint's URL/method/permission/status code, and
does not duplicate scope-filtering logic the way a new endpoint would.
**Reason (type safety)**: `FieldPolicyService.redactContract` is called on every Contract
response (defense-in-depth financial redaction, unrelated to this fix). Its signature was
non-generic (`redactContract(contract: Contract, roleCode): RedactedContract`), so passing
the new `ContractWithStudent` type through it would have silently widened the return type
back down to plain `Contract`, dropping `.student` from what the frontend sees typed even
though the actual response body still contained it. Made the method generic
(`redactContract<T extends Contract>(...): Omit<T, ...> & Pick<RedactedContract, ...>`) so any
extra fields a caller adds to the query (now, or in a future phase) survive redaction's type
signature — the redaction logic itself is unchanged, still only ever nulls
`value`/`currency`/`approvalThreshold` for the same `FINANCIAL_REDACTED_FOR` role set.
**Impact**: `ContractsService.list()`/`getById()` return `ContractWithStudent` instead of bare
`Contract` (additive type, every other `ContractsService` method — `submit`/`approve`/
`reject`/`send`/`sign`/`updateStatus`/`createAmendment` — is untouched and still returns plain
`Contract`, matching DEC-09's own asymmetric precedent for Case's mutation endpoints). No
migration, no schema change, no existing endpoint's URL/method/permission changed. Regression:
`api:typecheck` PASS (0 errors), plus 1 new e2e assertion in `contracts.e2e-spec.ts` asserting
`GET /contracts`/`GET /contracts/:id` both embed `{id, studentCode, fullName}` and never a
`budget` field. Full unit/e2e suite re-run recorded in `docs/frontend/phase-status/
PHASE_F04.md`.

## DEC-11 — Minimal backend fix: `Program`/`Application`/`UniversityChoice`/`ScholarshipApplication` list+detail now include a display-safe parent-entity summary (Phase F05)

**ID**: DEC-11
**Context**: Building the F05 Admission frontend surfaced the same gap DEC-09/DEC-10 already
fixed twice, now in four places at once: `ProgramsService.list()`/`getById()` returned a bare
`universityId` with no University relation; `ApplicationsService.listForCase()`/`getById()`
returned a bare `programId`; `UniversityChoicesService.listForStudent()`/`getById()` returned a
bare `programId`; `ScholarshipApplicationsService.listForCase()`/`getById()` returned a bare
`scholarshipMasterId`. F05's own instructions (§9/§13/§12/§33) explicitly require these list/
detail views to show "university, program name" / "which scholarship" per row — without an
embed, every row would need its own N+1 fetch, or the frontend would need to pre-fetch and
join the entire University/Program/ScholarshipMaster catalog client-side, both forbidden by
the same "no client-side full-table join" rule DEC-09 established.
**Options**: identical menu to DEC-09/DEC-10 — (1) frontend-side full-catalog join, forbidden;
(2) a new dedicated summary endpoint per relation, duplicating each service's existing scope-
filtering logic four times over; (3) minimally extend the four existing services' `list()`/
`getById()` Prisma queries with a `select`-scoped relation.
**Decision**: Option 3, exactly mirroring DEC-09/DEC-10's precedent, applied four times:
- `programs.service.ts`: new `UNIVERSITY_SUMMARY_SELECT` (`{ id, officialName, countryCode }`)
  + `ProgramWithUniversity` type, added to `list()`/`getById()` (via `findOrThrow`).
- `applications.service.ts`: new `PROGRAM_SUMMARY_SELECT` (`{ id, degreeLevel, major,
  university: { id, officialName, countryCode } }` — a nested two-hop select, since Application
  → Program → University) + `ApplicationWithProgram` type, added to `listForCase()`/`getById()`
  (the latter already had an `include` for `checklist`/`offers`/`scholarshipApplications`;
  `program` was added alongside, not a separate query).
- `university-choices.service.ts`: the identical `PROGRAM_SUMMARY_SELECT` shape (declared
  locally, not imported cross-module — matching the project's existing per-service local-const
  convention for `STUDENT_SUMMARY_SELECT`) + `UniversityChoiceWithProgram` type, added to
  `listForStudent()`/`getById()` (via `findOrThrow`).
- `scholarship-applications.service.ts`: new `SCHOLARSHIP_MASTER_SUMMARY_SELECT` (`{ id,
  scholarshipCode, provider, name, coverageType, amount, percentage, amountCurrency }`) +
  `ScholarshipApplicationWithMaster` type, added to `listForCase()`/`getById()` (via
  `findOrThrow`).
**Reason**: same as DEC-09/DEC-10 — a genuine "API bug thật cần sửa để Admission frontend hoạt
động," not a convenience shortcut; every fix is additive (a new nested field on already-existing
endpoints' responses), changes no existing endpoint's URL/method/permission/status code, and
does not duplicate scope-filtering logic the way four new endpoints would.
**Reason (type safety)**: `FieldPolicyService.redactScholarshipApplication` is called on every
ScholarshipApplication response (defense-in-depth `internalNotes` redaction for
STUDENT_PARENT, unrelated to this fix). Its signature was non-generic, so passing the new
`ScholarshipApplicationWithMaster` type through it would have silently widened the return type
back down to plain `ScholarshipApplication`, dropping `.scholarshipMaster` from what the
frontend sees typed even though the response body still contained it. Made the method generic
(`redactScholarshipApplication<T extends ScholarshipApplication>(...): Omit<T, 'internalNotes'>
& Pick<RedactedScholarshipApplication, 'internalNotes'>`), identical fix shape to DEC-10's
`redactContract` — the redaction logic itself is unchanged, still only ever nulls
`internalNotes` for the same `SCHOLARSHIP_APPLICATION_REDACTED_FOR` role set. University/
Program/UniversityChoice/Application have no `redact*` method at all (confirmed directly
against `field-policy.service.ts` — none of these four entities has ever had field-level
redaction), so no equivalent generic-signature fix was needed for the other three services.
**Impact**: the four services' `list()`/`getById()` (and, for Program/UniversityChoice, the
shared private `findOrThrow()` both call) return the `*With*` types instead of the bare Prisma
model; every other method on each service (create/update/verify for Program; create/update/
submit/updateStatus/transitionToOffer for Application; create/update/review for
UniversityChoice; create/update/confirmEligibility/updateStatus/award/reject for
ScholarshipApplication) is untouched and still returns the plain model, matching DEC-09/DEC-10's
own asymmetric precedent of only widening the read paths, not every mutation response. No
migration, no schema change, no existing endpoint's URL/method/permission changed. Regression:
`api:typecheck` PASS (0 errors), `api:lint` PASS (0 new warnings, same 7 pre-existing baseline),
plus 3 new e2e assertions (`admission-master-data.e2e-spec.ts` for Program→University,
`admission-application.e2e-spec.ts` for UniversityChoice→Program and Application→Program, and
`admission-offer-scholarship.e2e-spec.ts` for ScholarshipApplication→ScholarshipMaster) each
asserting the real embed shape on both list and detail. Full unit/e2e suite re-run recorded in
`docs/frontend/phase-status/PHASE_F05.md`.

## DEC-12 — Minimal backend fix: `Enrollment`/`PartnerProgram`/`PartnerStudentLink`/`CommissionTransaction` list+detail now include display-safe parent-entity summaries (Phase F06)

**ID**: DEC-12
**Context**: Building the F06 Visa/Partner frontend surfaced the same gap DEC-09/10/11 already
fixed six times over, now in four places at once: `EnrollmentsService.listForCase()`/
`getById()` returned bare `universityId`/`programId` with no relations; `PartnerProgramsService
.listForPartner()`/`getById()` returned a bare `partnerId` and an optional bare `programId`;
`PartnerStudentLinksService`'s shared private `paginate()` helper (used by both
`listForPartner()` and `listForStudent()`) plus `getById()`/`findOrThrow()` returned bare
`partnerId`/`studentId`; `CommissionTransactionsService.list()` (covering both the bare global
list and the partner-nested list) plus `getById()`/`findOrThrow()` returned a bare `partnerId`
and nullable `studentId`. F06's own instructions require these list/detail views to show which
University/Program an Enrollment targets, which Partner/Program a PartnerProgram belongs to,
which Partner/Student a PartnerStudentLink connects, and which Partner/Student a
CommissionTransaction is attributed to — without an embed, every row would need its own N+1
fetch or a forbidden full-catalog client-side join, the same rule DEC-09 established.
**Options**: identical menu to DEC-09/10/11 — (1) frontend-side full-catalog join, forbidden;
(2) a new dedicated summary endpoint per relation, duplicating each service's existing scope-
filtering logic four times over; (3) minimally extend the four existing services' list/detail
Prisma queries with a `select`-scoped relation.
**Decision**: Option 3, exactly mirroring DEC-09/10/11's precedent, applied four times at once —
the largest single-phase instance of this fix so far:
- `enrollments.service.ts`: new `UNIVERSITY_SUMMARY_SELECT` (`{ id, officialName, countryCode }`)
  + `PROGRAM_SUMMARY_SELECT` (`{ id, degreeLevel, major }`) + `EnrollmentWithRelations` type,
  added to `listForCase()`/`getById()`/`findOrThrow()`.
- `partner-programs.service.ts`: new `PARTNER_SUMMARY_SELECT` (`{ id, name, countryCode }`) +
  `PROGRAM_SUMMARY_SELECT` (nested one hop further into University, since PartnerProgram →
  Program → University) + `PartnerProgramWithRelations` type, added to `listForPartner()`/
  `getById()`/`findOrThrow()`.
- `partner-student-links.service.ts`: new `PARTNER_SUMMARY_SELECT` + `STUDENT_SUMMARY_SELECT`
  (`{ id, studentCode, fullName }`) + `PartnerStudentLinkWithRelations` type, added to the
  shared private `paginate()` helper (so both `listForPartner()` and `listForStudent()` — two
  independent list contexts reaching the same underlying rows — pick it up from one place) plus
  `findOrThrow()`.
- `commission-transactions.service.ts`: the identical `PARTNER_SUMMARY_SELECT` shape (declared
  locally, matching the project's per-service local-const convention) + a nullable-safe
  `STUDENT_SUMMARY_SELECT` + `CommissionTransactionWithRelations` type, added to `list()`
  (covers both the bare global list and the partner-nested list) plus `getById()`/
  `findOrThrow()`.
**Reason**: same as DEC-09/10/11 — a genuine "API bug thật cần sửa để Visa/Partner frontend hoạt
động," not a convenience shortcut; every fix is additive (a new nested field on already-existing
endpoints' responses), changes no existing endpoint's URL/method/permission/status code, and
does not duplicate scope-filtering logic the way four new endpoints would.
**Reason (type safety)**: `FieldPolicyService.redactEnrollment` is called on every Enrollment
response (defense-in-depth `internalNotes` redaction for STUDENT_PARENT, unrelated to this fix).
Its signature was non-generic, so passing the new `EnrollmentWithRelations` type through it
would have silently widened the return type back down to plain `Enrollment`, dropping
`.university`/`.program` from what the frontend sees typed even though the response body still
contained them. Made the method generic (`redactEnrollment<T extends Enrollment>(...):
Omit<T, 'internalNotes'> & Pick<RedactedEnrollment, 'internalNotes'>`), identical fix shape to
DEC-10's `redactContract`/DEC-11's `redactScholarshipApplication` — the redaction logic itself
is unchanged, still only ever nulls `internalNotes` for the same role set. PartnerProgram/
PartnerStudentLink/CommissionTransaction have no `redact*` method at all (confirmed directly
against `field-policy.service.ts` — none of these three entities has ever had field-level
redaction), so no equivalent generic-signature fix was needed for the other three services.
**Impact**: the four services' list/detail paths (and, for Enrollment/PartnerProgram/
PartnerStudentLink, the shared private helpers they route through) return the `*With*`/
`*WithRelations` types instead of the bare Prisma model; every mutation method on each service
(create/update/confirm/withdraw for Enrollment; create/update for PartnerProgram; create/
update/archive for PartnerStudentLink; create/update-linkage/confirm-eligibility/calculate/
approve/mark-payable/pay/cancel for CommissionTransaction) is untouched and still returns the
plain model, matching DEC-09/10/11's own asymmetric precedent of only widening the read paths,
not every mutation response. No migration, no schema change, no existing endpoint's URL/method/
permission changed. Regression: `api:typecheck` PASS (0 errors), `api:lint` PASS (0 new
warnings, same 7 pre-existing baseline), plus 4 new e2e assertions
(`pre-departure-enrollment-closure.e2e-spec.ts` for Enrollment→University/Program,
`partners.e2e-spec.ts` for PartnerProgram→Partner/Program, PartnerStudentLink→Partner/Student in
both list contexts, and CommissionTransaction→Partner/Student in both list contexts) each
asserting the real embed shape on list and detail, run targeted (`pre-departure-enrollment-
closure`, `partners`, `visa` suites, 84/84 passed) before the full regression re-run — 25 suites,
**488/488 tests passed** (484 baseline + 4 new DEC-12 assertions), recorded in
`docs/frontend/phase-status/PHASE_F06.md`.
