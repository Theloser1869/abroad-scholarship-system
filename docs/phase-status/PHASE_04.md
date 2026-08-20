# PHASE STATUS — PHASE_04 (Core CRM)

## status
PASS

## scope
Phase 04A (Lead/CRM, `04-core-crm/01_LEAD.md`) + Phase 04B (Student + Case,
`04-core-crm/02_STUDENT_CASE.md`). Built directly on the Phase 01–03 foundation
(architecture, DB schema, API conventions, auth, RBAC, audit) — no rewrite of anything
already PASSed. No Phase 05+ feature (Contract business logic, Payment, Task/Notification
business endpoints) was implemented.

## implemented

**Lead lifecycle**: full CRUD, status FSM (New→Contacted→Qualified→Consultation→
Contracting→Lost, with CONVERTED reachable only through `convert()`), owner assignment,
filter/search (status, owner, free text), notes, timeline.

**Lead → Student → Case chain**: `POST /leads/:id/convert` is the single, transactional
entry point — duplicate detection (email/phone/name+DOB, `DuplicateDetectionService`),
merge-confirmation protocol (dry-run returns candidates; caller decides MERGE or
CREATE_NEW), Student creation via the shared `IdGeneratorService`, and reuse (not
duplication) of an already-active Case when merging into an existing Student. See
`docs/ASSUMPTIONS.md` ASM-12 for why this phase implements Lead conversion (not Contract
signing) as the trigger, given Contract business logic is Phase 05.

**Student 360 / Case management**: standalone "open a new Case for an existing Student"
path (`POST /students/:id/cases`) enforcing at most one non-closed/archived Case per
Student at a time; stage updates (free-text/configurable, plus a `department` field);
status FSM (OPEN→ACTIVE→ON_HOLD→COMPLETED→ARCHIVED, CLOSED reachable only through
`close()`); closure checks (mandatory reason + an open-Task guard approximating the
"checklist" SRS mentions, since no checklist entity exists yet); collaborator
add/remove, with OWNER-vs-COLLABORATOR distinction enforced (`CasesService.
assertManageable`); notes; timeline.

**Two real defects found and fixed** during this phase's own testing (not left as known
issues) — full write-up `docs/DECISIONS.md` DEC-03:
1. `Lead.convertedStudentId` was `@unique` (a Phase 02 modeling error) — broke the merge
   path the instant two Leads legitimately converged on one Student. Fixed via migration
   + `Student.leadOrigin` → `leadOrigins Lead[]`.
2. `ErrorContractFilter` (Phase 02) silently dropped every custom exception-body field
   beyond `code`/`message`/`details` — `candidates`, `lockedUntil`, `allowedTransitions`,
   etc. never reached the client. Fixed to pass through all extra fields; regression test
   added (`error-contract.filter.spec.ts`).

## files read
- `04-core-crm/01_LEAD.md`, `04-core-crm/02_STUDENT_CASE.md`
- Phase 01–03 documentation/checkpoints already in this session's context:
  `docs/architecture/*`, `docs/database/{ERD,DATA_DICTIONARY}.md`,
  `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,RBAC_MATRIX}.md`,
  `docs/phase-status/{01-discovery,PHASE_02,PHASE_03}.md`, `docs/ASSUMPTIONS.md`,
  `docs/DECISIONS.md`, `database/schema.prisma`, `apps/api/src/**` (existing code)

## files created/updated
Database: `database/schema.prisma` (`Lead.majorInterest`, `Case.department`,
`CaseMember.removedAt`, `Lead.convertedStudentId` uniqueness fix, `Student.leadOrigins`),
2 new migrations, `database/seeds/seed.ts` (leads/cases permission grants, `demo.sales.b`,
Lead fixture).

API (`apps/api/src/`):
- `modules/crm/**` (new domain — `leads/{leads.controller,leads.service,dto/*}.ts`,
  `crm.module.ts`)
- `modules/case-management/cases/**` (extended: create-for-student, member management,
  stage/status/close, dto additions), `modules/case-management/shared/
  duplicate-detection.service.ts` (+ spec, new)
- `modules/case-management/students/students.controller.ts` (extended: `:id/cases`,
  `:id/notes`, `:id/timeline`), `students.module.ts` (new imports)
- `modules/notifications/comments/**` (new — first slice of the Notifications domain)
- `modules/reporting/timeline/**` (new — first entity-scoped read aggregation beyond
  audit-logs)
- `common/audit/audit.interceptor.ts` (caseId/studentId backfill for Case rows)
- `common/filters/error-contract.filter.ts` (+ new spec — the DEC-03 fix)
- `common/dto/create-note.dto.ts` (new, shared by Lead/Student/Case)
- `identity/rbac/scope-policy.service.ts` (+ spec — `ScopeKind.OWN_LEAD`,
  `LEAD_ROLE_SCOPE`, lead-scope methods)
- `app.module.ts` (registers `CrmModule`)

Tests (`apps/api/test/`): `lead-conversion.e2e-spec.ts`, `case-management.e2e-spec.ts`
(new).

Docs: `docs/security/RBAC_MATRIX.md` (Lead resource, new Case actions, OWN_LEAD scope),
`docs/ASSUMPTIONS.md` (ASM-10 through ASM-12), `docs/DECISIONS.md` (DEC-03),
`docs/database/{ERD,DATA_DICTIONARY}.md` (Phase 04 fields), `docs/api/
API_CONVENTIONS.md` (new endpoints), this file.

## LEAD
Fields match `04-core-crm/01_LEAD.md` exactly (added `majorInterest` this phase; `notes`
deliberately backed by `Comment`, not a raw column — `docs/ASSUMPTIONS.md` ASM-10).
Status FSM enforced server-side (`LeadsService.LEAD_TRANSITIONS`); `CONVERTED` is
unreachable via the generic status endpoint (DTO-level exclusion, verified by a 400 test).
Owner assignment (`PATCH /leads/:id/assign`) is its own action/permission, distinct from
generic edit.

## STUDENT
No schema/business-rule changes to Student itself this phase (Phase 02/03 CRUD +
scope/field-level redaction untouched, not rewritten). Extended only with two new
sub-routes: `:id/cases` (open a new lifecycle) and `:id/notes`/`:id/timeline`.

## CASE
`department` field added (descriptive only, not scope-relevant — ASM-06 still holds: no
Department entity exists). Status FSM (`CasesService.CASE_TRANSITIONS`) mirrors Lead's
pattern: the "terminal, business-significant" status (CLOSED, like Lead's CONVERTED) is
reachable only through its own dedicated method with its own preconditions, never the
generic status PATCH.

## CASE MEMBERS / OWNERSHIP
`CaseMember.removedAt` added (04B "active dates") — a member is deactivated, not deleted,
preserving the row for history-adjacent queries while `AuditLog` carries the actual
add/remove event history. Managing membership (add/remove) and stage/status/closing all
require the caller to be the case's `OWNER` member specifically (not just any
`COLLABORATOR`) for CASE_MEMBER-scoped roles — `CasesService.assertManageable`, tested
directly (`case-management.e2e-spec.ts`: a COLLABORATOR gets `403`, the `OWNER` succeeds).

## DUPLICATE DETECTION
`DuplicateDetectionService.findPotentialDuplicateStudents` — matches on email, phone, OR
(fullName AND dateOfBirth together, never name alone — Hard Rule "Không dùng name làm
foreign key"). Wired into `LeadsService.convert` only (per the Phase 02 code comment that
already scoped this to Lead conversion, not the generic `POST /students`). Tested:
candidate detection blocks silent creation (`409 DUPLICATE_STUDENT_CANDIDATES`), explicit
MERGE reuses the existing Student (and its active Case), explicit CREATE_NEW override
works, and a genuinely-new Lead creates without any duplicate friction.

## WORKFLOW / STATUS
Both Lead and Case now have server-enforced finite state machines (not just an enum
column staff can PATCH to any value) — every illegal transition returns
`409 INVALID_STATUS_TRANSITION` with the actual `allowedTransitions` in the response body
(only reaches the client correctly because of the DEC-03 ErrorContractFilter fix).

## TIMELINE
`TimelineService.forEntity` — a read-only merge of `AuditLog` + `Comment` rows for one
entity, sorted newest-first. Not a new stored entity (Hard Rule: no duplicate entity/
concept — `AuditLog` already is the append-only history mechanism this system uses).
Wired to `GET .../timeline` on Lead, Student, and Case. STUDENT_PARENT sees only
`shared`-visibility notes on Student/Case timelines (Leads have no STUDENT_PARENT-visible
surface at all — scope excludes them entirely).

## RBAC / AUTHORIZATION
New `ScopeKind.OWN_LEAD` (SALES_MARKETING owns Leads it created/was assigned, nothing
else) tracked in a separate `LEAD_ROLE_SCOPE` map from Student/Case's `ROLE_SCOPE` — the
same role can and does carry different scope per resource (documented explicitly in
`docs/security/RBAC_MATRIX.md` section 3, since this wasn't true before Phase 04). Full
grant table updated; `cases:edit/assign/close` and `leads:*` added to the permission
matrix, seeded via the DEC-02 grant-and-prune sync (no stale-grant regression this time —
verified directly against the database after seeding).

## AUDIT
`AuditInterceptor` extended to backfill `caseId` (for `/cases/...` routes) and
`studentId` (from a Case payload's own `studentId` field, in addition to the existing
Student-route heuristic) — SRS 6.21's "student/case" audit fields are now populated for
Case actions too, not just Student ones. New `ASSIGN`-action audit rows for case-member
add/remove, verified directly against the database.

## database changes
2 new migrations on top of Phase 01–03's 6: `Lead.majorInterest`, `Case.department`,
`CaseMember.removedAt` (additive); `Lead.convertedStudentId` uniqueness removed +
`Student.leadOrigin` → `leadOrigins` (a genuine fix, not an addition — see DEC-03). No
entity renamed, merged, or duplicated.

## migrations
1. `20260818123941_lead_case_phase04_fields` — `Lead.majorInterest`, `Case.department`,
   `CaseMember.removedAt`.
2. `20260818131515_fix_lead_converted_student_not_unique` — drops the wrong unique
   index on `leads.converted_student_id`, adds a plain (non-unique) index instead.

Both applied via `prisma migrate diff` (script) + a hand-created migration folder +
`prisma migrate deploy`, the same non-interactive pattern established in Phase 02/03
(`prisma migrate dev` requires an interactive confirmation this environment cannot
answer) — no manual schema edits, no `db push` used for anything that shipped.

## API changes
See `docs/api/API_CONVENTIONS.md` section 11 for the full list. Summary: 9 new `/leads/*`
routes, 7 new `/cases/*` routes (stage/status/close/members/notes/timeline), 3 new
`/students/:id/*` sub-routes (cases/notes/timeline).

## UI changes
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged this phase). `01_LEAD.md`'s "Lead list, Lead detail,
conversion wizard, owner assignment, filter/search, timeline" are all satisfied as API
capabilities a UI would call, consistent with the same reasoning already applied to
Phase 03's audit-log query UI.

## TESTS
- Unit: +9 new spec files/additions this phase (`DuplicateDetectionService`,
  `TimelineService`, `ScopePolicyService` Lead-scope additions, `ErrorContractFilter`) —
  100/100 total (up from 71 at the end of Phase 03).
- Integration/e2e: 2 new suites (`lead-conversion.e2e-spec.ts` 16 tests,
  `case-management.e2e-spec.ts` 16 tests) — 77/77 total across all 6 suites (up from 45),
  run twice consecutively with no data reset between runs (self-isolating, confirmed
  stable).

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate status`: "Database schema is up to date!" (8
  migrations applied, 2 new this phase).
- **Seed**: PASS — grant/prune verified (leads/cases permissions correctly scoped per
  role); re-run twice with unchanged core row counts (idempotent).
- **Unit Tests**: PASS — 100/100.
- **Integration Tests**: PASS — 77/77 (part of the same e2e run below; Jest doesn't
  separate "integration" from "e2e" in this project's tooling — see
  `docs/PROJECT_STRUCTURE.md`, both live under `apps/api/test/*.e2e-spec.ts`).
- **E2E Tests**: PASS — 77/77, 6 suites, run twice consecutively for repeatability.
- **RBAC Tests**: PASS — Lead OWN_LEAD ALLOW/DENY (`lead-conversion.e2e-spec.ts`), Case
  OWNER-vs-COLLABORATOR + cross-case-isolation-on-writes (`case-management.e2e-spec.ts`),
  Student/Case scope (carried over, still passing, `rbac.e2e-spec.ts`).
- **Duplicate/Identity Tests**: PASS — candidate detection, MERGE, CREATE_NEW override,
  no-duplicate-on-clean-input, all in `lead-conversion.e2e-spec.ts`.
- **Cross-Case Tests**: PASS — non-member denied read (carried over) AND write
  (stage/close/add-member all 404 for a non-member, new this phase) in
  `case-management.e2e-spec.ts`.
- **Audit Tests**: PASS — LOGIN/VIEW/CREATE/EDIT/ARCHIVE/EXPORT (carried over) + new
  ASSIGN audit record for case-member changes; DENIED-attempt auditing still verified.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock, unchanged from Phase 03).
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
3 new (ASM-10 through ASM-12), full text in `docs/ASSUMPTIONS.md`:
- **ASM-10**: "Notes" reuse `Comment` (create+list only, not full CRUD) — a deliberate,
  minimal revision of Phase 03's "Comment CRUD is Phase 06" note, not a contradiction of
  it.
- **ASM-11**: `Lead.convertedStudentId` is not unique — the Phase 02 schema bug found and
  fixed this phase (see DEC-03 for the decision record).
- **ASM-12**: Lead conversion (not Contract signing) is this phase's Student+Case
  creation trigger, since Contract business logic is Phase 05 — a reading of two source
  documents (SRS 6.2 vs. `04-core-crm/01_LEAD.md`) that point at slightly different
  trigger mechanics for the same lifecycle event, not a contradiction requiring a stop.

1 new architecture/decision record (DEC-03) in `docs/DECISIONS.md` — the two Phase 02/03
defects found and fixed during this phase's own testing.

## RISKS
- `Case.contractId` stays `null` for every Case created in this phase (Phase 04 doesn't
  create Contracts). Phase 05 must link an existing Case to a Contract, not re-create
  Student/Case — flagged explicitly in ASM-12 for whoever implements that phase.
- The "closure checklist" SRS section 9 mentions is approximated by an open-Task count
  guard, not a real checklist entity (none exists yet). If a later phase introduces a
  proper checklist entity, `CasesService.close()`'s guard should be revisited rather than
  layered on top of.
- `Comment`'s minimal "create+list" slice (ASM-10) has no update/delete — a
  staff-created note is permanent once posted in this phase. Acceptable for now (matches
  the append-only spirit of a timeline/audit trail) but worth flagging before Phase 06
  builds the fuller Comment feature set on top.

## KNOWN ISSUES
- **Fixed during this phase, not left outstanding** (see DEC-03 for full detail): the
  `Lead.convertedStudentId` uniqueness bug and the `ErrorContractFilter` field-dropping
  bug. Both were pre-existing (Phase 02) defects surfaced by Phase 04's own integration
  tests, root-caused, fixed, and re-verified by the full regression suite (100 unit + 77
  e2e, both re-run multiple times).
- Carried over from Phase 02/03, still accurate and unaffected by this phase: the
  `deepmerge-ts` dev-only `npm audit` advisories, the `eslint-visitor-keys` `EBADENGINE`
  warning, and the `otplib` 12.0.1 pin (13.x's ESM-only dependency). No new instances of
  the "wrong-cwd ts-jest" pitfall documented in Phase 03's Known Issues were hit this
  phase — all commands were run via the `npm run api:*` workspace scripts as documented.

## next dependency (for Phase 05)
- `Case.contractId` is the FK Phase 05 (`05-commercial/01_CONTRACT.md`) must populate on
  an *existing* Case once a Contract is created/signed for that Case's Student — Phase 05
  should not re-implement Student/Case creation (that's this phase's job, already done).
- `docs/security/RBAC_MATRIX.md` section 2's grant table is the pattern to extend for
  `contracts`/`payments` resources — follow the same grant-and-prune seed discipline
  (DEC-02) so a stale grant doesn't silently linger.
- `DuplicateDetectionService` (`case-management/shared/`) is available for reuse if
  Phase 05's Contract flow needs any identity-matching logic — no need to reinvent it.

READY FOR PHASE 05: YES

Không tự chuyển sang Phase 05. Chờ prompt tiếp theo.
