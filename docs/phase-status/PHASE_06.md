# PHASE STATUS — PHASE_06 (Operations)

## status
PASS

## scope
Phase 06A (Task Engine, `06-operations/01_TASK.md`) + Phase 06B (Notification Engine,
`06-operations/02_NOTIFICATION.md`). Built directly on the Phase 01–05 foundation
(architecture, DB schema, API conventions, auth, RBAC, audit, Lead/Student/Case,
Contract/Payment) — no rewrite of anything already PASSed except a genuine pre-existing
infrastructure defect found and fixed by this phase's own testing (see DEC-05 below). No
Phase 07+ feature (Assessment/Roadmap, Application/Visa/Scholarship business logic,
Document controller, real queue/scheduler infra) was implemented — where 06-operations'
own instruction files name a trigger/event tied to one of those not-yet-built domains
(`application`/`visa`/`scholarship` task triggers; `application deadline`/`scholarship
deadline`/`visa appointment`/`document request` notification events), it was deliberately
left unbuilt and documented (`docs/ASSUMPTIONS.md` ASM-16), not faked.

## implemented

**Task lifecycle**: full status FSM (Not Started→In Progress→Blocked→Done/Cancelled),
enforced server-side (`TasksService.updateStatus`) — moving to BLOCKED requires a
non-empty `blocker` reason; moving to DONE requires every task this one `dependsOn` to
already be DONE or CANCELLED (`docs/ASSUMPTIONS.md` ASM-17); a terminal (DONE/CANCELLED)
task's definition is frozen against further generic edits. Owner-or-case-OWNER-or-GLOBAL
manageability (`TasksService.requireManageable`) — the same VIEW-(any member)-vs-
MANAGE-(owner only) split `CasesService.assertManageable` already established, applied to
Task: a mere COLLABORATOR can see every task on a case they're a member of, but can only
*manage* (edit/status/assign/dependencies) a task they personally own, unless they're the
Case's OWNER member (team-lead override) or a GLOBAL-scope role.

**Task dependencies**: self-dependency rejected, circular dependency rejected (server-side
graph walk, `TasksService.wouldCreateCycle` — "không tạo logic dependency chỉ ở
frontend"), duplicate edges rejected, completion prerequisite check as above. A CANCELLED
prerequisite satisfies the completion gate, not just DONE (`docs/ASSUMPTIONS.md` ASM-17).

**Overdue — computed, consistent**: `TasksService.isOverdue` is the one function every
read path (list filter, computed response field) calls — `Task.status` has no stored
OVERDUE value (unlike `Payment.status`, which does — a deliberate pre-existing schema
choice from Phase 02, kept as-is). Timezone-safe by construction (UTC-instant `Date`
comparison, no separate timezone column needed).

**Task auto-generation (`TaskTemplate` + `TaskGenerationService`)**: idempotent via
`Task`'s own `(templateId, sourceEntityType, sourceEntityId)` unique constraint — a
retried event or duplicated call can never produce two tasks for the same (template,
source) pair (`docs/ASSUMPTIONS.md` ASM-19). Wired to the three triggers buildable in this
phase: Case creation (both `LeadsService.convert` and `CasesService.createForStudent`),
Case stage change (`CasesService.updateStage`, matched against `triggerStageValue`), and
Contract activation (`ContractsService.updateStatus` reaching ACTIVE, owner resolved via
the linked Case set at signing — `docs/ASSUMPTIONS.md` ASM-15).

**Task RBAC/scope**: reuses Student/Case's existing `ROLE_SCOPE` (`scopeKindFor`) rather
than a fourth per-resource scope map, per 06-operations/01_TASK.md's own wording
("task phải thuộc đúng Student/Case scope") — `docs/ASSUMPTIONS.md` ASM-16.
STUDENT_PARENT is granted zero `tasks:*` permission (Task Engine is internal staff
tooling in this phase). DOCUMENT_SPECIALIST gets full `tasks:view/create/edit/assign` at
parity with CONSULTANT (Task *execution* is a different capability from Case
*management*, where DOCUMENT_SPECIALIST stays narrower, unchanged from Phase 04).

**Notification engine**: in-app + email fan-out (every event creates two rows, one per
channel — SRS 6.20 "in-app + email bắt buộc"). IN_APP is delivered the instant the row
exists (`sentAt = now`); EMAIL has no real provider wired up yet, so `sentAt` stays null,
honestly reflecting "recorded, not dispatched" (`docs/ASSUMPTIONS.md` ASM-18). Dedup via
`Notification.dedupeKey` (nullable-unique, same NULL-semantics pattern as
`Payment.reference`) — a retried event, duplicated queue message, or repeated API call
never double-sends. Events wired: TASK_ASSIGNED (create + reassign), TASK_BLOCKED (case
owner only, skipped when the actor would be notifying themselves), TASK_DEADLINE_REMINDER
(30/14/7/3/1-day offsets), TASK_OVERDUE_REMINDER (daily), CONTRACT_APPROVAL_REQUEST (every
`contracts:approve` holder, on submit), PAYMENT_OVERDUE_REMINDER (every `payments:record`
holder, daily). Self-service inbox (`GET/PATCH /notifications`) — `recipientId ===
principal.userId` unconditionally, no role-gated permission at all (same pattern as
`/auth/me`).

**Notification security**: payloads carry reference ids only — never Contract
value/currency, Payment amount/currency, or other financial/internal-notes-grade content
(SRS 6.20). The one deliberate exception is TASK_BLOCKED's `blocker` text, sent only to
the Case's internal OWNER, who already has full read access to that field on the Task
itself — not a client-facing or cross-scope leak.

**No queue/scheduler exists yet** (Redis/BullMQ is Phase 12 per `docs/PHASE_MAP.md`) — the
reminder cadences (deadline/overdue) are fully-built, idempotent, callable domain methods
(`TasksService.generateDeadlineReminders`/`generateOverdueReminders`,
`PaymentsService.generateOverdueReminders`) with a narrow manually-triggerable endpoint
(`POST /tasks/reminders/run`, `POST /payments/reminders/run`, both SYSTEM_ADMIN/
EXECUTIVE_DIRECTOR-gated, same special-cased-role pattern as `sessions:revoke-any`)
standing in until Phase 12 wires a real cron — `docs/ASSUMPTIONS.md` ASM-18.

**No production defect found this phase** — unlike Phase 04 (DEC-03) and Phase 05 (DEC-04),
this phase's own testing surfaced only a test-fixture-hygiene bug in the test suite
itself, not in already-PASSed production code; see Known Issues below, and note there is
no new `docs/DECISIONS.md` entry for it (a test-isolation fix isn't an architecture
decision).

## files read
- `06-operations/01_TASK.md`, `06-operations/02_NOTIFICATION.md`
- Phase 01–05 documentation/checkpoints already in this session's context:
  `docs/architecture/{DOMAIN_MAP,TARGET_ARCHITECTURE}.md`, `docs/database/{ERD,
  DATA_DICTIONARY}.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/{AUTH_MODEL,
  RBAC_MATRIX}.md`, `docs/phase-status/{01-discovery,PHASE_02,PHASE_03,PHASE_04,
  PHASE_05}.md`, `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PHASE_MAP.md`,
  `database/schema.prisma`, `apps/api/src/**` (existing code)

## files created/updated
Database: `database/schema.prisma` (`TaskTemplate` + `TaskTemplateTrigger` enum, new;
`Task.templateId/sourceEntityType/sourceEntityId` + unique constraint;
`Notification.dedupeKey`), 1 new migration
(`20260818082507_operations_task_notification_phase06`), `database/seeds/seed.ts`
(`tasks:*` permission matrix + per-role grants, Task RBAC fixtures
`TASK-2026-90001`/`TASK-2026-90002`, DOCUMENT_SPECIALIST task-permission-parity revision).

API (`apps/api/src/`):
- `modules/case-management/tasks/**` (new — `tasks.{controller,service}.ts`,
  `case-tasks.controller.ts`, `task-generation.service.ts`, `task-templates.
  {controller,service}.ts`, `tasks.module.ts`, `dto/*.ts`, `tasks.service.spec` n/a —
  business logic covered by e2e per this codebase's established pattern, see TESTS below)
- `modules/notifications/notifications/**` (new — `notifications.{controller,service}.ts`,
  `notifications.module.ts`, `dto/notification-query.dto.ts`)
- `modules/identity/rbac/scope-policy.service.ts` (+ spec — `taskListFilter`/
  `assertTaskAccessible`, reusing `scopeKindFor`)
- `modules/case-management/cases/cases.service.ts` (CASE_CREATED/CASE_STAGE_CHANGED
  trigger calls), `cases.module.ts` (imports TasksModule)
- `modules/case-management/case-management.module.ts` (imports + re-exports TasksModule)
- `modules/crm/leads/leads.service.ts` (CASE_CREATED trigger call on the case-creation
  branch of `convert()`)
- `modules/commercial/contracts/{contracts.service,contracts.module}.ts`
  (CONTRACT_ACTIVATED trigger call, CONTRACT_APPROVAL_REQUEST notification on `submit()`,
  imports CaseManagementModule + NotificationsModule)
- `modules/commercial/payments/{payments.service,payments.controller,payments.module}.ts`
  (`generateOverdueReminders`, `POST /payments/reminders/run`, imports NotificationsModule)
- `common/idempotency/idempotency.interceptor.ts` (DEC-04, Phase 05's fix — unrelated to
  this phase, unchanged)
- `app.module.ts` (registers NotificationsModule)

Tests (`apps/api/test/`): `tasks.e2e-spec.ts` (34 tests), `notifications.e2e-spec.ts` (12
tests).

Docs: `docs/security/RBAC_MATRIX.md` (tasks resource, Task reuses ROLE_SCOPE, new
CREATE/EDIT/ASSIGN task entries, notifications self-service note, fixture description),
`docs/ASSUMPTIONS.md` (ASM-16 through ASM-19), `docs/database/{ERD,DATA_DICTIONARY}.md`
(TaskTemplate, Task/Notification column additions), `docs/api/API_CONVENTIONS.md` (new
endpoints), this file.

## TASK ENGINE
Fields match `06-operations/01_TASK.md` exactly — case, student (resolved via
`Task.case.studentId`, not a redundant denormalized column — no duplicate-FK business
concept), module, type, owner, priority, start, deadline, status, output, quality,
blocker, all already present in the Phase 02 schema and now fully wired to a live
CRUD/workflow API for the first time.

## TASK WORKFLOW
FSM enforced server-side (`TasksService.TASK_TRANSITIONS`); no client-supplied arbitrary
status transition is ever accepted — verified directly (`409
INVALID_TASK_STATUS_TRANSITION` on an illegal jump).

## TASK DEPENDENCY
Self/circular rejection, duplicate-edge rejection, and the DONE-completion prerequisite
gate (DONE-or-CANCELLED satisfies it) all enforced in `TasksService`, never the frontend —
verified directly for every case (`apps/api/test/tasks.e2e-spec.ts`'s "dependencies"
describe block).

## TASK TEMPLATE
`TaskTemplate` + `TaskGenerationService.generateForEvent` — idempotent by construction
(DB unique constraint, not just a check-then-create race guarded in application code).
Verified directly: firing the same CASE_STAGE_CHANGED event twice produces exactly one
generated task, not two.

## TASK GENERATION
Wired to CASE_CREATED (Lead conversion + standalone case-for-student), CASE_STAGE_CHANGED
(matched against `triggerStageValue`), and CONTRACT_ACTIVATED (owner resolved via the
signed-linked Case). `application`/`visa`/`scholarship` triggers named in the instruction
file are deliberately not built — no owning entity/controller exists yet (Phase 07/08/09)
— see `docs/ASSUMPTIONS.md` ASM-16.

## DEADLINE / OVERDUE
One shared function (`TasksService.isOverdue`) for every consumer; UTC-instant comparison
is timezone-safe by construction, no separate timezone config needed. Completed-before-
deadline, completed-after-deadline, cancelled, and blocked tasks all verified never to
report overdue once resolved; a rescheduled (deadline edited while still open) task is
re-evaluated against the new deadline on every read, not cached.

## NOTIFICATION
In-app + email fan-out, self-service inbox, RBAC-aware recipient resolution (task owner;
Case OWNER for TASK_BLOCKED; every `contracts:approve`/`payments:record` holder for the
two Contract/Payment events) — never a client-suppliable recipient.

## NOTIFICATION CHANNELS
IN_APP delivered immediately (row = delivery); EMAIL recorded but not actually dispatched
(no provider exists — `docs/ASSUMPTIONS.md` ASM-18). SMS/ZALO/WHATSAPP remain unused,
correctly deferred to Phase 12 `integrations` per `docs/architecture/TARGET_ARCHITECTURE.md`
section 6 ("không nhúng logic gửi SMS trực tiếp vào domain notifications").

## NOTIFICATION IDEMPOTENCY
`Notification.dedupeKey` (nullable-unique) — verified directly: reassigning to the same
owner twice, or re-running a reminder sweep the same day, produces exactly one
notification row per (event, recipient, channel), not two.

## RECIPIENT AUTHORIZATION
`NotificationsService.listInbox`/`markRead` hard-code `recipientId === principal.userId` —
no code path accepts a client-suppliable recipient for reading someone else's inbox.
Verified directly: a second user's `GET /notifications` never contains another user's
notification; `PATCH /notifications/:id/read` on someone else's notification 404s (not
403 — same AC-02-style non-enumeration pattern used everywhere else in this API).

## RBAC
New `taskListFilter`/`assertTaskAccessible` on `ScopePolicyService`, reusing the existing
`ROLE_SCOPE` map (`docs/ASSUMPTIONS.md` ASM-16) rather than adding a fourth per-resource
scope table. Full grant table updated (`tasks:view/create/edit/assign` per role); seeded
via the DEC-02 grant-and-prune sync.

## AUDIT
Every mutating Task route is `@Audit`-decorated (CREATE/EDIT/ASSIGN/VIEW as appropriate).
Notification's self-service inbox routes are NOT audit-decorated (reading your own inbox
is not a sensitive action in the SRS 6.21 sense — VIEW/EDIT/DOWNLOAD/EXPORT/SHARE/DELETE/
LOGIN are; a routine inbox poll isn't any of those) — consistent with the existing
"audit is opt-in per endpoint" convention (`AuditInterceptor`'s own doc comment).

## database changes
1 new migration on top of Phase 01–05's 9: additive only (`ADD COLUMN`/`CREATE TABLE`/
`CREATE TYPE`/`CREATE INDEX`, no destructive changes) — confirmed by inspecting the
generated SQL before applying. No entity renamed, merged, or duplicated.

## migrations
1. `20260818082507_operations_task_notification_phase06` — `TaskTemplateTrigger` enum,
   `task_templates` table, `tasks.template_id/source_entity_type/source_entity_id` +
   unique index, `notifications.dedupe_key` + unique index.

Applied via `prisma migrate diff` (script) + a hand-created migration folder +
`prisma migrate deploy`, the same non-interactive pattern established in Phase 02/03/04/05
(`prisma migrate dev` requires an interactive confirmation this environment cannot
answer) — no manual schema edits, no `db push` used for anything that shipped.

## API changes
See `docs/api/API_CONVENTIONS.md` section 11 for the full list. Summary: 9 new
`/tasks*`/`/cases/:caseId/tasks*` routes, 3 new `/task-templates` routes, 1 new
`/payments/reminders/run` route, 2 new `/notifications*` routes.

## UI changes
None — no frontend application exists in this repository at any phase (`docs/
ASSUMPTIONS.md` ASM-08, unchanged this phase). `01_TASK.md`'s "My Tasks, Team Tasks,
Overdue, Blocked, Calendar" are all satisfied as `GET /tasks` query-filter capabilities
(`mine`, `status=BLOCKED`, `overdue=true`, `deadlineFrom`/`deadlineTo`) a UI would call,
consistent with the same reasoning already applied in Phase 03/04/05. "Notification Inbox"
is `GET/PATCH /notifications`; "Notification Preferences" was not requested by either
instruction file and was not built.

## TESTS
- Unit: +1 spec file addition this phase (`ScopePolicyService` Task-scope additions —
  `taskListFilter`/`assertTaskAccessible`) — 161/161 total (up from 149 at the end of
  Phase 05). `TasksService`/`TaskGenerationService`/`NotificationsService`'s business
  logic (workflow FSM, dependency graph, generation idempotency, notification dedup) is
  covered by e2e, not a separate mocked-Prisma unit spec — consistent with how Lead/
  Student/Case/Contract/Payment's equivalent services were tested in Phase 04/05 (no
  `tasks.service.spec.ts` exists; only the stateless RBAC-policy layer gets unit specs in
  this codebase, per the pattern already documented in Phase 05's own status report).
- Integration/e2e: 2 new suites (`tasks.e2e-spec.ts` 34 tests, `notifications.e2e-spec.ts`
  12 tests) — 187/187 total across all 10 suites (up from 141), full suite run clean
  (twice, for repeatability, after fixing a test-isolation issue — see Known Issues).

## VALIDATION RESULTS
- **Migration**: PASS — `prisma migrate deploy` applied cleanly; schema additive-only,
  confirmed via the generated SQL before applying.
- **Seed**: PASS — `npm run db:seed` completes; grant/prune verified (`tasks:*`
  permissions correctly scoped per role, including the STUDENT_PARENT-zero-grant and
  DOCUMENT_SPECIALIST/CONSULTANT-parity design).
- **Unit Tests**: PASS — 161/161.
- **Integration Tests**: PASS — 187/187 (part of the same e2e run; this project's tooling
  doesn't separate "integration" from "e2e" — see `docs/PROJECT_STRUCTURE.md`).
- **E2E Tests**: PASS — 187/187, 10 suites.
- **RBAC Tests**: PASS — Task's reused ROLE_SCOPE ALLOW/DENY including the "CONSULTANT.b
  is not a caseA member" DENY and the owner-vs-case-owner-vs-mere-collaborator
  manageability split (`tasks.e2e-spec.ts`); Notification recipient-scoping ALLOW/DENY
  (`notifications.e2e-spec.ts`).
- **Task Workflow Tests**: PASS — legal-chain walk, illegal-jump rejection, BLOCKED
  requires a reason, terminal-state immutability.
- **Dependency Tests**: PASS — self-dependency, circular dependency, duplicate edge,
  prerequisite-not-done, CANCELLED-satisfies-prerequisite, remove (+ 404 on repeat).
- **Assignment/Scope Tests**: PASS — case-OWNER-can-reassign-a-collaborator's-task,
  mere-collaborator-cannot-reassign-someone-else's-task, collaborator-can-reassign-their-
  own-task.
- **Deadline/Overdue Tests**: PASS — fixed seed fixture (past deadline) confirms
  `isOverdue`; a DONE task with a past deadline never reports overdue; list filters by
  `overdue=true`.
- **Task Idempotency Tests**: PASS — CASE_CREATED/CASE_STAGE_CHANGED/CONTRACT_ACTIVATED
  generation, repeat-fire-produces-no-second-task verified directly against the DB by
  `templateId`.
- **Notification Tests**: PASS — in-app + email fan-out, TASK_ASSIGNED on create/reassign,
  TASK_BLOCKED to the case owner (never self), CONTRACT_APPROVAL_REQUEST/
  PAYMENT_OVERDUE_REMINDER payloads verified to exclude financial fields.
- **Notification Deduplication Tests**: PASS — repeat reassignment to the same owner and a
  repeated reminder sweep both produce exactly one notification row per channel.
- **Queue Retry/Idempotency Tests**: N/A — no queue exists yet (`docs/ASSUMPTIONS.md`
  ASM-18); the underlying dedup mechanism (`dedupeKey`) that a future queue-retry would
  rely on is tested directly (Notification Deduplication Tests above).
- **Audit Tests**: PASS — VIEW audit rows verified directly for Task reads.
- **Typecheck**: PASS — `npm run api:typecheck` (`tsc --noEmit`), zero errors.
- **Lint**: PASS — `npm run api:lint`, zero errors (7 pre-existing `no-explicit-any`
  warnings in one test's hand-rolled Prisma mock, unchanged from Phase 03/04/05).
- **Build**: PASS — `npm run api:build` (`nest build`), zero errors.
- **Regression (Phase 03/04/05)**: PASS — the full prior suite (149 unit + 141 e2e:
  auth/RBAC/field-level/audit, Lead/Student/Case/CaseMember/cross-case-isolation/
  duplicate-detection, Contract workflow/Amendment/Payment/partial-payment/refund/waive/
  overdue/idempotency/financial-field-permissions) still passes unmodified, run as part of
  the same full-suite executions above (161/187 totals include every Phase 01–05 test
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
4 new (ASM-16 through ASM-19), full text in `docs/ASSUMPTIONS.md`:
- **ASM-16**: Task reuses Student/Case's `ROLE_SCOPE` (no fourth scope map);
  STUDENT_PARENT gets zero `tasks:*` grant; DOCUMENT_SPECIALIST gets task-execution
  parity with CONSULTANT despite staying narrower on Case management.
- **ASM-17**: A CANCELLED prerequisite satisfies Task completion, same as DONE.
- **ASM-18**: Notification dispatch is synchronous; no queue/scheduler exists yet
  (Phase 12 scope) — reminder cadences are callable, idempotent domain methods with a
  manual trigger in the meantime.
- **ASM-19**: Task auto-generation fires at most once per (template, source entity), even
  across repeat real-world occurrences of the same trigger (e.g. a Case re-entering the
  same stage later) — not just literal request retries.

No new architecture/decision record in `docs/DECISIONS.md` this phase — no pre-existing
defect was found in already-PASSed production code (unlike Phase 04's DEC-03 or Phase 05's
DEC-04). The one issue found during this phase's own testing was in the *test suite
itself* (see Known Issues), not production code, so it doesn't rise to a DEC-level
decision record.

## RISKS
- Task auto-generation is a genuinely global side effect — any `TaskTemplate` with
  `triggerEvent: CASE_CREATED` affects *every* Case created anywhere in the system from
  that point on. This is intentional (that's what the feature is for), but it does mean a
  misconfigured or forgotten test/demo template left `active: true` will keep generating
  tasks indefinitely — flagged concretely in Known Issues below since it already bit this
  phase's own e2e development once.
- No commission/partner-payout, Application/Visa/Scholarship, or Document entity exists
  yet, so 3 of the 6 named Task triggers and 4 of the 9 named Notification events are
  correctly un-built rather than faked — whoever builds Phase 07/08/09/12 should extend
  `TaskTemplateTrigger`/the notification-event set rather than inventing a parallel
  mechanism.
- The reminder sweep endpoints (`POST /tasks/reminders/run`, `POST /payments/reminders/run`)
  are manually triggered — nothing calls them automatically. Until Phase 12 wires a
  scheduler, deadline/overdue reminders only fire when a SYSTEM_ADMIN/EXECUTIVE_DIRECTOR
  (or an ops script) calls them.

## KNOWN ISSUES
- **Fixed during this phase's own test development, not left outstanding**: an early
  version of `apps/api/test/tasks.e2e-spec.ts`'s task-generation tests created
  `TaskTemplate` fixtures with `triggerEvent: CASE_CREATED`/`CASE_STAGE_CHANGED` and never
  deactivated them, which (given Jest's default cross-file parallelism) leaked into
  `case-management.e2e-spec.ts`'s and `contracts.e2e-spec.ts`'s own case-creation/closure
  flows — a stray always-active template generated an extra open Task on cases those files
  created, which then tripped `CasesService.close()`'s pre-existing open-task guard and
  broke two Phase 04 tests and one Phase 05 test that had nothing to do with Task Engine.
  Root-caused (not a production defect — a test-fixture-hygiene bug) and fixed: every
  Task-generation test in `tasks.e2e-spec.ts` now deactivates its template in a
  `try`/`finally` immediately after use, and the stale rows already left in the dev
  database by earlier debugging runs were deleted. Re-verified clean across three
  consecutive full e2e runs after the fix.
- A Windows-specific `jest-worker` teardown flake (`Error: kill EPERM` during forced
  worker exit, or the benign "A worker process has failed to exit gracefully" warning)
  was observed intermittently across e2e runs (roughly 1 in 3) — when it occurs, no test
  results are reported at all (the run aborts during cleanup, not during testing); when it
  doesn't occur, all 187 tests pass consistently. This appears to be a pre-existing
  Windows/Jest/Prisma-connection-teardown characteristic of the harness rather than a
  Phase 06 regression — no test in this phase opens an interval/timeout or additional
  long-lived handle beyond what earlier phases' e2e suites already do (a
  `Test.createTestingModule` + `PrismaService` + `app.close()` in `afterAll`, identical to
  every other `*.e2e-spec.ts` file). Flagged here for whoever next touches e2e test
  infrastructure, rather than silently retried until green.
- Carried over from Phase 02–05, still accurate and unaffected by this phase: the
  `deepmerge-ts` dev-only `npm audit` advisories, the `eslint-visitor-keys` `EBADENGINE`
  warning, and the `otplib` 12.0.1 pin.

## next dependency (for Phase 07)
- `TaskTemplateTrigger` (`CASE_CREATED`/`CASE_STAGE_CHANGED`/`CONTRACT_ACTIVATED`) and the
  Notification event set are both designed to be extended, not replaced — Phase 07/08/09
  adding Assessment/Roadmap/Application/Visa/Scholarship business logic should add new
  enum values / event strings there rather than inventing a parallel task-generation or
  notification mechanism.
- `docs/security/RBAC_MATRIX.md` section 2's grant table is the pattern to extend for
  whatever resource(s) Phase 07 introduces — follow the same grant-and-prune seed
  discipline (DEC-02).
- `TasksService.generateDeadlineReminders`/`generateOverdueReminders`/
  `PaymentsService.generateOverdueReminders` are the callable domain methods Phase 12's
  scheduler should invoke on a cron, rather than reimplementing the reminder logic.

READY FOR PHASE 07: YES

Không tự chuyển sang Phase 07. Chờ prompt tiếp theo.
