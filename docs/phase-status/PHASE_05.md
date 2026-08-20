# PHASE STATUS — PHASE_05 (Commercial)

## status
PASS

## scope
Phase 05A (Contract, `05-commercial/01_CONTRACT.md`) + Phase 05B (Payment,
`05-commercial/02_PAYMENT.md`). Built directly on the Phase 01–04 foundation
(architecture, DB schema, API conventions, auth, RBAC, audit, Lead/Student/Case) — no
rewrite of anything already PASSed except one pre-existing infrastructure defect found and
fixed by this phase's own testing (see DEC-04 below). No Phase 06+ feature (Task business
endpoints, Notification delivery, counseling/admission modules) was implemented.

## implemented

**Contract lifecycle**: full FSM — DRAFT → REVIEW → APPROVED → SENT → SIGNED → ACTIVE →
COMPLETED → LIQUIDATED → ARCHIVED. Every transition has its own dedicated
`ContractsService` method with its own precondition (`submit`/`approve`/`reject`/`send`/
`sign`/`updateStatus`) — never a bare status PATCH; verified directly (a PATCH attempt
while REVIEW returns `409 INVALID_STATUS_TRANSITION`). Monetary-threshold approval (SRS
6.16): `approvalThreshold` is snapshotted from `CONTRACT_APPROVAL_THRESHOLD_AMOUNT` at
`submit()`, and a contract at/above it may only be approved by EXECUTIVE_DIRECTOR even
though DEPARTMENT_MANAGER also holds `contracts:approve` (`assertApproverAllowed`).
Editable only while DRAFT; once signed, the legal artifact (`signedAt`/
`signedDocumentId`) is permanently immutable, and live terms change only via
`ContractAmendment` (before/after snapshot, rejects a no-op change).

**Secure client review link**: `POST /contracts/:id/send` (APPROVED → SENT) issues a
single-purpose, expiring, hashed opaque token (`ContractReviewLink`, same pattern as
password-reset/session-refresh tokens) and returns the raw value exactly once.
`GET /public/contracts/review/:token` is the one deliberately unauthenticated route in
this entire API — same `404 REVIEW_LINK_INVALID` for unknown/expired/revoked (no
enumeration signal), minimal client-safe fields only.

**Case↔Contract linkage completes at signing**: `POST /contracts/:id/sign` (SENT →
SIGNED) requires the Student to already have exactly one active (non-CLOSED/ARCHIVED)
Case and sets `Case.contractId` in the same transaction — never creates a Student or Case
(`docs/ASSUMPTIONS.md` ASM-15, closing the dependency Phase 04 flagged in its own "next
dependency" section). No active Case → `409 NO_ACTIVE_CASE_FOR_STUDENT`, not a
silently-skipped linkage or an auto-created Case.

**Payment schedule + recording**: multiple installments per Contract (`(contractId,
installmentNo)` unique), only once the Contract is signed. `POST /payments/:id/record`
supports partial payment (PARTIALLY_PAID), full payment (PAID), and overpayment only with
an explicit `allowOverpayment: true` (otherwise `409 OVERPAYMENT_NOT_ALLOWED` — no silent
negative/over balance). `isOverdue`/`outstandingAmount` are the two pure functions every
read path funnels through (unit-tested directly, `payments.service.spec.ts`).
`PaymentStatus.OVERDUE` is a real stored status (unlike `TaskStatus`'s display-only
"overdue"), lazily synced from PENDING/PARTIALLY_PAID on read so `status=OVERDUE` queries
stay correct without a scheduled job.

**Refund and waiver**: refund is recorded on the same Payment row (`refundedAmount`/
`refundedAt`/`refundedById`/`refundReason` — the strongest possible "link to the original
payment": identity, not a join; `docs/ASSUMPTIONS.md` ASM-14), supports partial refund,
rejects refunding more than net-paid (`409 REFUND_EXCEEDS_NET_PAID`). Waiver requires a
mandatory `reason` and is audited; rejected on an already-resolved payment (`409
PAYMENT_ALREADY_RESOLVED`).

**Duplicate-transaction protection**: two independent, complementary layers — a client
`Idempotency-Key` on `record`/`refund`/`POST /contracts` (a retried request with the same
key+body replays the stored response, does not double-apply) and a DB-level `reference`
uniqueness check (`409 DUPLICATE_PAYMENT_REFERENCE` if the same non-null external
reference is reused across two different payments).

**One real defect found and fixed** during this phase's own testing (not left as a known
issue) — full write-up `docs/DECISIONS.md` DEC-04: `IdempotencyInterceptor` stored the
raw response object (with live `Prisma.Decimal` fields) directly into a Prisma `Json`
column; Prisma's own wire serialization turned `Decimal` into a JSON number there, while
the original HTTP response had sent it as a string (via `Decimal.toJSON()`). A replayed
idempotent response for any money-bearing endpoint would silently differ in field type
from the original. Fixed by round-tripping the body through
`JSON.parse(JSON.stringify(body))` before persisting.

## files read
- `05-commercial/01_CONTRACT.md`, `05-commercial/02_PAYMENT.md`
- Phase 01–04 documentation/checkpoints already in this session's context:
  `docs/architecture/*`, `docs/database/{ERD,DATA_DICTIONARY}.md`,
  `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,RBAC_MATRIX}.md`,
  `docs/phase-status/{01-discovery,PHASE_02,PHASE_03,PHASE_04}.md`,
  `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `database/schema.prisma`,
  `apps/api/src/**` (existing code)

## files created/updated
Database: `database/schema.prisma` (`Contract.mergeFieldValues/approvalThreshold/
submittedAt/sentAt/activatedAt/completedAt/liquidatedAt`, new `ContractReviewLink` model,
`ContractAmendment.before/after`, `Payment.reference/receiptDocumentId/refundedAmount/
refundedAt/refundedById/refundReason/waivedAt/waivedById/waivedReason`), 1 new migration
(`20260818134757_commercial_contract_payment_phase05`), `database/seeds/seed.ts`
(`contracts:*`/`payments:*` permission matrix + per-role grants, Contract/Payment RBAC
fixtures `HD-2026-90001`/`PAY-2026-90001`/`PAY-2026-90002`), `.env`/`.env.example`
(`CONTRACT_APPROVAL_THRESHOLD_AMOUNT`, `CONTRACT_REVIEW_LINK_TTL_HOURS`).

API (`apps/api/src/`):
- `modules/commercial/**` (new domain) — `commercial.module.ts`;
  `contracts/{contracts.controller,contracts.service,contract-templates.controller,
  contract-templates.service,public-contract-review.controller,contracts.module,dto/*}.ts`;
  `payments/{payments.controller,contract-payments.controller,payments.service,
  payments.service.spec,payments.module,dto/*}.ts`
- `modules/identity/rbac/scope-policy.service.ts` (+ spec — `CONTRACT_ROLE_SCOPE`,
  `contractScopeKindFor`/`contractListFilter`/`assertContractAccessible`/
  `assertPaymentAccessible`)
- `modules/identity/rbac/field-policy.service.ts` (+ spec — `redactContract`/
  `redactPayment`, `RedactedContract`/`RedactedPayment` types)
- `common/idempotency/idempotency.interceptor.ts` (DEC-04 fix)
- `app.module.ts` (registers `CommercialModule`)

Tests (`apps/api/test/`): `contracts.e2e-spec.ts` (33 tests), `payments.e2e-spec.ts` (31
tests), `helpers/create-student-case.ts` (new shared helper — Lead-conversion walk to get
a real Student+Case pair, since Contract/Case creation both require an existing one).

Docs: `docs/security/RBAC_MATRIX.md` (contracts/payments resource columns, third
`CONTRACT_ROLE_SCOPE` scope map, new SEND/SIGN/AMEND/RECORD/REFUND/WAIVE actions,
Contract/Payment field-level rows, RBAC fixture description), `docs/ASSUMPTIONS.md`
(ASM-13 through ASM-15), `docs/DECISIONS.md` (DEC-04), `docs/database/{ERD,
DATA_DICTIONARY}.md` (Phase 05 fields/tables), `docs/api/API_CONVENTIONS.md` (new
endpoints, idempotency round-trip fix), this file.

## CONTRACT
Fields match `05-commercial/01_CONTRACT.md` exactly — `mergeFieldValues` (the resolved
values for a `ContractTemplate`'s field schema), `approvalThreshold` (snapshotted, not
re-derived live), full lifecycle timestamps (`submittedAt`/`sentAt`/`signedAt`/
`activatedAt`/`completedAt`/`liquidatedAt`/`archivedAt`). Status FSM enforced
server-side; SIGNED is permanently immutable for the legal artifact fields, ACTIVE onward
via the generic post-sign `updateStatus`. Amendment (`ContractAmendment`) is the only path
to change terms after signing — `before`/`after` JSON snapshot, version bump, rejects a
no-op change (`NO_MATERIAL_CHANGE`).

## PAYMENT
Fields match `05-commercial/02_PAYMENT.md` exactly — installment schedule
(`installmentNo`/`amount`/`currency`/`dueDate`), recording (`paidAmount`/`paidDate`/
`method`/`reference`), refund (`refundedAmount`/`refundedAt`/`refundedById`/
`refundReason`), waiver (`waivedAt`/`waivedById`/`waivedReason`), `status` (Pending/
PartiallyPaid/Paid/Overdue/Refunded/Waived). `outstandingAmount` (computed, never
negative) and `isOverdue` (computed, consistent everywhere) are attached to every response
via `PaymentsService.withComputed`, backed by the two pure functions unit-tested directly.

## WORKFLOW / STATUS
Contract's FSM (`ContractsService`'s `submit`/`approve`/`reject`/`send`/`sign` +
`POST_SIGN_TRANSITIONS` map) mirrors the pattern established for Lead/Case in Phase 04:
the terminal/high-consequence states are reachable only through their own dedicated
method, never a generic status PATCH — verified directly (`409
INVALID_STATUS_TRANSITION` on a bypass attempt).

## IMMUTABILITY / AMENDMENT
Once `signedAt` is set, `ContractsService.update()` is permanently rejected (`409
INVALID_CONTRACT_STATE`) regardless of caller role — verified directly with an
EXECUTIVE_DIRECTOR token, not just a lower-privileged one, to prove this isn't a
permission gap masquerading as immutability. `createAmendment` is the only mutation path
past that point, and only when something actually differs from current values.

## RBAC / AUTHORIZATION
New `ScopeKind` map `CONTRACT_ROLE_SCOPE`, tracked separately from `ROLE_SCOPE` (Student/
Case) and `LEAD_ROLE_SCOPE` — the same role can and does carry a third, different scope
value for Contract/Payment (CONSULTANT/DOCUMENT_SPECIALIST: CASE_MEMBER on Student/Case
but NONE on Contract/Payment; ADMIN_FINANCE: NONE on Student/Case but GLOBAL on Contract/
Payment). Verified directly: `demo.consultant.a`, a member (OWNER) of the Case linked to
the seed fixture Contract, still gets `403 PERMISSION_DENIED` reading that Contract —
Contract/Payment access does not follow from Case access, proven with an actual case
member, not just an unrelated role. `ScopePolicyService.assertPaymentAccessible` resolves
scope one hop further than Contract (through `payment.contract.student`), since Payment
carries no `studentId`/`ownerId` of its own. Full grant table updated per the
separation-of-duties design (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER: full `contracts:*`
oversight, `payments:view/export` only; ADMIN_FINANCE: `contracts:*` minus approve/amend,
full `payments:*` execution; STUDENT_PARENT: view-only both, OWN_STUDENT-scoped), seeded
via the DEC-02 grant-and-prune sync.

## FIELD-LEVEL PROTECTION
`FieldPolicyService.redactContract`/`redactPayment` — Contract value/currency/
approvalThreshold and Payment amount/currency/paidAmount/refundedAmount nulled for
CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/SYSTEM_ADMIN. Deliberately a defense-in-depth
*second* layer — `CONTRACT_ROLE_SCOPE` already gives all four of these roles `NONE` scope,
so in practice a record is 403'd before ever reaching redaction; tested directly at the
unit level anyway (`field-policy.service.spec.ts`), same pattern already used for
`redactStudent`'s Budget field.

## AUDIT
Every mutating Contract/Payment route is `@Audit`-decorated (CREATE/EDIT/APPROVE/SHARE/
EXPORT/VIEW as appropriate — `send()` audited as SHARE, matching SRS's verb for
dispatching an externally-reachable artifact). Verified directly: VIEW rows for reading a
Contract/Payment, EDIT row for a waive action, EXPORT rows carrying `reason`/`rowCount`/
`fields` metadata (SRS 6.21) for both `/contracts/export` and `/payments/export`.

## database changes
1 new migration on top of Phase 01–04's 8: additive only (`ADD COLUMN`/`CREATE TABLE`/
`CREATE INDEX`, no destructive changes) — confirmed by inspecting the generated SQL before
applying. No entity renamed, merged, or duplicated.

## migrations
1. `20260818134757_commercial_contract_payment_phase05` — Contract/ContractAmendment/
   Payment column additions, new `contract_review_links` table.

Applied via `prisma migrate diff` (script) + a hand-created migration folder +
`prisma migrate deploy`, the same non-interactive pattern established in Phase 02/03
(`prisma migrate dev` requires an interactive confirmation this environment cannot
answer) — no manual schema edits, no `db push` used for anything that shipped.

## API changes
See `docs/api/API_CONVENTIONS.md` section 11 for the full list. Summary: 13 new
`/contracts*` routes (list/detail/create/edit/submit/approve/reject/send/sign/status/
amendments/export), 1 public unauthenticated route (`/public/contracts/review/:token`), 3
new `/contract-templates` routes, 5 new `/payments/:id/*` routes, 2 new
`/contracts/:contractId/payments` routes.

## UI changes
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged this phase). `01_CONTRACT.md`/`02_PAYMENT.md`'s UI
requirements (contract list/detail/approval queue, payment schedule/recording screens) are
satisfied as API capabilities a UI would call, consistent with the same reasoning already
applied in Phase 03/04.

## TESTS
- Unit: +3 spec files/additions this phase (`ScopePolicyService` Contract/Payment-scope
  additions, `FieldPolicyService` redactContract/redactPayment additions, new
  `PaymentsService` — `isOverdue`/`outstandingAmount`/`withComputed`) — 149/149 total (up
  from 100 at the end of Phase 04). Contract/Payment business-logic services
  (`ContractsService`/`PaymentsService`'s workflow/calculation methods) are covered by
  e2e, not a separate mocked-Prisma unit spec — consistent with how Lead/Student/Case's
  equivalent services were tested in Phase 04 (no `*.service.spec.ts` exists for those
  either; only the stateless RBAC-policy and pure-calculation layers get unit specs in
  this codebase).
- Integration/e2e: 2 new suites (`contracts.e2e-spec.ts` 33 tests, `payments.e2e-spec.ts`
  31 tests) — 141/141 total across all 8 suites (up from 77), full suite run clean.

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate deploy` applied cleanly; schema additive-only,
  confirmed via the generated SQL before applying.
- **Seed**: PASS — `npm run db:seed` completes; grant/prune verified (contracts/payments
  permissions correctly scoped per role, including the ADMIN_FINANCE minus-approve/amend
  and DEPARTMENT_MANAGER/EXECUTIVE_DIRECTOR minus-payment-execution splits).
- **Unit Tests**: PASS — 149/149.
- **Integration Tests**: PASS — 141/141 (part of the same e2e run; this project's tooling
  doesn't separate "integration" from "e2e" — see `docs/PROJECT_STRUCTURE.md`).
- **E2E Tests**: PASS — 141/141, 8 suites.
- **RBAC Tests**: PASS — Contract/Payment GLOBAL/OWN_STUDENT/NONE ALLOW/DENY including the
  CONSULTANT-is-a-Case-member-but-still-denied proof, monetary-threshold
  approver-narrowing (`contracts.e2e-spec.ts`), execution-vs-oversight split
  (DEPARTMENT_MANAGER denied `record`, `payments.e2e-spec.ts`).
- **Workflow Tests**: PASS — full DRAFT→...→SIGNED walk, illegal direct-status-PATCH
  bypass rejected, reject-returns-to-DRAFT with an `Approval(REJECTED)` row recorded.
- **Immutability Tests**: PASS — post-sign `update()` rejected regardless of role.
- **Amendment Tests**: PASS — before/after snapshot, version bump, no-op rejected,
  pre-signing amendment attempt rejected, `contracts:amend` permission enforced.
- **Payment Calculation Tests**: PASS — `isOverdue`/`outstandingAmount`/`withComputed`
  unit-tested directly (13 cases) plus exercised end-to-end.
- **Partial Payment Tests**: PASS — PARTIALLY_PAID → PAID walk, outstanding balance
  tracked correctly at each step.
- **Duplicate-Transaction Tests**: PASS — Idempotency-Key replay does not double-count
  `paidAmount` (verified against the DB row directly, not just the HTTP response); shared
  `reference` across two payments rejected.
- **Refund Tests**: PASS — partial refund, full refund (status → REFUNDED),
  over-refund-attempt rejected.
- **Waive Tests**: PASS — reason mandatory (400 without it), audited, rejected on an
  already-resolved payment.
- **Overdue Tests**: PASS — fixed-due-date seed fixture confirms `isOverdue`/lazy
  `status=OVERDUE` sync, resolved payments never report overdue, list filters by both
  `overdue=true` and `status=OVERDUE`.
- **Field-Level Tests**: PASS — Contract/Payment financial fields redacted for the four
  designated roles (unit level); scope layer already 403s/404s those same roles before a
  record is reached (e2e level) — both layers verified independently.
- **Cross-Case Tests**: PASS — a payment created under one signed Contract does not appear
  in another Contract's payment list.
- **Download/Export-Auth Tests**: PASS — `/contracts/export` and `/payments/export` both
  require a `reason` (400 without it), are role-gated (STUDENT_PARENT denied), and are
  audited with `reason`/`rowCount`/`fields` metadata.
- **Audit Tests**: PASS — VIEW/EDIT/EXPORT rows verified directly against the database for
  Contract and Payment actions.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock, unchanged from Phase 03/04).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.
- **Regression (Phase 04)**: PASS — the full prior suite (100 unit + 77 e2e: Lead/Student/
  Case/CaseMember/cross-case-isolation/audit) still passes unmodified, run as part of the
  same full-suite executions above (149/141 totals include every Phase 01–04 test
  unchanged).

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
3 new (ASM-13 through ASM-15), full text in `docs/ASSUMPTIONS.md`:
- **ASM-13**: `Payment` (Student-owed money) is a strictly separate concept from Partner
  Commission (Phase 10) — no commission math lives here.
- **ASM-14**: Refund is recorded on the same `Payment` row, not a separate transaction
  ledger row — the strongest possible link to the original payment.
- **ASM-15**: Case↔Contract linkage completes at `sign()`, not at Contract creation —
  closes the dependency Phase 04's own "next dependency" section flagged.

1 new architecture/decision record (DEC-04) in `docs/DECISIONS.md` — the
`IdempotencyInterceptor` Decimal-serialization defect found and fixed during this phase's
own testing.

## RISKS
- No commission/partner-payout entity exists yet (Phase 10) — `Payment` deliberately does
  not attempt to anticipate that shape (ASM-13); Phase 10 will need its own entity, not a
  retrofit of this one.
- `Payment` has no full transaction ledger — only the latest cumulative `paidAmount`/
  `refundedAmount` per installment, not a row-per-transaction history (ASM-14). If a
  future phase needs a full audit trail of every individual payment/refund event beyond
  what `AuditLog` already captures, that's a new entity, not a retrofit.
- `ContractsService.sign()` assumes a Student has at most one Case eligible to receive a
  Contract at sign time; a Student with two simultaneously-active Cases will get whichever
  one `findFirst` returns, or `CASE_ALREADY_LINKED` if that Case already has a different
  Contract — SRS gives no rule for this scenario, flagged for whoever encounters it.
- The public contract-review link (`ContractReviewLink`) has no rate-limiting beyond the
  token's own unguessability + TTL — acceptable for this phase (no rate-limiting
  infrastructure exists anywhere else in the API either), but worth revisiting if
  `12-platform` adds a general rate-limiting layer.

## KNOWN ISSUES
- **Fixed during this phase, not left outstanding** (see DEC-04 for full detail): the
  `IdempotencyInterceptor` Decimal-serialization bug. Pre-existing (Phase 02) defect
  surfaced by Phase 05's own integration tests, root-caused, fixed, and re-verified by the
  full regression suite (149 unit + 141 e2e).
- Carried over from Phase 02/03/04, still accurate and unaffected by this phase: the
  `deepmerge-ts` dev-only `npm audit` advisories, the `eslint-visitor-keys` `EBADENGINE`
  warning, and the `otplib` 12.0.1 pin. No new instances of the "wrong-cwd ts-jest"
  pitfall were hit this phase — all commands were run via the `npm run api:*` workspace
  scripts as documented.

## next dependency (for Phase 06)
- `Task` business endpoints (assignment, KPI derivation) are still Phase 06 scope —
  untouched here; `Task`/`TaskDependency` schema already exists from Phase 02.
- Notification *delivery* (the `Notification` table exists, Phase 02, but nothing sends
  through `NotificationChannel` yet) is Phase 06+ scope.
- `docs/security/RBAC_MATRIX.md` section 2's grant table is the pattern to extend for
  whatever resource(s) Phase 06 introduces — follow the same grant-and-prune seed
  discipline (DEC-02).
- Contract/Payment's `CONTRACT_ROLE_SCOPE` pattern (a resource-specific scope map,
  separate from `ROLE_SCOPE`/`LEAD_ROLE_SCOPE`) is the template if a future phase's
  resource needs yet another distinct per-role scope.

READY FOR PHASE 06: YES

Không tự chuyển sang Phase 06. Chờ prompt tiếp theo.
