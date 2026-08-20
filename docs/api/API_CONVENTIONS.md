# API CONVENTIONS — API Foundation (Phase 02B, updated by Phase 03 Security)

Every business endpoint built from Phase 04 onward must follow this document. The
`students` endpoints (`apps/api/src/modules/case-management/students/`) are the reference
implementation — when in doubt, read that code.

No full business API surface is implemented yet (`02_API_FOUNDATION.md`: "Không triển khai
tất cả business endpoint ở phase này") — the conventions themselves, plus `students`/
`cases`/`users`/`audit-logs` as worked examples covering every convention below.

## 1. Authentication context

`common/context/auth-context.middleware.ts` runs on every request. If the caller sends a
valid `Authorization: Bearer <access-token>` (issued by `POST /auth/login`, MFA verify, or
refresh — `03-security/01_AUTH.md`), the request gets a `Principal { userId, roleCode,
sessionId }` at `req.principal`; otherwise `req.principal = null` (anonymous).

The access token is short-lived and stateless (JWT), but `sessionId` (the token's `jti`
claim) is re-validated against the `sessions` table on *every* request — a malformed,
expired, or **revoked** token/session is treated the same as no token. This is what makes
"revoke session" (logout, admin action, offboarding — SRS AC-14) take effect immediately
instead of only at the token's natural expiry. Full write-up:
`docs/security/AUTH_MODEL.md` section 1.

## 2. Authorization context

`common/guards/auth.guard.ts`, installed globally via `APP_GUARD`, is deny-by-default
(NFR-SEC-01):

1. `@Public()` on a route/controller skips the guard entirely.
2. Otherwise, `req.principal` must be non-null or the request gets `401 UNAUTHENTICATED`.
3. If the route also has `@RequirePermission(resource, action)`, the caller's `roleCode`
   must have a matching row in `role_permissions` (joined through `permissions.resource` +
   `permissions.action`), or the request gets `403 PERMISSION_DENIED`.
4. For record-scoped resources (Student, Case), the resource's own service layer additionally
   calls `ScopePolicyService` (`apps/api/src/modules/identity/rbac/scope-policy.service.ts`)
   to check the *specific record* against the caller's scope (case membership, self/parent
   link, department, or none) — out-of-scope returns `404`, not `403` (SRS AC-02: existence
   must not be confirmed to someone who isn't allowed to see the record). Full matrix:
   `docs/security/RBAC_MATRIX.md`.

Response bodies are field-redacted for sensitive columns via
`FieldPolicyService` (`GET /students/:id` nulls out `budget`/`budgetCurrency` for roles
without Budget/Finance access, SRS section 13) — applied in the controller, never in the
frontend. See `docs/security/RBAC_MATRIX.md` section 5 for which SRS §13 field groups are
covered so far.

Usage:

```ts
@Get(':id')
@RequirePermission('students', 'view')
async getById(@Param('id', ParseUUIDPipe) id: string) { ... }
```

## 3. Validation

Global `ValidationPipe` (`main.ts`): `whitelist: true`, `forbidNonWhitelisted: true`,
`transform: true`. Every request body/query goes through a `class-validator` DTO — no
handler reads `req.body` directly. An invalid payload is `400 BAD_REQUEST` with the field
errors in `error.details` (see section 7).

## 4. Pagination, filtering, sorting, search

`common/dto/list-query.dto.ts` — every list endpoint's query DTO extends `ListQueryDto`:

| Param | Meaning | Default |
|---|---|---|
| `page` | 1-based page number | `1` |
| `limit` | page size, max 100 | `20` |
| `sort` | `field:asc` or `field:desc` | endpoint-defined fallback |
| `search` | free text | endpoint decides which columns |

Pagination is **page-based**, not cursor-based — chosen because every Phase 02+ list
endpoint is backed by a normal indexed Postgres table with a bounded row count per
tenant/case, where `OFFSET`-based paging is simple and sufficient; cursor pagination is not
worth its extra client-side complexity at this scale. Revisit only if a specific endpoint's
row count genuinely requires it later.

`sort` fields are **whitelisted per endpoint** via `parseSort(sort, allowedFields,
fallback)` — an unknown field or a direction other than `asc`/`desc` is
`400 BAD_REQUEST` / `INVALID_SORT`, never silently ignored.

Every list response is wrapped:

```json
{
  "data": [ /* rows */ ],
  "meta": { "page": 1, "limit": 20, "totalItems": 42, "totalPages": 3 }
}
```

## 5. Error contract

Every error response — validation, auth, not-found, conflict, unexpected — has the same
shape (`common/filters/error-contract.filter.ts`, installed globally via `APP_FILTER`):

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message.",
    "requestId": "uuid-or-caller-supplied-id",
    "details": [ /* optional — e.g. class-validator field errors */ ]
  }
}
```

### HTTP status → default `code`

| Status | Code |
|---|---|
| 400 | `BAD_REQUEST` (or a more specific code an endpoint throws, e.g. `INVALID_SORT`) |
| 401 | `UNAUTHENTICATED` |
| 403 | `PERMISSION_DENIED` |
| 404 | `NOT_FOUND` (or a resource-specific code, e.g. `STUDENT_NOT_FOUND`) |
| 409 | `CONFLICT` (or `IDEMPOTENCY_KEY_REUSED`) |
| 422 | `UNPROCESSABLE_ENTITY` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` — message is always generic; the real error is logged server-side with the request ID, never leaked to the client. |

A handler throws a standard Nest `HttpException` subtype with an object body
`{ code, message }`; the filter normalizes it into the contract above. Throwing a bare
string message still works (falls back to the status's default code).

## 6. Request ID

`common/context/request-id.middleware.ts` runs before everything else. It reuses the
caller's `X-Request-Id` header if present, otherwise generates one, and:

- sets it on `req.requestId`,
- echoes it back as the `X-Request-Id` response header on every response (success or
  error),
- includes it in every error body (`error.requestId`),
- includes it in every audit log row (`audit_logs.request_id`),
- includes it in the server log line for any 5xx.

This is what ties a client-reported error back to a specific audit/log entry.

## 7. Audit hook

`common/audit/audit.interceptor.ts`, installed globally via `APP_INTERCEPTOR`, is opt-in
per route via `@Audit('ACTION')` — not every GET is audited, only the sensitive operations
SRS section 1/21 actually names: `VIEW`, `CREATE`/`EDIT` (the SRS verb is "EDIT"; `CREATE`
is used here for inserts since SRS's audited-action list doesn't separately name creation —
see `docs/ASSUMPTIONS.md` if this needs revisiting once Phase 03/04 need before/after
diffing on create), `DOWNLOAD`, `EXPORT`, `SHARE`, `DELETE`, `LOGIN`.

It writes to `audit_logs` **after** the handler resolves (so `objectId` is known for a
create) and **also on a 401/403 rejection** (`result: 'DENIED'`) or any other thrown error
(`result: 'ERROR'`) — a denied attempt is exactly the kind of event SRS says must not go
unaudited. `before_snapshot`/`after_snapshot` diffing for `EDIT` is not populated by this
generic interceptor yet (it would need the pre-update row, which is business-logic-
specific) — the column exists (`docs/database/DATA_DICTIONARY.md`) for the phase that
implements real edit endpoints to populate.

## 8. Consistent HTTP status

Nest defaults are kept as the convention, not overridden ad hoc:

| Method | Success status |
|---|---|
| `GET` | 200 |
| `POST` | 201 |
| `PATCH` | 200 |
| `DELETE` | 200 (no endpoint in this phase deletes; when one exists, prefer archiving over a `204` hard-delete for anything covered by Hard Rule #5) |

No handler in this phase overrides status via `@HttpCode()` — if a future endpoint needs
to, do it explicitly and document why, rather than leaving Nest's default silently wrong.

## 9. Idempotency strategy

`common/idempotency/idempotency.interceptor.ts`, opt-in via `@Idempotent()` on a mutating
route (e.g. `POST /students` in the reference implementation; the real transaction-sensitive
endpoints this was built for — `POST /contracts`, `POST /payments/:id/record`,
`POST /payments/:id/refund` — use it, Phase 05).

The stored response is round-tripped through `JSON.parse(JSON.stringify(body))` before being
persisted to the `Json` column, not stored as the raw object — Prisma's own wire
serialization of a `Prisma.Decimal` into a `Json` column produces a plain number, while the
original HTTP response (via Express's `res.json()`, which calls `Decimal.toJSON()`) sent a
string; without the round-trip, a replayed response for any Decimal-bearing endpoint would
silently differ in field type from the original. Found by Phase 05's own testing — see
`docs/DECISIONS.md` DEC-04.

Protocol: the caller sends `Idempotency-Key: <client-generated-uuid>`.

- **First time a key is seen** — the handler runs normally; the response body is stored
  against `(key, sha256(requestBody))` in `idempotency_keys` (`docs/database/schema.prisma`)
  **before** the response is returned to the caller (not fire-and-forget — an earlier draft
  of this interceptor stored the record asynchronously without awaiting it, which let a
  fast retry race the write and create a duplicate row; the integration test
  `apps/api/test/students.e2e-spec.ts` "replays the stored response..." exists specifically
  to catch a regression of that bug).
- **Same key + same body seen again** — the stored response is replayed; the handler does
  not run again.
- **Same key + a different body** — `409 CONFLICT` / `IDEMPOTENCY_KEY_REUSED`. Silently
  re-running under a reused key would be worse than failing loudly: the caller has a bug.
- **No key supplied** on an `@Idempotent()` route — the interceptor does not force one; it
  simply cannot deduplicate that call. Requiring the header is left to each endpoint's own
  DTO/validation if it wants to make the header mandatory.

`IDEMPOTENCY_KEY_TTL_HOURS` (env, default 24) controls how long a stored key is honored.
Expired-row cleanup is not implemented in this phase (no scheduled job infra exists yet —
that is `12-platform/02_INTEGRATIONS_JOBS.md`); see Known Issues in
`docs/phase-status/PHASE_02.md`.

This is a request-scoped safety net, not a substitute for a DB-level unique constraint on
the underlying business record (e.g. `Payment`'s `(contractId, installmentNo)` unique index)
— both apply, independently.

## 10. Business ID generation

`common/id/id-generator.service.ts` is the single place that produces SRS section 8 codes
(`HS-YYYY-NNNNN`, `HD-YYYY-NNNNN`, `PT-CC-NNNNN`, `PP-CC-NNNNN-NN`, ...), backed by
`business_id_sequences` with a `SELECT ... FOR UPDATE`-guarded increment inside a
transaction. A handler never constructs a business code by hand (string concatenation,
`Date.now()`, etc.) — always `idGenerator.nextYearlyCode('HS')` /
`nextCountryScopedCode('PT', countryCode)` / `nextPartnerProgramSuffix(partnerCode)`.

## 11. Reference endpoints

```
GET    /students                        list — scope-filtered, redacted, pagination + targetCountry filter + search, requires students:view
GET    /students/:id                    scope-checked, redacted, requires students:view, @Audit('VIEW')
POST   /students                        requires students:create, @Audit('CREATE'), @Idempotent()
PATCH  /students/:id                    scope-checked, requires students:edit, @Audit('EDIT')
PATCH  /students/:id/archive            scope-checked, requires students:archive, @Audit('ARCHIVE')
GET    /students/export                 scope-filtered, redacted, requires students:export, @Audit('EXPORT') — reason query param mandatory
POST   /students/:id/cases              scope-checked, requires cases:assign, @Audit('CREATE') — blocks a 2nd concurrent active Case (04-core-crm)
POST   /students/:id/notes              scope-checked, requires students:edit, @Audit('EDIT') — Comment, see section 7-adjacent "notes"
GET    /students/:id/timeline           scope-checked, requires students:view — merges AuditLog + Comment for this Student

GET    /cases                           scope-filtered, requires cases:view
GET    /cases/:id                       scope-checked, requires cases:view, @Audit('VIEW')
PATCH  /cases/:id/stage                 OWNER-or-GLOBAL only, requires cases:edit, @Audit('EDIT') — free-text stage + department
PATCH  /cases/:id/status                OWNER-or-GLOBAL only, requires cases:edit, @Audit('EDIT') — FSM-validated, excludes CLOSED
PATCH  /cases/:id/close                 OWNER-or-GLOBAL only, requires cases:close, @Audit('ARCHIVE') — closure reason required + open-task guard; Phase 09 adds outstanding-debt/open-Visa/unconfirmed-Enrollment/incomplete-pre-departure-checklist guards (409 OUTSTANDING_DEBT_REMAINS/VISA_IN_PROGRESS/ENROLLMENT_NOT_CONFIRMED/PRE_DEPARTURE_CHECKLIST_INCOMPLETE), see section 11's Phase 09 block
GET    /cases/:id/members               scope-checked, requires cases:view
POST   /cases/:id/members               OWNER-or-GLOBAL only, requires cases:assign, @Audit('ASSIGN')
DELETE /cases/:id/members/:userId       OWNER-or-GLOBAL only, requires cases:assign, @Audit('ASSIGN')
POST   /cases/:id/reassign-owner        OWNER-or-GLOBAL only, requires cases:assign, @Audit('ASSIGN') — Phase 13: true ownership transfer (demotes every prior OWNER CaseMember to COLLABORATOR and updates Case.ownerId atomically), not an additive grant like POST /cases/:id/members with role=OWNER
POST   /cases/:id/notes                 scope-checked, requires cases:edit, @Audit('EDIT')
GET    /cases/:id/timeline              scope-checked, requires cases:view — STUDENT_PARENT sees only 'shared'-visibility notes

GET    /leads                           list — scope-filtered (OWN_LEAD for SALES_MARKETING), requires leads:view
GET    /leads/:id                       scope-checked, requires leads:view, @Audit('VIEW')
POST   /leads                           requires leads:create, @Audit('CREATE'), @Idempotent()
PATCH  /leads/:id                       scope-checked, requires leads:edit, @Audit('EDIT')
PATCH  /leads/:id/status                scope-checked, requires leads:edit, @Audit('EDIT') — FSM-validated, excludes CONVERTED
PATCH  /leads/:id/assign                scope-checked, requires leads:assign, @Audit('EDIT')
POST   /leads/:id/convert               scope-checked, requires leads:convert, @Audit('CREATE'), @Idempotent() — duplicate-detection + merge protocol, see docs/ASSUMPTIONS.md ASM-11/ASM-12
POST   /leads/:id/notes                 scope-checked, requires leads:edit, @Audit('EDIT')
GET    /leads/:id/timeline              scope-checked, requires leads:view

GET    /contracts/export                scope-filtered, redacted, requires contracts:export, @Audit('EXPORT') — reason query param mandatory
GET    /contracts                       list — scope-filtered, redacted, requires contracts:view
GET    /contracts/:id                   scope-checked, redacted, requires contracts:view, @Audit('VIEW')
POST   /contracts                       requires contracts:create, @Audit('CREATE'), @Idempotent() — requires an existing Student, never creates one (docs/ASSUMPTIONS.md ASM-15)
PATCH  /contracts/:id                   scope-checked, requires contracts:edit, @Audit('EDIT') — DRAFT only
POST   /contracts/:id/submit            scope-checked, requires contracts:edit, @Audit('EDIT') — DRAFT -> REVIEW, snapshots approval_threshold
POST   /contracts/:id/approve           scope-checked, requires contracts:approve, @Audit('APPROVE') — REVIEW -> APPROVED; over-threshold requires EXECUTIVE_DIRECTOR (ContractsService.assertApproverAllowed)
POST   /contracts/:id/reject            scope-checked, requires contracts:approve, @Audit('APPROVE') — REVIEW -> DRAFT
POST   /contracts/:id/send              scope-checked, requires contracts:send, @Audit('SHARE') — APPROVED -> SENT, issues a one-time ContractReviewLink token
POST   /contracts/:id/sign              scope-checked, requires contracts:sign, @Audit('EDIT') — SENT -> SIGNED, links Case.contractId (docs/ASSUMPTIONS.md ASM-15)
PATCH  /contracts/:id/status            scope-checked, requires contracts:edit, @Audit('EDIT') — post-sign FSM only (ACTIVE/COMPLETED/LIQUIDATED/ARCHIVED)
GET    /contracts/:id/amendments        scope-checked, requires contracts:view
POST   /contracts/:id/amendments        scope-checked, requires contracts:amend, @Audit('EDIT') — only once signed at least once; rejects a no-op amendment
GET    /public/contracts/review/:token  @Public() — the one unauthenticated route in this API; opaque expiring token, same 404 for invalid/expired/revoked (docs/ASSUMPTIONS.md ASM-02-adjacent secure-link pattern)

GET    /contract-templates              requires contracts:view
GET    /contract-templates/:id          requires contracts:view
POST   /contract-templates              requires contracts:create, @Audit('CREATE')

GET    /payments/export                 scope-filtered, redacted, requires payments:export, @Audit('EXPORT') — reason query param mandatory
GET    /payments/:id                    scope-checked, redacted, requires payments:view, @Audit('VIEW')
POST   /payments/:id/record             scope-checked, requires payments:record, @Audit('EDIT'), @Idempotent() — partial/full/overpayment (allowOverpayment required to exceed the installment amount)
POST   /payments/:id/refund             scope-checked, requires payments:refund, @Audit('EDIT'), @Idempotent() — recorded on the same Payment row (docs/ASSUMPTIONS.md ASM-14)
POST   /payments/:id/waive              scope-checked, requires payments:waive, @Audit('EDIT') — reason mandatory
GET    /contracts/:contractId/payments  scope-checked (via parent Contract), requires payments:view — supports status/overdue filters
POST   /contracts/:contractId/payments  scope-checked (via parent Contract), requires payments:create, @Audit('CREATE'), @Idempotent() — installment schedule entry, only once the contract is signed
POST   /payments/reminders/run          SYSTEM_ADMIN/EXECUTIVE_DIRECTOR only (special-cased roleCode check, same pattern as sessions:revoke-any — see section 2 of docs/security/RBAC_MATRIX.md), @Audit('EDIT') — manual trigger, no scheduler exists yet (docs/ASSUMPTIONS.md ASM-18)

GET    /tasks                           list — scope-filtered (Task reuses Student/Case ROLE_SCOPE, docs/ASSUMPTIONS.md ASM-16), requires tasks:view — mine/overdue/status/module/deadlineFrom/deadlineTo filters cover "My Tasks"/"Team Tasks"/"Overdue"/"Calendar"
GET    /tasks/:id                       scope-checked, requires tasks:view, @Audit('VIEW')
PATCH  /tasks/:id                       owner-or-case-OWNER-or-GLOBAL only, requires tasks:edit, @Audit('EDIT') — generic fields, frozen once DONE/CANCELLED
PATCH  /tasks/:id/status                owner-or-case-OWNER-or-GLOBAL only, requires tasks:edit, @Audit('EDIT') — FSM-validated; BLOCKED requires a blocker reason; DONE requires every dependency DONE/CANCELLED first
PATCH  /tasks/:id/assign                owner-or-case-OWNER-or-GLOBAL only, requires tasks:assign, @Audit('ASSIGN')
GET    /tasks/:id/dependencies          scope-checked, requires tasks:view
POST   /tasks/:id/dependencies          owner-or-case-OWNER-or-GLOBAL only, requires tasks:edit, @Audit('EDIT') — self/circular-dependency rejected server-side
DELETE /tasks/:id/dependencies/:depId   owner-or-case-OWNER-or-GLOBAL only, requires tasks:edit, @Audit('EDIT')
POST   /tasks/reminders/run             SYSTEM_ADMIN/EXECUTIVE_DIRECTOR only, @Audit('EDIT') — manual trigger, no scheduler exists yet (docs/ASSUMPTIONS.md ASM-18)
GET    /cases/:caseId/tasks             scope-checked (via parent Case), requires tasks:view
POST   /cases/:caseId/tasks             scope-checked (via parent Case), requires tasks:create, @Audit('CREATE') — owner defaults to the caller

GET    /task-templates                  requires tasks:view
GET    /task-templates/:id              requires tasks:view
POST   /task-templates                  requires tasks:create, @Audit('CREATE')

GET    /notifications                   self-service — no @RequirePermission, recipientId always === caller (any authenticated role, same as /auth/me)
PATCH  /notifications/:id/read          self-service — 404 if the notification belongs to someone else, never a cross-user read/write path

GET    /users                   SYSTEM_ADMIN/EXECUTIVE_DIRECTOR (view), requires users:view
GET    /users/:id               requires users:view, @Audit('VIEW')
PATCH  /users/:id/suspend       SYSTEM_ADMIN only, requires users:suspend, @Audit('EDIT')
PATCH  /users/:id/reactivate    SYSTEM_ADMIN only, requires users:suspend, @Audit('EDIT')
PATCH  /users/:id/offboard      SYSTEM_ADMIN only, requires users:offboard, @Audit('EDIT')

GET    /audit-logs              EXECUTIVE_DIRECTOR/SYSTEM_ADMIN only, requires audit_logs:view, @Audit('VIEW')

# Phase 07 — Profile Development (Counseling + Documents domains). All entities below
# reuse Student/Case ROLE_SCOPE via ScopePolicyService.assertCaseAccessible — no new scope
# maps (docs/ASSUMPTIONS.md ASM-20) — and the shared requirePrincipal() helper
# (apps/api/src/common/http/require-principal.util.ts).

GET    /cases/:caseId/assessments           scope-checked (via parent Case), requires assessments:view
GET    /assessments/:id                     scope-checked, requires assessments:view, @Audit('VIEW')
POST   /cases/:caseId/assessments           scope-checked, requires assessments:create, @Audit('CREATE') — new version; auto-supersedes a prior APPROVED version in the same transaction; requires change_reason when doing so
PATCH  /assessments/:id                     scope-checked, requires assessments:edit, @Audit('EDIT') — DRAFT/REVIEW only
PUT    /assessments/:id/criteria/:area      scope-checked, requires assessments:edit, @Audit('EDIT') — upsert one AssessmentCriterion row, DRAFT/REVIEW only
POST   /assessments/:id/submit              scope-checked, requires assessments:edit, @Audit('EDIT') — DRAFT -> REVIEW
POST   /assessments/:id/approve             scope-checked, requires assessments:approve, @Audit('APPROVE') — REVIEW -> APPROVED; EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only (never CONSULTANT — separation of duties, docs/ASSUMPTIONS.md ASM-25)
POST   /assessments/:id/reject              scope-checked, requires assessments:approve, @Audit('APPROVE') — REVIEW -> DRAFT

GET    /cases/:caseId/roadmaps              scope-checked (via parent Case), requires roadmaps:view
GET    /roadmaps/:id                        scope-checked, requires roadmaps:view, @Audit('VIEW')
POST   /cases/:caseId/roadmaps               scope-checked, requires roadmaps:create, @Audit('CREATE') — new version
PATCH  /roadmaps/:id                        scope-checked, requires roadmaps:edit, @Audit('EDIT') — DRAFT/REVIEW only
POST   /roadmaps/:id/submit                 scope-checked, requires roadmaps:edit, @Audit('EDIT') — DRAFT -> REVIEW
POST   /roadmaps/:id/approve                scope-checked, requires roadmaps:approve, @Audit('APPROVE') — REVIEW -> APPROVED; ED/DM only, requires an APPROVED baseline Assessment; fires ROADMAP_APPROVED task auto-generation (idempotent, docs/ASSUMPTIONS.md ASM-19)
POST   /roadmaps/:id/reject                 scope-checked, requires roadmaps:approve, @Audit('APPROVE') — REVIEW -> DRAFT
PATCH  /roadmaps/:id/status                 scope-checked, requires roadmaps:edit, @Audit('EDIT') — post-approval FSM only (ACTIVE/COMPLETED/ARCHIVED); ACTIVE requires APPROVED roadmap + APPROVED baseline

GET    /roadmaps/:roadmapId/milestones      scope-checked (via parent Roadmap), requires roadmaps:view
POST   /roadmaps/:roadmapId/milestones      scope-checked, requires roadmaps:edit, @Audit('CREATE') — owner_id validated as a member of the roadmap's Case if set
GET    /milestones/:id                      scope-checked, requires roadmaps:view, @Audit('VIEW')
PATCH  /milestones/:id                      scope-checked, requires roadmaps:edit, @Audit('EDIT')
PATCH  /milestones/:id/status               scope-checked, requires roadmaps:edit, @Audit('EDIT') — FSM-validated; DONE requires every milestone dependency AND every tagged Task to be DONE/CANCELLED first
POST   /milestones/:id/dependencies         scope-checked, requires roadmaps:edit, @Audit('EDIT') — self/circular-dependency rejected server-side
DELETE /milestones/:id/dependencies/:depId  scope-checked, requires roadmaps:edit, @Audit('EDIT')
POST   /milestones/:id/tasks                scope-checked, requires tasks:create, @Audit('CREATE') — Task Engine reuse: ordinary POST /cases/:caseId/tasks with milestone_id set, never a parallel milestone-task concept

GET    /cases/:caseId/academic-records         scope-checked (via parent Case), requires profile_evidence:view
POST   /cases/:caseId/academic-records         scope-checked, requires profile_evidence:create, @Audit('CREATE') — new period is always a new row, never overwrites a prior period
PATCH  /academic-records/:id                   scope-checked, requires profile_evidence:edit, @Audit('EDIT') — correction-in-place on the SAME period only
POST   /academic-records/:id/verify            scope-checked, requires profile_evidence:edit, @Audit('EDIT')
GET    /cases/:caseId/test-records             scope-checked (via parent Case), requires profile_evidence:view
POST   /cases/:caseId/test-records             scope-checked, requires profile_evidence:create, @Audit('CREATE') — new attempt is always a new row; duplicate (case_id, test_type, attempt_number) rejected as DUPLICATE_TEST_ATTEMPT
PATCH  /test-records/:id                       scope-checked, requires profile_evidence:edit, @Audit('EDIT')
POST   /test-records/:id/verify                scope-checked, requires profile_evidence:edit, @Audit('EDIT')
GET    /cases/:caseId/competitions             scope-checked (via parent Case), requires profile_evidence:view
POST   /cases/:caseId/competitions             scope-checked, requires profile_evidence:create, @Audit('CREATE') — one row per participation
PATCH  /competitions/:id                       scope-checked, requires profile_evidence:edit, @Audit('EDIT')
GET    /cases/:caseId/research-projects        scope-checked (via parent Case), requires profile_evidence:view
POST   /cases/:caseId/research-projects        scope-checked, requires profile_evidence:create, @Audit('CREATE')
PATCH  /research-projects/:id                  scope-checked, requires profile_evidence:edit, @Audit('EDIT')
GET    /cases/:caseId/activities               scope-checked (via parent Case), requires profile_evidence:view
POST   /cases/:caseId/activities               scope-checked, requires profile_evidence:create, @Audit('CREATE')
PATCH  /activities/:id                         scope-checked, requires profile_evidence:edit, @Audit('EDIT')
POST   /activities/:id/verify                  scope-checked, requires profile_evidence:edit, @Audit('EDIT')

GET    /cases/:caseId/writing-artifacts        scope-checked (via parent Case), requires writing:view
POST   /cases/:caseId/writing-artifacts        scope-checked, requires writing:create, @Audit('CREATE') — owner defaults to the caller
GET    /writing-artifacts/:id                  scope-checked, requires writing:view, @Audit('VIEW')
PATCH  /writing-artifacts/:id/status           scope-checked, requires writing:edit, @Audit('EDIT') — FSM-validated (Draft->Review->Revision->Final->Submitted); no client-supplied arbitrary status
GET    /writing-artifacts/:id/versions         scope-checked, requires writing:view
POST   /writing-artifacts/:id/versions         scope-checked, requires writing:create, @Audit('CREATE') — always a NEW row (version_number + 1); never overwrites a prior version; reverts a FINAL/SUBMITTED artifact to REVISION
POST   /writing-versions/:id/review            scope-checked, requires writing:edit, @Audit('EDIT') — sets review_status/reviewer_id/reviewed_at only, never content
GET    /writing-versions/:id/comments          scope-checked, requires writing:view — reuses CommentsService/FieldPolicyService.canViewComment, no duplicate ReviewComment entity
POST   /writing-versions/:id/comments          scope-checked, requires writing:edit, @Audit('EDIT')

GET    /cases/:caseId/letters-of-recommendation   scope-checked (via parent Case), requires writing:view — STUDENT_PARENT response field-redacted (FieldPolicyService.redactLor: contact_email/contact_phone/internal_notes nulled)
POST   /cases/:caseId/letters-of-recommendation   scope-checked, requires writing:create, @Audit('CREATE')
PATCH  /letters-of-recommendation/:id             scope-checked, requires writing:edit, @Audit('EDIT')

POST   /documents                    requires documents:create, @Audit('CREATE') — Phase 07 metadata-only slice; see the Phase 12 block below for the real multipart-upload replacement (routes unchanged, request/response shape changed)

# Phase 08 — Admission (Admission domain). University/Program/ScholarshipMaster are GLOBAL
# master data (permission-gated only, no ScopeKind check — same treatment as
# ContractTemplate/TaskTemplate). UniversityChoice/Application/Offer/ScholarshipApplication
# reuse Student/Case ROLE_SCOPE via ScopePolicyService.assertCaseAccessible/
# assertStudentAccessible — no new scope map (docs/ASSUMPTIONS.md ASM-20/ASM-28).

GET    /universities                     requires admission_master:view — search/countryCode/status filters + pagination
GET    /universities/:id                 requires admission_master:view
POST   /universities                     requires admission_master:create, @Audit('CREATE') — rejects a duplicate (official_name, country_code) pair as 409 DUPLICATE_UNIVERSITY
PATCH  /universities/:id                 requires admission_master:edit, @Audit('EDIT')
POST   /universities/:id/verify          requires admission_master:verify, @Audit('EDIT') — stamps last_verified_at only, its own permission distinct from edit

GET    /programs                         requires admission_master:view — search/universityId/degreeLevel/status filters + pagination
GET    /programs/:id                     requires admission_master:view
POST   /programs                         requires admission_master:create, @Audit('CREATE') — requires an existing University; rejects a duplicate (university, degree, major, intake) as 409 DUPLICATE_PROGRAM
PATCH  /programs/:id                     requires admission_master:edit, @Audit('EDIT')
POST   /programs/:id/verify              requires admission_master:verify, @Audit('EDIT')

GET    /scholarship-masters              requires admission_master:view — search/universityId/programId/status filters + pagination
GET    /scholarship-masters/:id          requires admission_master:view
POST   /scholarship-masters              requires admission_master:create, @Audit('CREATE') — rejects a duplicate (provider, name, university, program) as 409 DUPLICATE_SCHOLARSHIP_MASTER
PATCH  /scholarship-masters/:id          requires admission_master:edit, @Audit('EDIT')
POST   /scholarship-masters/:id/verify   requires admission_master:verify, @Audit('EDIT')

GET    /students/:studentId/university-choices   scope-checked (assertStudentAccessible), requires university_choices:view
POST   /students/:studentId/university-choices   scope-checked, requires university_choices:create, @Audit('CREATE') — rejects a duplicate (student, program) as 409 DUPLICATE_UNIVERSITY_CHOICE
GET    /university-choices/:id                   scope-checked (case_id if set, else student_id), requires university_choices:view, @Audit('VIEW')
PATCH  /university-choices/:id                    scope-checked, requires university_choices:edit, @Audit('EDIT')
POST   /university-choices/:id/review             scope-checked, requires university_choices:edit, @Audit('EDIT') — stamps reviewed_by_id/reviewed_at only

GET    /cases/:caseId/applications       scope-checked (via parent Case), requires applications:view — status filter + pagination
POST   /cases/:caseId/applications       scope-checked, requires applications:create, @Audit('CREATE') — rejects an active (student, program, intake) duplicate as 409 ACTIVE_APPLICATION_EXISTS, docs/DECISIONS.md DEC-05
GET    /applications/:id                 scope-checked, requires applications:view, @Audit('VIEW')
PATCH  /applications/:id                 scope-checked, requires applications:edit, @Audit('EDIT') — generic fields, frozen once WITHDRAWN
POST   /applications/:id/submit          scope-checked, requires applications:edit, @Audit('EDIT') — READY_FOR_REVIEW -> SUBMITTED, requires every required checklist item DONE/WAIVED (409 CHECKLIST_INCOMPLETE otherwise); fires APPLICATION_SUBMITTED task-generation + notification
PATCH  /applications/:id/status          scope-checked, requires applications:edit, @Audit('EDIT') — FSM-validated; excludes SUBMITTED (its own action) and OFFER (reachable only via POST .../offers)

GET    /applications/:applicationId/checklist        scope-checked (via parent Application), requires applications:view
POST   /applications/:applicationId/checklist        scope-checked, requires applications:create, @Audit('CREATE')
PATCH  /checklist-items/:id                          scope-checked (via parent Application), requires applications:edit, @Audit('EDIT')

GET    /applications/:applicationId/offers           scope-checked (via parent Application), requires offers:view
GET    /applications/:applicationId/offers/current    scope-checked, requires offers:view — the ACCEPTED offer if any, else the most recent non-expired RECEIVED one, else null
POST   /applications/:applicationId/offers            scope-checked, requires offers:create, @Audit('CREATE') — requires Application status SUBMITTED/WAITLIST/OFFER (409 OFFER_REQUIRES_SUBMITTED_APPLICATION otherwise); transitions the Application to OFFER
GET    /offers/:id                                    scope-checked (via parent Application), requires offers:view, @Audit('VIEW') — lazily syncs RECEIVED -> EXPIRED past acceptance_deadline on read
POST   /offers/:id/respond                            scope-checked, requires offers:edit, @Audit('EDIT') — RECEIVED only, ACCEPT/DECLINE

GET    /cases/:caseId/scholarship-applications        scope-checked (via parent Case), requires scholarship_applications:view — response field-redacted (FieldPolicyService.redactScholarshipApplication: internal_notes nulled for STUDENT_PARENT)
POST   /cases/:caseId/scholarship-applications        scope-checked, requires scholarship_applications:create, @Audit('CREATE')
GET    /scholarship-applications/:id                  scope-checked, requires scholarship_applications:view, @Audit('VIEW') — same field redaction
PATCH  /scholarship-applications/:id                  scope-checked, requires scholarship_applications:edit, @Audit('EDIT') — frozen once AWARDED/REJECTED/WITHDRAWN
POST   /scholarship-applications/:id/confirm-eligibility   scope-checked, requires scholarship_applications:edit, @Audit('EDIT') — required before SUBMITTED (409 ELIGIBILITY_NOT_CONFIRMED otherwise)
PATCH  /scholarship-applications/:id/status           scope-checked, requires scholarship_applications:edit, @Audit('EDIT') — FSM-validated; excludes AWARDED/REJECTED (their own dedicated actions)
POST   /scholarship-applications/:id/award            scope-checked, requires scholarship_applications:edit, @Audit('EDIT') — UNDER_REVIEW/INTERVIEW only; records award amount/currency/coverage/period/acceptance-deadline/evidence together; fires SCHOLARSHIP_AWARDED task-generation + notification
POST   /scholarship-applications/:id/reject           scope-checked, requires scholarship_applications:edit, @Audit('EDIT') — UNDER_REVIEW/INTERVIEW only

# Phase 09 — Visa (Visa domain: Visa/VisaChecklistTemplate/VisaChecklistItem/Enrollment).
# VisaChecklistTemplate is GLOBAL master data (permission-gated only, same treatment as
# University/Program/ScholarshipMaster). Visa/Enrollment reuse Student/Case ROLE_SCOPE via
# ScopePolicyService.assertCaseAccessible — no new scope map (docs/ASSUMPTIONS.md ASM-37).
# Visa/Enrollment responses are field-redacted (FieldPolicyService.redactVisa/
# redactEnrollment: internal_notes nulled for STUDENT_PARENT, docs/ASSUMPTIONS.md ASM-38).

GET    /visa-checklist-templates              requires visa_checklist_templates:view — countryCode/visaType/active filters + pagination
GET    /visa-checklist-templates/:id          requires visa_checklist_templates:view
POST   /visa-checklist-templates              requires visa_checklist_templates:create, @Audit('CREATE') — rejects a duplicate (country_code, visa_type, title) as 409 DUPLICATE_VISA_CHECKLIST_TEMPLATE
PATCH  /visa-checklist-templates/:id          requires visa_checklist_templates:edit, @Audit('EDIT')

GET    /cases/:caseId/visas               scope-checked (via parent Case), requires visa:view — status filter + pagination
POST   /cases/:caseId/visas               scope-checked, requires visa:create, @Audit('CREATE') — rejects a non-terminal duplicate as 409 ACTIVE_VISA_EXISTS; instantiates matching VisaChecklistTemplate rows once
GET    /visas/:id                         scope-checked, requires visa:view, @Audit('VIEW') — field-redacted
PATCH  /visas/:id                         scope-checked, requires visa:edit, @Audit('EDIT') — generic fields, frozen once GRANTED/REFUSED/WITHDRAWN
POST   /visas/:id/submit                  scope-checked, requires visa:edit, @Audit('EDIT') — requires every required checklist item DONE/WAIVED (409 CHECKLIST_INCOMPLETE otherwise); records submission evidence/reference; fires VISA_SUBMITTED notification
POST   /visas/:id/appointment             scope-checked, requires visa:edit, @Audit('EDIT') — records appointment date/location/reference; fires VISA_APPOINTMENT_SCHEDULED notification
POST   /visas/:id/interview               scope-checked, requires visa:edit, @Audit('EDIT') — records interview date/notes
POST   /visas/:id/result                  scope-checked, requires visa:edit, @Audit('EDIT') — GRANTED or REFUSED only, requires result evidence + date; fires VISA_GRANTED task-generation (GRANTED only) + VISA_RESULT notification (both)

GET    /visas/:visaId/checklist               scope-checked (via parent Visa), requires visa:view
POST   /visas/:visaId/checklist               scope-checked, requires visa:create, @Audit('CREATE')
PATCH  /visa-checklist-items/:id              scope-checked (via parent Visa), requires visa:edit, @Audit('EDIT')

GET    /cases/:caseId/pre-departure           scope-checked (via parent Case), requires pre_departure:view
POST   /cases/:caseId/pre-departure           scope-checked, requires pre_departure:create, @Audit('CREATE') — free-text category, never a hard-coded enum
PATCH  /pre-departure-items/:id               scope-checked (via parent Case), requires pre_departure:edit, @Audit('EDIT')

GET    /cases/:caseId/enrollments         scope-checked (via parent Case), requires enrollment:view
POST   /cases/:caseId/enrollments         scope-checked, requires enrollment:create, @Audit('CREATE') — target Offer must belong to the Case and be ACCEPTED (409 INVALID_ENROLLMENT_TARGET otherwise); university_id/program_id derived server-side from the Offer's Program, never client input
GET    /enrollments/:id                   scope-checked, requires enrollment:view, @Audit('VIEW') — field-redacted
PATCH  /enrollments/:id                   scope-checked, requires enrollment:edit, @Audit('EDIT') — generic fields, frozen once CONFIRMED/WITHDRAWN
POST   /enrollments/:id/confirm           scope-checked, requires enrollment:edit, @Audit('EDIT') — rejects a second CONFIRMED enrollment for the same Case as 409 CONFIRMED_ENROLLMENT_EXISTS; records confirmation date/evidence
POST   /enrollments/:id/withdraw          scope-checked, requires enrollment:edit, @Audit('EDIT') — frees the Case for a new Enrollment attempt

# Phase 10 — Partner CRM + Commission (Partners domain: Partner/PartnerProgram/
# PartnerDocument/PartnerStudentLink/CommissionRule/CommissionTransaction). GLOBAL,
# permission-gated only for all six resources — no ScopeKind check, no Case-membership
# layer (docs/ASSUMPTIONS.md ASM-43). PartnerDocument reuses the Document subsystem
# (documentId real FK) via the new DocumentsService.grantRoleAccess. CommissionTransaction
# money math is Prisma.Decimal-only throughout; the client never supplies a final amount.

GET    /partners                          requires partner:view — type/countryCode/status filters + pagination + search
GET    /partners/:id                      requires partner:view, @Audit('VIEW') — field-redacted (internalNotes)
POST   /partners                          requires partner:create, @Audit('CREATE') — rejects a duplicate (name, countryCode) as 409 DUPLICATE_PARTNER
PATCH  /partners/:id                      requires partner:edit, @Audit('EDIT')
POST   /partners/:id/archive              requires partner:edit, @Audit('ARCHIVE') — status -> INACTIVE, no hard-delete

GET    /partners/:partnerId/programs          requires partner_programs:view — status/programId filters + pagination
POST   /partners/:partnerId/programs          requires partner_programs:create, @Audit('CREATE') — rejects a duplicate (name, degree, major, intake) as 409 DUPLICATE_PARTNER_PROGRAM; optional programId must reference an existing Program (404 otherwise)
GET    /partner-programs/:id                  requires partner_programs:view, @Audit('VIEW')
PATCH  /partner-programs/:id                  requires partner_programs:edit, @Audit('EDIT')
POST   /partner-programs/:id/archive          requires partner_programs:edit, @Audit('ARCHIVE')

GET    /partners/:partnerId/documents         requires partner_documents:view — type/status filters + pagination; lazily syncs ACTIVE -> EXPIRED past expiryDate on read
POST   /partners/:partnerId/documents         requires partner_documents:create, @Audit('CREATE') — documentId must reference an existing Document (never creates one); version auto-increments per (partner, type)
GET    /partner-documents/:id                 requires partner_documents:view, @Audit('VIEW')
PATCH  /partner-documents/:id                 requires partner_documents:edit, @Audit('EDIT') — DRAFT only (409 PARTNER_DOCUMENT_NOT_EDITABLE otherwise), "Không overwrite signed/final partner documents"
POST   /partner-documents/:id/activate        requires partner_documents:edit, @Audit('EDIT') — DRAFT -> ACTIVE, atomically supersedes the prior ACTIVE version for the same (partner, type)
POST   /partner-documents/:id/archive         requires partner_documents:edit, @Audit('ARCHIVE')

GET    /partners/:partnerId/student-links     requires partner_student_links:view — status filter + pagination
POST   /partners/:partnerId/student-links     requires partner_student_links:create, @Audit('CREATE') — validates Student/Case/Application ownership; rejects a duplicate ACTIVE (partner, student, case, application) tuple as 409 DUPLICATE_PARTNER_STUDENT_LINK
GET    /students/:studentId/partner-links     requires partner_student_links:view — the same links, listed from the Student side
GET    /partner-student-links/:id             requires partner_student_links:view, @Audit('VIEW')
PATCH  /partner-student-links/:id             requires partner_student_links:edit, @Audit('EDIT') — ACTIVE only
POST   /partner-student-links/:id/archive     requires partner_student_links:edit, @Audit('ARCHIVE') — frees the tuple for a new link

GET    /partners/:partnerId/commission-rules      requires commission_rules:view — partnerProgramId/basis/status filters + pagination
POST   /partners/:partnerId/commission-rules      requires commission_rules:create, @Audit('CREATE') — basis/rate cross-validated server-side (400 FIXED_AMOUNT_REQUIRED/PERCENTAGE_RATE_REQUIRED/etc.); negative rate/amount always rejected
GET    /commission-rules/:id                      requires commission_rules:view, @Audit('VIEW')
PATCH  /commission-rules/:id                      requires commission_rules:edit, @Audit('EDIT')
POST   /commission-rules/:id/activate             requires commission_rules:edit, @Audit('EDIT')
POST   /commission-rules/:id/deactivate           requires commission_rules:edit, @Audit('EDIT')

GET    /commission-transactions                   requires commission_transactions:view — status/partnerId filters + pagination
GET    /partners/:partnerId/commission-transactions   requires commission_transactions:view — same, scoped to one partner
POST   /partners/:partnerId/commission-transactions   requires commission_transactions:create, @Audit('CREATE') — resolves + snapshots a matching CommissionRule via deterministic precedence (404 COMMISSION_RULE_NOT_FOUND if none matches); rejects a duplicate non-cancelled transaction for the same (sourceType, sourceId, rule) as 409 DUPLICATE_COMMISSION_TRANSACTION
GET    /commission-transactions/:id               requires commission_transactions:view, @Audit('VIEW')
PATCH  /commission-transactions/:id               requires commission_transactions:edit, @Audit('EDIT') — linkage fields only (studentId/caseId/applicationId), PENDING only
POST   /commission-transactions/:id/confirm-eligibility  requires commission_transactions:edit, @Audit('EDIT') — PENDING -> ELIGIBLE
POST   /commission-transactions/:id/calculate             requires commission_transactions:edit, @Audit('EDIT') — ELIGIBLE -> CALCULATED; reads the live Contract/Payment source amount, Prisma.Decimal math only, rejects a currency mismatch as 409 CURRENCY_MISMATCH
POST   /commission-transactions/:id/approve               requires commission_transactions:edit, @Audit('EDIT') — CALCULATED -> APPROVED
POST   /commission-transactions/:id/mark-payable          requires commission_transactions:edit, @Audit('EDIT') — APPROVED -> PAYABLE
POST   /commission-transactions/:id/pay                   requires commission_transactions:edit, @Audit('EDIT') — PAYABLE -> PAID, terminal; records paymentReference/paidAt
POST   /commission-transactions/:id/cancel                requires commission_transactions:edit, @Audit('EDIT') — any non-terminal state -> CANCELLED, terminal; requires a reason

# Phase 11 — Student/Parent Portal. StudentContactsController manages the parent
# relationship (staff-facing, gated by students:view/edit — a StudentContact is a
# sub-resource of Student, no new permission resource for it). PublicParentInvitationsController
# is the one deliberately unauthenticated route in this module — the token itself IS the
# authorization, same pattern as PublicContractReviewController (Phase 05). PortalController
# is class-level gated by the single new portal:access permission (granted only to
# STUDENT_PARENT) — real record-scope authorization is ScopePolicyService's revocation-aware
# OWN_STUDENT check underneath, resolved server-side per request, never client-supplied.
# Every Portal method thinly delegates to the existing Phase 05-10 domain services (their
# existing scope checks + field-redaction), no duplicated business logic anywhere.

GET    /students/:studentId/contacts                      requires students:view
POST   /students/:studentId/contacts                       requires students:edit, @Audit('CREATE')
POST   /students/:studentId/contacts/:contactId/invite      requires students:edit, @Audit('INVITE') — creates a ParentInvitation (token hash-only), portal_status -> INVITED
POST   /students/:studentId/contacts/:contactId/revoke      requires students:edit, @Audit('REVOKE') — portal_status -> REVOKED; expires all the linked user's non-expired DocumentAccess grants in the same transaction

POST   /public/portal/parent-invitations/:token/accept     @Public(), @Audit('VERIFY') — validates not accepted/revoked/expired; reuses an existing User by email match (STUDENT_PARENT role) or creates one; portal_status -> ACTIVE

GET    /portal/me                                          requires portal:access — resolves self (Student.portalUserId) + linked-ACTIVE students (StudentContact) for the caller, server-side only
GET    /portal/students/:id                                 requires portal:access, @Audit('VIEW') — read-only profile, field-redacted
GET    /portal/students/:id/roadmap                         requires portal:access — reuses RoadmapsService, derived progress % only, never stored
POST   /portal/students/:id/roadmap/milestones/:milestoneId/evidence   requires portal:access, @Audit('EDIT') — narrow MilestonesService.submitEvidence (documentId only), verifies the document was uploaded by the caller
GET    /portal/students/:id/tasks                            requires portal:access — TasksService.listForStudentPortal, visibleToStudent: true only
GET    /portal/students/:id/tasks/:taskId                    requires portal:access, @Audit('VIEW') — 404 unless visibleToStudent; blocker/qualityScore/ownerId redacted
PATCH  /portal/students/:id/tasks/:taskId/output             requires portal:access, @Audit('EDIT') — output field only
POST   /portal/students/:id/tasks/:taskId/status              requires portal:access, @Audit('EDIT') — IN_PROGRESS/DONE only (narrower than staff TaskStatus), same FSM as staff updateStatus
GET    /portal/students/:id/documents                        requires portal:access — DocumentsService.listAccessibleTo (own grants only, never an owner-entity scan)
GET    /portal/students/:id/documents/:documentId/download    requires portal:access, @Audit('DOWNLOAD')
GET    /portal/students/:id/applications                     requires portal:access
GET    /portal/students/:id/applications/:applicationId       requires portal:access, @Audit('VIEW') — +checklist+currentOffer aggregation, internal notes/strategy/reviewer comments excluded
POST   /portal/students/:id/applications/checklist/:checklistItemId/evidence   requires portal:access, @Audit('EDIT') — narrow ApplicationChecklistService.submitEvidence (documentId only)
GET    /portal/students/:id/scholarships                     requires portal:access — internalNotes/commission excluded
GET    /portal/students/:id/scholarships/:scholarshipApplicationId   requires portal:access, @Audit('VIEW')
GET    /portal/students/:id/visa                             requires portal:access — internalNotes excluded
GET    /portal/students/:id/visa/:visaId                      requires portal:access, @Audit('VIEW')
GET    /portal/students/:id/pre-departure                     requires portal:access
GET    /portal/students/:id/enrollment                        requires portal:access
GET    /portal/students/:id/contracts                         requires portal:access — internal approval/notes/commission excluded
GET    /portal/students/:id/contracts/:contractId/payments     requires portal:access — Payment is the source of truth, no client-side balance calculation
GET    /portal/students/:id/notifications                     requires portal:access — pure passthrough to NotificationsService.listInbox, already recipient-scoped

# Phase 12 — Platform (Documents real storage/scan/versioning, Background Jobs, Reporting,
# Webhooks). POST/GET /documents* routes are unchanged from Phase 07 (same permission
# gates, same audit actions) — only the request/response SHAPE changed: POST /documents is
# now multipart/form-data (a `file` field + ownerEntity/ownerId/documentType/title text
# fields), never a JSON fileReference. Download is a two-step signed-URL flow.

POST   /documents                          requires documents:create, @Audit('CREATE') — multipart upload; server validates MIME/extension/magic-bytes/size, computes checksum, stores via StorageProvider, enqueues an async DOCUMENT_SCAN job (scanStatus starts PENDING)
GET    /documents/:id                      requires documents:view, grant-checked, @Audit('VIEW')
PATCH  /documents/:id                      requires documents:edit, grant-checked, @Audit('EDIT') — metadata only (title/documentType); 409 DOCUMENT_ARCHIVED once archived
POST   /documents/:id/share                requires documents:share, grant-checked, @Audit('SHARE') — grants VIEW/DOWNLOAD to another principalId
POST   /documents/:id/archive              requires documents:archive, grant-checked, @Audit('ARCHIVE')
POST   /documents/:id/versions             requires documents:edit, grant-checked, @Audit('EDIT') — multipart upload of a NEW file; creates a brand-new Document row chained via previousVersionId, copies forward existing grants; 409 DOCUMENT_ARCHIVED if the row being versioned is archived
GET    /documents/:id/download             requires documents:download, grant-checked, @Audit('DOWNLOAD') — authorizes, checks scanStatus=CLEAN (else 403 DOCUMENT_NOT_READY), returns a short-lived signed { downloadUrl }, never the bytes directly
GET    /documents/download/:token          @Public() — the byte-serving endpoint; the signed token IS the authorization (re-verified: signature/expiry/live grant/live scanStatus), same "token possession" pattern as ContractReviewLink/ParentInvitation

GET    /admin/jobs                         requires jobs:view (SYSTEM_ADMIN only) — job status list, optional jobType/status filters
GET    /admin/jobs/:id                     requires jobs:view, @Audit('VIEW')

POST   /webhooks/esign                     @Public(), @Audit('CREATE') — HMAC signature verified against the raw request body (x-webhook-signature header); (source, eventId) uniqueness is the idempotency/replay-protection mechanism; never mutates business data, only records+audits the event (docs/ASSUMPTIONS.md ASM-53)

GET    /reports/executive                  requires reports:view (further narrowed to EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER inside ReportsService) — active cases/pipeline/revenue/receivables/overdue/applications/scholarships/visas/enrollments/closure, all computed live from existing source-of-truth tables
GET    /reports/manager                    requires reports:view (ED/DM only) — per-consultant workload/overdue/on-time-completion-rate/average-quality-score
GET    /reports/me                         requires reports:view (every staff role) — self-scoped "my open cases/tasks/overdue tasks," reuses the same ScopePolicyService filters every other list endpoint applies
GET    /reports/cases/export               requires reports:export (ED/DM only), @Audit('EXPORT') — reason required (SRS 6.21: reason/filterScope/rowCount/fields recorded), scope-filtered via the same ScopePolicyService.caseListFilter every Case list endpoint uses

POST   /auth/login, /auth/mfa/login-verify, /auth/refresh, /auth/logout,
       /auth/password-reset/request, /auth/password-reset/confirm,
       /auth/mfa/enroll, /auth/mfa/enroll/confirm,
       /auth/sessions/:id/revoke, /auth/sessions/revoke-all
GET    /auth/me, /auth/sessions
```

See `docs/security/AUTH_MODEL.md` and `docs/security/RBAC_MATRIX.md` for the auth/RBAC
endpoints — this section only covers where they slot into the API-foundation conventions.

Duplicate-detection on lead-to-student conversion (SRS 6.2: match email/phone/name+DOB,
staff confirms merge) is implemented on `POST /leads/:id/convert`
(`DuplicateDetectionService`), not on the generic `POST /students` reference endpoint —
`POST /students` remains a raw creation primitive as documented since Phase 02; Lead
conversion is the one path SRS actually requires duplicate-checking on.
