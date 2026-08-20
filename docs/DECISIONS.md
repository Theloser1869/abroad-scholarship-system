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
