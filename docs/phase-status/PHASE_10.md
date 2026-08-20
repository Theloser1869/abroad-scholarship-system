# PHASE STATUS — PHASE_10 (Partner CRM + Commission)

## status
PASS

## scope
`10-partners/01_PARTNER_CRM.md` — Partner, PartnerProgram, PartnerDocument,
PartnerStudentLink, CommissionRule, CommissionTransaction. Built directly on the Phase
01-09 foundation (architecture, DB schema, API conventions, auth, RBAC, audit, Lead/
Student/Case, Contract/Payment, Task Engine + Notification Engine, Counseling/Profile
Evidence/Writing, Documents module, Admission domain, Visa domain) — no rewrite of
anything already PASSed. Partner/PartnerProgram/PartnerDocument were foundation-slice
entities (schema-only since Phase 02, never wired to a real service) and got their first
real controller/service/workflow this phase, the same "schema waited, this phase builds
it" pattern Phase 07 established for Documents and Phase 08 established for Admission.
PartnerStudentLink/CommissionRule/CommissionTransaction are entirely new this phase. No
Phase 11+ feature (real Commission adjustment/reversal, automatic Payment-triggered
generation, a dedicated Partner-facing portal) was implemented.

## implemented

**Partner**: name/type/country/contacts (name/email/phone)/owner/website/status/internal
notes all present. GLOBAL, permission-gated master/business data — same treatment as
University/Program (Phase 08) and VisaChecklistTemplate (Phase 09), no per-record scope
check. Duplicate prevention: service-layer check on (name, countryCode), case-insensitive,
`409 DUPLICATE_PARTNER`. Never referenced by name as a foreign key anywhere — every child
entity below links via `partnerId`. `contactPhone`/`internalNotes` are Phase 10 additions
completing the Phase 02 shape (`docs/ASSUMPTIONS.md` ASM-40).

**PartnerProgram**: degree/major/intake/tuition/scholarship/admission rules all present,
always created under an existing Partner (nested route), never standalone. Duplicate
prevention on (partnerId, name, degreeLevel, major, intake). `programId` is an OPTIONAL,
one-directional FK into the existing Admission-domain `Program` — set when a partner
program genuinely corresponds to a catalog row, left null when it's purely the partner's
own commercial mapping; resolves `docs/architecture/DOMAIN_MAP.md` domain 8's own
long-standing noted gap without touching Phase 08's already-PASSed `Program` model beyond
a back-relation array (`docs/ASSUMPTIONS.md` ASM-41).

**PartnerDocument**: MOU/Agreement/Commission Agreement/Rate Sheet all supported, reuses
the existing Document subsystem — `documentId` is a real FK (same ASM-24 precedent as every
Phase 07-09 evidence field), no PartnerFile/PartnerStorage entity anywhere. Versioning
(`(partnerId, type, version)` unique, auto-incremented), effective/expiry dates, status
(DRAFT/ACTIVE/EXPIRED/SUPERSEDED/ARCHIVED), owner, and Document-grant-based access scope
all present. Legal/commercial documents are immutable once ACTIVE — a generic `PATCH` is
rejected once status leaves DRAFT (`409 PARTNER_DOCUMENT_NOT_EDITABLE`), "Không overwrite
signed/final partner documents"; a correction is always a brand-new PartnerDocument row,
never an in-place edit. `activate()` atomically marks the prior ACTIVE row for the same
(partner, type) SUPERSEDED. An ACTIVE row past `expiryDate` is lazily synced to EXPIRED on
read, the same sweep pattern as `Offer.status`/`Payment.status`. Download/share is
authorized server-side via the existing `DocumentsService.assertAccessible` grant check,
extended this phase with a new `grantRoleAccess` method for Partner-domain's
GLOBAL/permission-gated access model (`docs/ASSUMPTIONS.md` ASM-42).

**Partner ↔ Student/Case (PartnerStudentLink)**: implemented as a pure junction table
(SRS 6.17 "liên kết nhiều student/case/application bằng bảng trung gian") — links Partner +
Student + optional Case/Application, all by real FK, every FK validated against its owning
table at write time, never a copied student/partner/application name. Link creation,
removal/archive, role/type (free text — Referral/Agent/Sponsor/... — never a hard-coded
enum), effective dates, and audit all present. "At most one ACTIVE link per exact
(partner, student, case, application) tuple" is a service-layer check
(`409 DUPLICATE_PARTNER_STUDENT_LINK`); archiving frees the combination for a fresh link
without ever hard-deleting history. A Student can carry links to many different Partners; a
Partner can carry links to many Students/Cases/Applications — this row is never expanded
into a duplicate Case/Application entity.

**Partner ↔ Application/Program**: PartnerStudentLink's optional `applicationId` and
PartnerProgram's optional `programId` both reference the EXISTING Application/Program
tables by FK only — never copying Application/Program data onto either row. Every
relationship is queried live from its source of truth, never denormalized.

**CommissionRule**: fully separate from `CommissionTransaction` (config vs. fact) and from
`Payment`/`Contract.value`/`ScholarshipApplication.awardAmount` — no shared FK/column with
any of the three anywhere (Hard Rule "Commission phải tách khỏi student payment"). Supports
basis (CONTRACT_VALUE/PAYMENT_COLLECTED/FIXED), rate (a fraction, e.g. 0.10 = 10%) or fixed
amount (exactly one, cross-validated server-side), explicit currency, conditions
(free text), effective/expiry date, partner/partner-program scoping, and status. All
monetary fields are `Decimal`, never floating point. When multiple ACTIVE rules could match
the same transaction, precedence is fully deterministic
(`CommissionRulesService.selectRuleFor`): a PartnerProgram-specific rule beats a
partner-wide one, then higher `priority` wins, then most-recently-created, then `id` — never
random. Documented as an assumption since no business rule specified this
(`docs/ASSUMPTIONS.md` ASM-44).

**CommissionTransaction**: records source (Contract or Payment, polymorphic `sourceType`/
`sourceId`), partner, student/case/application (nullable convenience FKs, derived from the
source when resolvable), rule/reference, basis, calculated amount, currency, status, paid
date, payment reference, and reason/notes — every field the instruction names. Never
overwrites historical rows: PAID and CANCELLED are both hard-terminal, no direct edit
reachable once either is reached. No adjustment/reversal mechanism was built — the SRS
never names one, and the instruction explicitly says not to invent one out of scope;
documented as `docs/ASSUMPTIONS.md` ASM-45 plus a corresponding RISK below. A corrected
re-attempt after a cancellation is never blocked (the duplicate check excludes CANCELLED
rows).

**Commission calculation**: source amount is unambiguous per basis — `Contract.value` for
CONTRACT_VALUE, `Payment.paidAmount` for PAYMENT_COLLECTED (the existing Payment source of
truth, never a duplicate outstanding/paid calculation), nothing for FIXED. Calculation is
fully deterministic and backend-only: `calculate()` re-fetches the matched CommissionRule
fresh, reads the live source amount, and computes `basisAmount.times(rate)` (or
`fixedAmount` directly) via `Prisma.Decimal` arithmetic exclusively —
`.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)` — never a JS-float `Number()`
round-trip. The client never supplies a final amount at any point in the flow. A currency
mismatch between the matched rule and the live source is rejected `409 CURRENCY_MISMATCH`,
never silently converted.

**Commission lifecycle**: server-side FSM taken verbatim from the orchestration prompt's
own example status list (the only one given anywhere) — PENDING → ELIGIBLE → CALCULATED →
APPROVED → PAYABLE → PAID, with CANCELLED reachable from any non-terminal state and a
required reason. Every forward transition is its own dedicated, precondition-gated action
(`confirm-eligibility`/`calculate`/`approve`/`mark-payable`/`pay`) — the client never
supplies a bare status. Re-calculating while still ELIGIBLE is a safe, idempotent recompute
(a pure function of current rule+source state), not an accumulation.

**Partner Document + Commission security**: RBAC verified for all 8 roles. ED/DM: full on
all six resources. ADMIN_FINANCE: full `view/create/edit` on `commission_rules`/
`commission_transactions` ("Finance/Admin phải có quyền commission/settlement phù hợp" —
mirrors its Contract/Payment execution grant), view-only on the other four. CONSULTANT:
zero on all six ("không mặc định được xem commission/partner commercial terms").
SALES_MARKETING: zero on all six ("không mặc định có quyền xem commission amount").
DOCUMENT_SPECIALIST: view-only on `partner` + `partner_documents` only ("chỉ xem partner
documents theo scope"). STUDENT_PARENT: zero on all six ("không được xem commission,"
extended to the whole domain — none of it is the student's own data). Every user without
any grant on a resource is denied (`403`) server-side, not just hidden in a UI.
`Partner.internalNotes` is field-level redacted from DOCUMENT_SPECIALIST — the one granted
role without full commercial visibility.

**Partner master permission**: six distinct permission resources
(`partner`/`partner_programs`/`partner_documents`/`partner_student_links`/
`commission_rules`/`commission_transactions`), never one broad `PARTNER_*` permission —
"Không dùng một permission tổng PARTNER_* cho mọi hành động." Documented in full as
`docs/ASSUMPTIONS.md` ASM-43.

**No production defect found this phase** — unlike Phase 04's DEC-03, Phase 05's DEC-04, or
Phase 08's DEC-05, no conflict between an already-PASSed decision and this phase's
instructions was discovered. `PartnerDocument`'s `fileReference` → `documentId` rebuild is
completing unused schema (zero rows, confirmed by row-count check, no service had ever been
built against it), the same class of change as Phase 09's `category` addition, not a
requirements conflict — no new `docs/DECISIONS.md` entry was needed this phase.

## files read
- `10-partners/01_PARTNER_CRM.md`
- Phase 01-09 documentation/checkpoints already in this session's context:
  `docs/architecture/{DOMAIN_MAP,TARGET_ARCHITECTURE,DECISIONS}.md`, `docs/database/{ERD,
  DATA_DICTIONARY}.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,
  RBAC_MATRIX}.md`, `docs/phase-status/{01-discovery,PHASE_02...PHASE_09}.md`,
  `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PHASE_MAP.md`,
  `database/schema.prisma`, `apps/api/src/**` (existing code, especially the Phase 04 Case
  service, Phase 05 Contract/Payment services, Phase 06 Task/Notification engines, Phase 07
  Documents module, and Phase 08/09 Admission/Visa services as direct reuse and
  integration-pattern targets)

## files created/updated
Database: `database/schema.prisma` (`Partner` +contactPhone/internalNotes; `PartnerProgram`
+programId; `PartnerDocument` rebuilt — `fileReference` removed, +status/documentId/
ownerId; new `PartnerDocumentStatus`/`PartnerLinkStatus`/`CommissionBasis`/
`CommissionTransactionStatus` enums; new `PartnerStudentLink`/`CommissionRule`/
`CommissionTransaction` models; `Student`/`Case`/`Application`/`Program`/`Document`
back-relations), 1 new migration (`20260819110000_partner_crm_commission_phase10` — fully
additive except the one documented, zero-row `file_reference` column drop),
`database/seeds/seed.ts` (18 new permission rows + per-role grants for all six Phase 10
resources; Partner fixtures — partnerA, partnerProgramA (linked to the real programA),
a fixture Document + PartnerDocument (ACTIVE, MOU), a PartnerStudentLink (ACTIVE), a
CommissionRule (CONTRACT_VALUE, 10%), a CommissionTransaction (PENDING, sourced from the
existing Contract fixture)).

API (`apps/api/src/modules/partners/`, new domain):
- `partners.module.ts`
- `partner-master/{dto,partners.service,partners.controller,partners.module}.ts`
- `partner-programs/{dto,partner-programs.service,partner-programs.controller,
  partner-programs.module}.ts`
- `partner-documents/{dto,partner-documents.service,partner-documents.controller,
  partner-documents.module}.ts`
- `partner-student-links/{dto,partner-student-links.service,
  partner-student-links.controller,partner-student-links.module}.ts`
- `commission-rules/{dto,commission-rules.service,commission-rules.controller,
  commission-rules.module}.ts`
- `commission-transactions/{dto,commission-transactions.service,
  commission-transactions.controller,commission-transactions.module}.ts`
- `modules/identity/rbac/field-policy.service.ts` (+ `redactPartner`)
- `modules/documents/documents/documents.service.ts` (+ `grantRoleAccess`)
- `app.module.ts` (registers PartnersModule)

Tests (`apps/api/test/`): `partners.e2e-spec.ts` (37 new tests — Partner/PartnerProgram/
PartnerDocument/PartnerStudentLink/CommissionRule/CommissionTransaction RBAC, duplicate
detection, versioning/immutability, deterministic precedence, full FSM lifecycle, Decimal
precision, currency mismatch, idempotency, audit).

Docs: `docs/security/RBAC_MATRIX.md` (6 new permission columns, record-scope note on
Partner's deliberate no-ScopeKind design, Actions-table VIEW/CREATE/EDIT row extensions,
2 new field-level protection rows, allow/deny fixture description, section 7 deferral
updates), `docs/database/{ERD,DATA_DICTIONARY}.md` (Partners domain fully expanded — ERD
section 8, DATA_DICTIONARY section 4.16, no renumbering needed since Partner already had a
reserved section), `docs/api/API_CONVENTIONS.md` (section 11 — all new Phase 10
endpoints), `docs/ASSUMPTIONS.md` (ASM-40 through ASM-45), this file. No new
`docs/DECISIONS.md` entry — see "No production defect found this phase" above.

## PARTNER
Name/type/country/contacts/owner/website/status all present. Verified directly: duplicate
(name, country) rejected `409`; `internalNotes` redacted for DOCUMENT_SPECIALIST, visible
in full for ED/DM/ADMIN_FINANCE; CONSULTANT/SALES_MARKETING/STUDENT_PARENT get `403` on
every route; archive is a dedicated action (own ARCHIVE audit verb) setting status
INACTIVE, no hard-delete.

## PARTNER PROGRAM
Degree/major/intake/tuition/scholarship/admission rules all present, real FK to Partner.
Verified directly: duplicate (name, degree, major, intake) under the same partner rejected
`409`; an invalid `programId` rejected `404 PROGRAM_NOT_FOUND` (never creates a duplicate
Program); the fixture PartnerProgram's link to the real Program master row confirmed intact
(no duplicate University/Program created anywhere in the whole test suite).

## PARTNER DOCUMENT
MOU/Agreement/Commission Agreement/Rate Sheet all present, real FK into Document. Verified
directly: creating a PartnerDocument reuses an existing Document (no PartnerFile/
PartnerStorage entity anywhere in the schema); `activate()` supersedes the prior ACTIVE
version atomically; a PATCH on an ACTIVE document is rejected `409
PARTNER_DOCUMENT_NOT_EDITABLE`; archive is terminal; SALES_MARKETING denied `403`,
DOCUMENT_SPECIALIST allowed to view.

## PARTNER STUDENT LINK
Link creation/removal/role/effective-dates/scope/audit all present, real FKs throughout.
Verified directly: a Case belonging to a different Student is rejected `404`; a duplicate
ACTIVE (partner, student, case, application) tuple is rejected `409
DUPLICATE_PARTNER_STUDENT_LINK`; archiving frees the tuple for a new link; visible from
both the Partner side and the Student side (`GET /students/:id/partner-links`);
ADMIN_FINANCE can view but not create (view-only, relationship management is not its
domain).

## COMMISSION RULE
Basis/rate/fixed-amount/currency/conditions/effective-date/partner/partner-program/status
all present, Decimal-only monetary fields. Verified directly: `FIXED` basis without
`fixedAmount` rejected `400 FIXED_AMOUNT_REQUIRED`; a percentage basis with `fixedAmount`
also set rejected `400 PERCENTAGE_RATE_NOT_ALLOWED`; negative amounts rejected `400`; a
zero amount accepted (legitimate promotional rule); a PartnerProgram-scoped rule with lower
`priority` still outranks a partner-wide rule with higher `priority` (specificity checked
before priority) — deterministic, never random.

## COMMISSION CALCULATION
Verified directly: `CONTRACT_VALUE` reads `Contract.value` live; `PAYMENT_COLLECTED` reads
`Payment.paidAmount` live (never a duplicate outstanding/paid calculation); a currency
mismatch between the matched rule and the live source is rejected `409 CURRENCY_MISMATCH`;
`1234.56 × 0.1055` rounds to exactly `130.25` (ROUND_HALF_UP, Decimal-only, verified via
the actual HTTP response body, not a unit-level mock); the client-supplied body never
contains a `calculatedAmount` field the backend trusts.

## COMMISSION TRANSACTION
Source/partner/student-case-application/rule-reference/basis/amount/currency/status/
paid-date/reference/reason all present. Verified directly: full FSM walk PENDING→
ELIGIBLE→CALCULATED→APPROVED→PAYABLE→PAID succeeds; an illegal jump (PENDING straight to
`calculate`) rejected `409 INVALID_COMMISSION_TRANSACTION_STATE`; PAID is terminal — a
further `PATCH` rejected `409 COMMISSION_TRANSACTION_NOT_EDITABLE`, a further `cancel`
rejected `409 COMMISSION_TRANSACTION_CLOSED`; cancel reachable from a non-terminal state
with a required reason.

## COMMISSION WORKFLOW
Verified directly: every transition is its own dedicated action, never a bare status
PATCH; re-`calculate`-ing twice while ELIGIBLE only succeeds the first time (`409` on the
second, since the row has already moved to CALCULATED) — a safe recompute, not an
accumulation; a repeat `POST .../commission-transactions` for the same (source, rule) is
rejected `409 DUPLICATE_COMMISSION_TRANSACTION` — idempotency against retry.

## MONETARY PRECISION
Verified directly: every commission amount computed via `Prisma.Decimal` arithmetic
(`.times()`/`.toDecimalPlaces(2, ROUND_HALF_UP)`), confirmed rounding correctly on a
non-trivial input (`1234.56 × 0.1055 → 130.25`, not `130.24`/`130.246`); `PAYMENT_COLLECTED`
basis exactly matches the real recorded `Payment.paidAmount` (`300 × 0.2 = 60`, verified
byte-for-byte against the HTTP response); no JS-float `Number()` round-trip anywhere in the
Phase 10 calculation path.

## CURRENCY
Verified directly: `CommissionRule.currency` is required and ISO-4217-validated at the DTO
layer; a rule/source currency mismatch at `calculate()` time is rejected `409
CURRENCY_MISMATCH`, never silently converted; `FIXED`-basis rules carry their own currency
with no source to compare against.

## RBAC / AUTHORIZATION
Every Phase 10 resource is GLOBAL/permission-gated with no `ScopeKind` check — a deliberate
departure from every other Phase 04-09 domain, verified directly: ED/DM/ADMIN_FINANCE
ALLOW per the matrix above, CONSULTANT/SALES_MARKETING/STUDENT_PARENT `403` on every route
across all six resources, DOCUMENT_SPECIALIST ALLOW only on `partner`/`partner_documents`.

## FIELD-LEVEL SECURITY
`FieldPolicyService.redactPartner` — new, verified live on every `partners` response for
DOCUMENT_SPECIALIST (`internalNotes` null, non-sensitive fields still visible); full value
confirmed visible for ED. No field-level redaction was needed for Commission data — the
only two roles ever granted anything on `commission_rules`/`commission_transactions`
(ED/DM/ADMIN_FINANCE) all see full commercial detail, so resource-level permission gating
alone fully satisfies the sensitivity requirement.

## AUDIT
Every mutating Phase 10 route is `@Audit`-decorated (CREATE/EDIT/VIEW/ARCHIVE as
appropriate); verified directly for `GET /commission-transactions/:id` (VIEW, `result:
SUCCESS` row confirmed in `audit_logs`).

## DOCUMENT INTEGRATION
`PartnerDocument.documentId` verified to grant VIEW+DOWNLOAD to every current user of the
roles holding `partner_documents:view` (via the new `DocumentsService.grantRoleAccess`) and
to gate access the same way every other Document-linked entity does — no public URL, no
PartnerFile/PartnerStorage entity anywhere in the schema.

## TASK INTEGRATION
None built. `10-partners/01_PARTNER_CRM.md` names no concrete Task auto-generation trigger
(unlike Phase 06/08/09's explicitly named "application"/"scholarship"/"visa" triggers) — the
orchestration prompt's own cross-cutting instruction is explicit that Task/Notification
integration is only built "nếu Phase 10 MD yêu cầu." No new `TaskTemplateTrigger` value was
added this phase.

## NOTIFICATION INTEGRATION
None built, same reasoning as Task integration above — no concrete event/trigger is named
anywhere in the phase's own instruction file.

## DATABASE CHANGES
1 new migration on top of Phase 01-09's 15: additive (`ADD COLUMN`/`CREATE TABLE`/`CREATE
TYPE`/`CREATE INDEX`/`ADD CONSTRAINT`) except one documented, zero-data-loss column drop
(`partner_documents.file_reference`, confirmed 0 rows via `PrismaClient.partnerDocument.
count()` before applying — no service had ever been built against it). No entity renamed,
merged, or duplicated; no Phase 01-09 table altered destructively.

## MIGRATIONS
1. `20260819110000_partner_crm_commission_phase10` — `PartnerDocumentStatus`/
   `PartnerLinkStatus`/`CommissionBasis`/`CommissionTransactionStatus` enums;
   `partners.contact_phone`/`internal_notes`; `partner_programs.program_id`;
   `partner_documents` rebuilt (`file_reference` dropped, `status`/`document_id`/
   `owner_id` added, `UNIQUE(partner_id, type, version)` added); new `partner_student_links`/
   `commission_rules`/`commission_transactions` tables + indexes + FKs.

Applied via `prisma migrate diff` (script) + a hand-created migration folder +
`prisma migrate deploy`, the same non-interactive pattern established in Phase 02-09.

## API CHANGES
See `docs/api/API_CONVENTIONS.md` section 11 for the full list. Summary: 5 new
`/partners*` routes, 5 new `/partners/:partnerId/programs*`/`/partner-programs/:id*`
routes, 6 new `/partners/:partnerId/documents*`/`/partner-documents/:id*` routes, 6 new
`/partners/:partnerId/student-links*`/`/students/:studentId/partner-links`/
`/partner-student-links/:id*` routes, 6 new `/partners/:partnerId/commission-rules*`/
`/commission-rules/:id*` routes, 9 new `/commission-transactions*` routes — 37 new routes
total.

## UI CHANGES
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged this phase). Every workflow named in 10-partners/
01_PARTNER_CRM.md (Partner list/detail, Partner Programs, Partner Documents, Linked
Students/Cases, Commission Rules, Commission Transactions, Commission status) is satisfied
as an API capability a future UI would call, consistent with the same reasoning applied in
Phase 03-09.

## TESTS
- Unit: 0 new spec files this phase — 161/161 total (unchanged from end of Phase 09).
  `PartnersService`/`PartnerProgramsService`/`PartnerDocumentsService`/
  `PartnerStudentLinksService`/`CommissionRulesService`/`CommissionTransactionsService`'s
  business logic (duplicate detection, basis validation, precedence selection, FSM
  transitions, Decimal calculation) is covered by e2e, not a separate mocked-Prisma unit
  spec — consistent with the established codebase convention (only the stateless
  RBAC-policy layer, `FieldPolicyService`, gets unit specs, and its `redactPartner`
  addition follows the same e2e-only precedent already set in Phase 07-09).
- Integration/e2e: 1 new suite (`partners.e2e-spec.ts`, 37 tests) — 372/372 total across
  all 19 suites (up from 335), full suite run clean twice consecutively for repeatability
  (`--runInBand`, to avoid this Windows environment's jest-worker teardown flake — see
  KNOWN ISSUES).

## REGRESSION RESULTS
Phase 01-09 full prior suite (161 unit + 335 e2e: auth/RBAC/field-level/audit,
Lead/Student/Case/CaseMember/cross-case-isolation/duplicate-detection, Contract
workflow/Amendment/Payment/partial-payment/refund/waive/overdue/idempotency, Task
workflow/dependency/generation/overdue, Notification fan-out/dedup/recipient-scoping,
Assessment/Roadmap/Milestone versioning+approval+dependency, Profile Evidence
history/attempts/evidence-linkage, Writing versioning/review/LOR redaction,
University/Program/ScholarshipMaster master data, Application workflow/checklist/
duplicate-prevention, Offer lifecycle, ScholarshipApplication eligibility/result, Visa FSM/
checklist/document/result, Pre-Departure/Enrollment/Closure) still passes unmodified, run
as part of the same full-suite executions below (161/372 totals include every Phase 01-09
test unchanged).

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate deploy` applied cleanly; schema additive except the
  one documented, zero-row `file_reference` column drop, confirmed via the generated SQL
  and a row-count check before applying.
- **Seed**: PASS — `npm run db:seed` completes, verified idempotent (run twice
  consecutively, no error/duplication); grant/prune verified (6 new resources correctly
  scoped per role, including ADMIN_FINANCE-commission-full/other-four-view-only,
  DOCUMENT_SPECIALIST-partner/partner_documents-view-only, CONSULTANT/SALES_MARKETING/
  STUDENT_PARENT-zero).
- **Unit Tests**: PASS — 161/161.
- **Integration Tests**: PASS — 372/372 (this project's tooling doesn't separate
  "integration" from "e2e" — see `docs/PROJECT_STRUCTURE.md`).
- **E2E Tests**: PASS — 372/372, 19 suites, verified stable across two consecutive
  `--runInBand` runs.
- **Partner Tests**: PASS — CRUD, duplicate (name, country), archive, field redaction.
- **PartnerProgram Tests**: PASS — nested creation, duplicate (name/degree/major/intake),
  invalid Program FK rejection, real Program-link verification.
- **PartnerDocument Tests**: PASS — Document-subsystem reuse, versioning, immutable-once-
  ACTIVE, supersede-on-activate, archive.
- **PartnerStudentLink Tests**: PASS — FK ownership validation, duplicate ACTIVE-tuple
  rejection, archive-frees-tuple, both-sides visibility.
- **CommissionRule Tests**: PASS — basis/rate cross-validation, negative rejection,
  zero-allowed, deterministic precedence, activate/deactivate.
- **CommissionCalculation Tests**: PASS — CONTRACT_VALUE/PAYMENT_COLLECTED live-read,
  currency-mismatch rejection, Decimal rounding precision.
- **CommissionTransaction Tests**: PASS — full lifecycle, illegal-jump rejection, terminal-
  state immutability, cancel-with-reason, duplicate-transaction idempotency, re-calculate
  safety.
- **Monetary Precision Tests**: PASS — see CommissionCalculation above; verified against
  the actual HTTP response body, not a mocked unit.
- **Currency Tests**: PASS — ISO-4217 validation at the DTO layer, mismatch rejection at
  calculate time.
- **RBAC Tests**: PASS — all 8 roles, all 6 resources, ALLOW and DENY both verified.
- **Field-Level Tests**: PASS — `internalNotes` redacted for DOCUMENT_SPECIALIST, real
  value for ED/DM/ADMIN_FINANCE.
- **Document Permission Tests**: PASS — grant propagation via the new `grantRoleAccess`,
  SALES_MARKETING denied, DOCUMENT_SPECIALIST allowed.
- **Cross-Partner/Case Tests**: PASS — a Case belonging to a different Student rejected on
  PartnerStudentLink creation; every zero-grant role denied `403` regardless of which
  partner/record is targeted (GLOBAL/permission-gated, no per-record scope to bypass).
- **Audit Tests**: PASS — VIEW row verified for `GET /commission-transactions/:id`.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock, unchanged from Phase 03-09; one
  Phase-10-introduced unused-variable error and one unused-import were found and fixed
  during this phase's own lint pass before it was considered complete).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.
- **Regression (Phase 01-09)**: PASS — see REGRESSION RESULTS above.

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
6 new (ASM-40 through ASM-45), full text in `docs/ASSUMPTIONS.md`:
- **ASM-40**: Partner "contacts" stays one primary contact person (name/email/phone), not
  a multi-contact sub-entity; PartnerDocument/PartnerStudentLink/CommissionRule/
  CommissionTransaction get no business-ID format (plain UUID, sub-record precedent).
- **ASM-41**: `PartnerProgram.programId` is an optional, one-directional FK to the
  Admission-domain `Program`; `Program` itself is not touched beyond a back-relation.
- **ASM-42**: PartnerDocument rebuilt on a real Document FK (replacing the unused Phase 02
  `fileReference` string column); new `status`/`ownerId` columns for the
  immutable-once-signed lifecycle.
- **ASM-43**: Phase 10 RBAC grant matrix and field-level redaction — Partner CRM/Commission
  is a business-development/finance function, deliberately zero-by-default for
  Consultant/Sales/Student-Parent, GLOBAL/permission-gated with no new `ScopeKind`.
- **ASM-44**: CommissionRule basis/precedence design (CONTRACT_VALUE/PAYMENT_COLLECTED/
  FIXED only; deterministic specificity→priority→recency→id precedence); no automatic
  Payment-triggered CommissionTransaction generation.
- **ASM-45**: No adjustment/reversal mechanism for PAID/CANCELLED CommissionTransaction
  rows — not named anywhere in the SRS, correctly left unbuilt per the instruction's own
  "không tự tạo phức tạp ngoài scope" guidance.

No new `docs/DECISIONS.md` entry this phase — see "No production defect found this phase"
above.

## RISKS
- **No commission adjustment/reversal mechanism** (ASM-45): if a PAID CommissionTransaction
  is later found to be wrong (miscalculated, wrong partner, fraud), there is currently no
  in-system correction path beyond manually creating a fresh transaction referencing the
  same source (blocked only while the mistaken one remains non-cancelled) — a future phase
  needing a real audit-trailed adjustment/credit-note workflow will need new schema, not
  just new endpoints on the existing model.
- `PartnersService`/`PartnerProgramsService`/`PartnerStudentLinksService`'s service-layer
  uniqueness checks (replacing a DB constraint) carry the same accepted TOCTOU-race profile
  as every other service-layer uniqueness rule in this codebase (Case's at-most-one-active,
  Application's DEC-05 check, Visa/Enrollment's Phase 09 checks) — accepted as consistent
  with existing precedent rather than solved with a partial/conditional unique index.
- `CommissionRule.basis` currently supports only CONTRACT_VALUE/PAYMENT_COLLECTED/FIXED —
  the orchestration prompt's own example list also mentioned "university-paid commission"
  and unspecified "other basis," neither of which has a concrete field/entity/trigger
  anywhere in the SRS to calculate from; a future phase naming a concrete new basis will
  need a real `CommissionBasis` enum value and a matching `readSourceAmount` branch, not
  just configuration.
- No automatic Payment→CommissionTransaction trigger exists (ASM-44) — every transaction
  must be created explicitly by staff/finance naming its source; if a future phase requires
  fully automatic generation the instant a Payment clears, that wiring (analogous to
  `docs/architecture/DOMAIN_MAP.md`'s long-unbuilt `CommissionTriggerEvent`) still needs to
  be added to `PaymentsService`.

## KNOWN ISSUES
- **Windows jest-worker parallel-execution flakiness, more pronounced this phase than in
  Phase 06-09's own Known Issues**: running the full e2e suite via the normal `npm run
  api:test:e2e` (multi-worker) command produced inconsistent results across consecutive
  runs on this machine — one run 372/372 clean, a later run showed 8 scattered failures
  across 5 unrelated suites, another showed a single unrelated TOTP-timing failure in the
  already-PASSed `auth.e2e-spec.ts` (never touched this phase), and two runs crashed
  entirely on the documented `Error: kill EPERM` teardown issue before printing a summary.
  Root-caused, not guessed: re-running the identical suite with `--runInBand` (single
  process, no jest-worker IPC/teardown involved at all) produced 372/372 clean on two
  consecutive runs with zero flakiness of any kind — conclusively isolating the cause to
  this Windows environment's multi-process worker teardown/IPC behavior under load, not to
  any Phase 10 code or test content (the specific tests that failed were different and
  unrelated on every failing run, the clearest signature of environment-level flakiness
  rather than a logic defect). `partners.e2e-spec.ts` itself passed cleanly on every single
  run, including the first one, in both worker and in-band mode. Recommendation for future
  sessions on this machine: prefer `npx jest --config jest.e2e.config.js --runInBand` over
  the default multi-worker `npm run api:test:e2e` when seeking a definitive pass/fail
  signal.
- Two lint issues were introduced and fixed within this phase's own development, not left
  outstanding: an unused `transaction` local in `CommissionTransactionsService.
  confirmEligibility` (the status-check result was never read) and an unused `caseAId`
  local in the new test file. Both fixed before the phase was considered complete; final
  lint run is 0 errors.
- Carried over from Phase 02-09, still accurate and unaffected by this phase: the
  `deepmerge-ts` dev-only `npm audit` advisories, the `eslint-visitor-keys` `EBADENGINE`
  warning, and the `otplib` 12.0.1 pin.

## next dependency (for Phase 11)
- Every domain named in `docs/architecture/DOMAIN_MAP.md` now has a real
  controller/service/workflow — Partners (domain 8) was the last foundation-slice module
  still schema-only. Phase 11's own instruction file should be consulted for what it
  actually adds (the orchestration prompt for this phase named it only as "not in scope");
  `docs/PHASE_MAP.md` is the authoritative source, not an assumption made here.
- If Phase 11 is Student/Parent Portal work (matching the several `docs/ASSUMPTIONS.md`
  ASM-09-style "self-service editing is Phase 11 Portal work" notes accumulated since Phase
  04), the Phase 10 RBAC design deliberately left STUDENT_PARENT at zero grant across the
  entire Partner CRM/Commission domain — that should very likely stay zero even in a Portal
  phase (commission is agency-internal business data, not the student's own), unlike the
  Admission/Visa self-service actions those ASM-09-style notes anticipate eventually
  opening up.
- `docs/security/RBAC_MATRIX.md` section 2's grant table is the pattern to extend for
  whatever resource(s) Phase 11 introduces — follow the same grant-and-prune seed
  discipline, and weigh the same grouped-vs-per-entity resource judgment call documented in
  ASM-21/ASM-31/ASM-37/ASM-43 before defaulting to one resource per entity.
- Real object storage/signed-URL/virus-scan for `Document` (deferred since Phase 07,
  ASM-23) remains Phase 12 — Phase 10's `PartnerDocument.documentId` links are ready to
  point at real files the moment that infrastructure exists, no schema change needed then.
- The `--runInBand` e2e-execution finding above should be considered for this project's own
  CI/test-running documentation if the flakiness recurs in a future session on this same
  machine — it is a fully general fix, not specific to Phase 10's test file.

READY FOR PHASE 11: YES

Không tự chuyển sang Phase 11. Chờ prompt tiếp theo.
