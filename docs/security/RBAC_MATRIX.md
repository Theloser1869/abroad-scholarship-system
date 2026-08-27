# RBAC MATRIX — Phase 03B, extended by Phase 04 (Core CRM), Phase 05 (Commercial), Phase 06 (Operations), Phase 07 (Profile Development), Phase 08 (Admission), Phase 09 (Visa), Phase 10 (Partner CRM + Commission), Phase 11 (Student/Parent Portal), Phase 12 (Platform), and Phase 13 (QA/Security fixes — no new resources/roles, see `docs/security/SECURITY_TEST_REPORT.md`)

Source of truth for the actual grants: `database/seeds/seed.ts` (`GRANTS` constant) for
role→permission, and `apps/api/src/modules/identity/rbac/scope-policy.service.ts`
(`ROLE_SCOPE` / `LEAD_ROLE_SCOPE` / `CONTRACT_ROLE_SCOPE` constants) for role→record-scope.
This document is the human-readable rendering of both; if they disagree, the code is
correct — fix this document to match. `Notification` has no permission of its own — its
inbox is self-service for every authenticated role, not a role-gated resource; see the end
of section 2.

## 1. How to read this

Every authorization decision in this system is the AND of three independent layers,
checked in this order:

1. **Authentication** (`AuthContextMiddleware`) — is there a valid, non-revoked session at
   all? No → `401 UNAUTHENTICATED`.
2. **Role → permission** (`AuthGuard` + `@RequirePermission(resource, action)`) — does the
   caller's role have this (resource, action) pair granted at all, with zero knowledge of
   *which* record? No → `403 PERMISSION_DENIED`.
3. **Record scope** (`ScopePolicyService`, called from the resource's own service layer,
   e.g. `StudentsService`) — of the records the caller's role can act on in principle, is
   *this specific* record one of them? No → `404 NOT_FOUND` (deliberately not `403` — see
   section 3).

Field-level redaction (`FieldPolicyService`) is a fourth, orthogonal layer applied to the
response body of a record that already passed layers 1–3 — see section 5.

## 2. Roles → base permissions

| Role | leads | students | cases | **case-closure** | contracts | payments | tasks | assessments | roadmaps | profile_evidence | school_master | writing | documents | admission_master | university_choices | applications | offers | scholarship_applications | visa | visa_checklist_templates | pre_departure | enrollment | partner | partner_programs | partner_documents | partner_student_links | commission_rules | commission_transactions | reports | portal | jobs | users | audit_logs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EXECUTIVE_DIRECTOR | view, create, edit, assign, convert | view, create, edit, archive, export | view, edit, assign | view, execute | view, create, edit, approve, send, sign, amend, export | view, export | view, create, edit, assign | view, create, edit, approve | view, create, edit, approve | view, create, edit | view, create, edit | view, create, edit | view, create, download, edit, share, archive | view, create, edit, verify | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, export | — | — | view | view |
| DEPARTMENT_MANAGER | view, create, edit, assign, convert | view, create, edit, archive, export | view, edit, assign | view, execute | view, create, edit, approve, send, sign, amend, export | view, export | view, create, edit, assign | view, create, edit, approve | view, create, edit, approve | view, create, edit | view, create, edit | view, create, edit | view, create, download, edit, share, archive | view, create, edit, verify | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, export | — | — | — | — |
| CONSULTANT | — | view, edit | view, edit, assign | view, request | — | — | view, create, edit, assign | view, create, edit | view, create, edit | view, create, edit | view | view, create, edit | view, create, download, edit, share, archive | view | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view, create, edit | view | view, create, edit | view, create, edit | — | — | — | — | — | — | view | — | — | — | — |
| DOCUMENT_SPECIALIST | — | view | view | — | — | — | view, create, edit, assign | view | view | view | view | view | view, create, download, edit, share, archive | view | view | view, create, edit | view | view | view, create, edit | view | view, create, edit | view | view | — | view | — | — | — | view | — | — | — | — |
| SALES_MARKETING | view, create, edit, assign, convert | — | — | — | — | — | — | — | — | — | — | — | — | view | — | — | — | — | — | view | — | — | — | — | — | — | — | — | view | — | — | — | — |
| ADMIN_FINANCE | — | — | — | view, execute | view, create, edit, send, sign, export | view, create, record, refund, waive, export | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | view | view | view | view | view, create, edit | view, create, edit | view | — | — | — | — |
| STUDENT_PARENT | — | view | view | — | view | view | — | view | view | view | — | view | view, download | view | view | view | view | view | view | view | view | view | — | — | — | — | — | — | — | access | — | — | — |
| SYSTEM_ADMIN | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | view | view, suspend, offboard | view |

**`notifications`** is not a column here — every authenticated role reads/marks-read only
its **own** inbox (`NotificationsService` enforces `recipientId === principal.userId`
unconditionally), the same self-service pattern as `/auth/me`/`/auth/sessions`: no
`@RequirePermission` decorator on `NotificationsController` at all, since `AuthGuard`
already allows any authenticated principal through when a route declares none.

Notes:
- **SALES_MARKETING's grant is now `leads:*` (Phase 04)**, still zero `students`/`cases`
  grant — SRS section 3 excludes it from Student profile access ("Sale/Mkt: Không passport,
  tài chính, visa, tài liệu nhạy cảm"); Lead/CRM is its whole domain. **It also gets zero
  `contracts`/`payments` grant (Phase 05)** — 05-commercial explicitly forbids Lead access
  implying Contract/Payment access: "Sales/Marketing không được tự động có quyền đọc
  Contract/Payment chỉ vì có quyền Lead."
- **CONSULTANT/DOCUMENT_SPECIALIST get zero `contracts`/`payments` grant (Phase 05)**,
  despite both holding `students`/`cases:view` — 05-commercial: "Consultant không được xem
  các financial fields nếu RBAC không cho phép." Financial data does not follow from Case
  membership; see `CONTRACT_ROLE_SCOPE` in section 3 (deliberately a separate map from
  Student/Case's `ROLE_SCOPE`, not derived from it).
- **ADMIN_FINANCE (Phase 05) is `contracts`/`payments`-only** — SRS: "HCTH: Hợp đồng, phụ
  lục, payment, công nợ, thanh lý" is its entire domain (still zero `students`/`cases`
  grant — day-to-day contract processing and full payment execution, but deliberately no
  `contracts:approve`/`amend`: final approval and material term changes stay an
  ED/Department-Manager decision.
- **EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER get full `contracts:*` (including `approve`) but
  only `payments:view`/`export`** — oversight without being the day-to-day cashier; payment
  execution (`create`/`record`/`refund`/`waive`) stays with ADMIN_FINANCE.
  `ContractsService.assertApproverAllowed` further narrows *which* of these two may approve
  a specific contract once its value is at/above the snapshotted monetary threshold — only
  EXECUTIVE_DIRECTOR may (SRS 6.16); see section 4.
- **Phase 07 (`assessments`/`roadmaps`/`profile_evidence`/`writing`/`documents`)**:
  `profile_evidence` groups AcademicRecord/TestRecord/Competition/ResearchProject/Activity
  and `writing` groups WritingArtifact/WritingVersion/LetterOfRecommendation — one resource
  per instruction-file grouping, not one per entity (`docs/ASSUMPTIONS.md` ASM-21).
  CONSULTANT gets full `view/create/edit` on all four counseling resources but never
  `approve` (separation of duties, same reasoning as Contract approval — `docs/
  ASSUMPTIONS.md` ASM-25); only EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER hold `assessments:
  approve`/`roadmaps:approve`. DOCUMENT_SPECIALIST is view-only on the four counseling
  resources (its SRS domain is Document/Application/Scholarship/Visa, not counseling) but
  gets full `documents:view/create/download` — Document genuinely is its domain.
  STUDENT_PARENT is view-only across all five, own case only — extends ASM-09's
  self-service-editing-is-Phase-11 precedent. SALES_MARKETING/ADMIN_FINANCE/SYSTEM_ADMIN
  get zero grant on all five, consistent with their existing Student/Case treatment.
- **CONSULTANT's `cases:edit/assign/close` grants are narrowed further by
  `CasesService.assertManageable`**: the role-level grant only proves CONSULTANT *may*
  attempt these actions; whether a specific case is manageable additionally requires the
  caller to be that case's `OWNER` CaseMember, not just a `COLLABORATOR` — see section 3.
- **DOCUMENT_SPECIALIST does not get `cases:edit/assign/close`** — narrower than
  CONSULTANT by design (SRS: "Hồ sơ" role centers on Document/Application, not case
  stage/ownership management). **It DOES get full `tasks:view/create/edit/assign`, at
  parity with CONSULTANT (Phase 06)** — Task *execution* is a different capability from
  Case *management*; `TasksService.requireManageable` still prevents either role from
  managing a task they neither own nor are the case's OWNER member for, regardless of this
  base grant — see `docs/ASSUMPTIONS.md` ASM-16.
- **STUDENT_PARENT gets zero `tasks:*` grant (Phase 06)** — Task Engine is internal staff
  tooling in this phase; a task's `blocker`/`output` free text is the same class of
  internal-commentary content SRS §13 restricts from Student/Parent as "Internal notes."
  See `docs/ASSUMPTIONS.md` ASM-16.
- **Task reuses `ROLE_SCOPE`** (section 3) rather than a fourth per-resource scope map —
  06-operations/01_TASK.md's own wording ("task phải thuộc đúng Student/Case scope") names
  the existing Student/Case scope concept, not a new Task-specific one; see
  `docs/ASSUMPTIONS.md` ASM-16.
- **SYSTEM_ADMIN has zero `students`/`cases`/`leads` grants** — SRS section 3: "System
  Admin... Không mặc định được đọc nội dung hồ sơ nhạy cảm nếu không được cấp business
  permission." Identity/audit administration only.
- **EXECUTIVE_DIRECTOR gets `users:view` but not `users:suspend`/`users:offboard`** —
  separation of duties: SRS assigns "User/Role/Permission/Configuration/Monitoring"
  specifically to System Admin. GĐĐH can see the user list (oversight, matches "Xem toàn
  bộ; dashboard") but cannot action it.
- **STUDENT_PARENT has `students:view`/`cases:view` but no `edit`, and no `leads:*` at
  all** — see `docs/ASSUMPTIONS.md` ASM-09; self-service editing is Phase 11 (Portal)
  scope. Leads are a pre-conversion sales artifact a student/parent never sees.
- **`sessions:revoke-any`** (an admin overriding another user's session revocation) is
  *not* in this table — it's a special-cased `roleCode === 'SYSTEM_ADMIN'` check directly
  in `AuthController.revokeSession`, not a RolePermission-driven grant. Documented here so
  it isn't mistaken for an oversight; it's a narrow, single-purpose exception rather than a
  fifth resource in the permission matrix for one action.
- **Phase 08 (`admission_master`/`university_choices`/`applications`/`offers`/
  `scholarship_applications`)**: `admission_master` groups University/Program/
  ScholarshipMaster (one resource per 01_MASTER_DATA.md's own grouping, plus its own
  `verify` action for source/verification fields); `applications` groups Application +
  ApplicationChecklist (02_APPLICATION.md's own grouping) — see `docs/ASSUMPTIONS.md`
  ASM-31. Master-data **curation** (`admission_master:create/edit/verify`) is
  EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER-only — CONSULTANT gets only `admission_master:
  view` ("Consultant có thể sử dụng Program nhưng không nhất thiết được chỉnh tuition"),
  full `view/create/edit` on the four case-scoped transaction resources instead (its
  counseling-execution domain). DOCUMENT_SPECIALIST gets full `view/create/edit` on
  `applications` only (its actual document-processing domain — checklist management) and
  `view` on the rest. SALES_MARKETING gets `admission_master:view` only — a university's
  own published catalog, not student-linked sensitive data — and zero on the four
  transaction resources ("Sales/Marketing không mặc nhiên được xem application/visa-
  sensitive data"). STUDENT_PARENT is view-only across all five, own case only. ADMIN_
  FINANCE/SYSTEM_ADMIN get zero grant on all five, consistent with Phase 07's precedent.
- **Phase 09 (`visa`/`visa_checklist_templates`/`pre_departure`/`enrollment`)**: `visa`
  covers Visa + its Visa-scoped checklist items (01_VISA.md's own grouping);
  `visa_checklist_templates` is the country+visa-type configurable master data — see
  `docs/ASSUMPTIONS.md` ASM-37. Master-data curation (`visa_checklist_templates:create/
  edit`) is ED/DM-only, same pattern as `admission_master`. CONSULTANT gets full
  `view/create/edit` on `visa`/`pre_departure`/`enrollment` (case-scoped counseling-
  execution work) but only `view` on the template catalog. DOCUMENT_SPECIALIST gets full
  `view/create/edit` on `visa`/`pre_departure` (both paperwork-heavy — its actual
  document-processing domain) but only `view` on `enrollment` (a counseling commitment
  decision, not paperwork) and the template catalog. SALES_MARKETING gets
  `visa_checklist_templates:view` only — zero on the three sensitive transaction resources
  ("Sales/Marketing không mặc định được xem visa/identity/finance evidence").
  ADMIN_FINANCE gets zero grant on all four ("Finance/Admin không mặc định được sửa visa
  counseling data," kept conservative to zero rather than view-only for consistency with
  its established zero-grant treatment elsewhere). STUDENT_PARENT is view-only across all
  four, own case only — no self-service submit/confirm/withdraw. SYSTEM_ADMIN gets zero
  grant.
- **Phase 10 (`partner`/`partner_programs`/`partner_documents`/`partner_student_links`/
  `commission_rules`/`commission_transactions`)**: six distinct resources — "Không dùng một
  permission tổng PARTNER_* cho mọi hành động" — see `docs/ASSUMPTIONS.md` ASM-43.
  ADMIN_FINANCE gets full `view/create/edit` on `commission_rules`/`commission_transactions`
  ("Finance/Admin phải có quyền commission/settlement phù hợp" — settlement is its job,
  mirrors its Contract/Payment execution grant) and `view`-only on the other four (read
  context, not relationship management). DOCUMENT_SPECIALIST gets `view`-only on `partner`
  (enough context to make sense of a document) and `partner_documents` ("Application/
  Document Specialist chỉ xem partner documents theo scope" — literally view-only), zero on
  the other four. CONSULTANT/SALES_MARKETING/STUDENT_PARENT/SYSTEM_ADMIN get **zero** grant
  on all six — "Consultant không mặc định được xem commission/partner commercial terms,"
  "Sales/Marketing không mặc định có quyền xem commission amount," "Student/Parent không
  được xem commission" (extended to the whole domain, not just the amount field — none of
  it is the student's own data). Unlike every other Phase 04-09 domain, this one uses no
  `ScopeKind` at all — access is purely GLOBAL/permission-gated, since the only roles ever
  granted anything on the three most sensitive resources (ED/DM/ADMIN_FINANCE) already
  carry `ScopeKind.GLOBAL` everywhere else in the system.
- **Phase 11 (`portal`)**: one single resource with one single action, `access` — granted
  **only** to STUDENT_PARENT. Every other role gets zero. This is a deliberate class-level
  gate on `PortalController`, not a per-Portal-capability breakdown, because `AuthGuard`
  otherwise allows *any* authenticated role through a route that declares no
  `@RequirePermission` at all — without this gate, a staff role could reach
  `/portal/students/:id/*` too (harmless in that the record-scope check underneath would
  still apply their own legitimate scope, but "ensure staff roles không bị ảnh hưởng" calls
  for an explicit deny, not an accidental allow that happens to be harmless). `portal:access`
  is a **gate**, not the authorization itself — the real per-record decision is
  `ScopePolicyService`'s revocation-aware OWN_STUDENT check (section 3) applied by every
  domain service `PortalService` delegates to, resolved server-side per request from
  `principal.userId`, never from a client-supplied `studentId`. No new `ScopeKind`, no new
  per-Portal-capability resource (`portal_tasks`, `portal_documents`, ...) — Portal is a thin
  read/action layer over the six-plus domains it reuses, and every one of those domains keeps
  its own existing resource/scope/redaction unchanged; `portal:access` only decides whether
  the caller may enter the layer at all. See `docs/ASSUMPTIONS.md` ASM-47.
- **Client Acceptance Remediation DEC-06/07/08 (`case-closure`, 2026-08-26)**: the unified
  Closure/Liquidation surface (`ClosureController`, `cases/:id/closure/*`) replaced the old
  `cases:close` action with its own dedicated resource — `view` (checklist status),
  `request` (CONSULTANT only — "Tư vấn chỉ đề nghị," DEC-06), and `execute` (HCTH/
  ADMIN_FINANCE as the standard executor, plus EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER who can
  also call every `execute` route as an **audited override** — `ClosureService`'s
  `assertOverrideReasonIfNeeded` requires a non-empty `overrideReason` whenever the caller
  isn't ADMIN_FINANCE, and every mutating route's `@Audit` metadata records
  `overrideUsed`/`overrideReason`, so an ED/DM override is never a silent bypass). `cases`
  itself no longer has a `close` action at all. See section 3 for why this is a dedicated
  authorization surface, not a reuse of the Student/Case `ScopeKind`.
- **Client Acceptance Remediation DEC-05(b) (`school_master`, 2026-08-27)**: a curated,
  staff-maintained list of domestic schools for `AcademicRecord.school` to optionally link
  against ("ưu tiên School Master, cho phép nhập trường chưa có"). A separate resource from
  `profile_evidence` since this is master-data curation, not case-scoped counseling work —
  same "master-data curation is ED/DM-only" convention as `admission_master`/
  `visa_checklist_templates`: EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER get `create`/`edit`;
  CONSULTANT/DOCUMENT_SPECIALIST (whoever can touch `AcademicRecord`) get `view` only. No
  STUDENT_PARENT grant — an internal staff data-entry aid, not portal-facing.
- **Phase 12 (`documents` extended, `reports`, `jobs`)**: `documents` gains `edit`/`share`/
  `archive` (the Phase 02-reserved `DocumentAccessPermission` enum values Phase 12 finally
  builds real actions for), granted to the same four staff roles that already hold
  `documents:create` (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/CONSULTANT/
  DOCUMENT_SPECIALIST) — deliberately NOT STUDENT_PARENT (Portal's document mutation stays
  scoped to its own narrow evidence-submission flow, unchanged — `docs/ASSUMPTIONS.md`
  ASM-49). `reports` is one resource with `view` (every staff role — EXECUTIVE_DIRECTOR/
  DEPARTMENT_MANAGER/CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/ADMIN_FINANCE — the
  executive/manager-only dashboards are further narrowed *inside* `ReportsService` via a
  role check, same pattern as `TasksController.runReminders`, not a second permission) and
  `export` (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only, same precedent as
  `students:export`). STUDENT_PARENT gets zero `reports` grant — Portal already satisfies
  every Student/Parent reporting field the phase instruction names, see
  `docs/ASSUMPTIONS.md` ASM-55. `jobs` (background-job status observability) is
  SYSTEM_ADMIN-only, same "Identity/audit administration only" domain boundary as
  `users`/`audit_logs`.

## 3. Record scope per role (`ScopeKind`)

A role's `ScopeKind` is **per resource**, not one value for the whole role — Lead scope
(`LEAD_ROLE_SCOPE`) and Contract/Payment scope (`CONTRACT_ROLE_SCOPE`) are each tracked in
their own table, separate from Student/Case scope (`ROLE_SCOPE`), because they genuinely
differ for the same role (SALES_MARKETING owns Leads but nothing else; CONSULTANT owns no
Leads and gets NO Contract/Payment access despite being CASE_MEMBER-scoped on Case;
ADMIN_FINANCE is NONE on Student/Case but GLOBAL on Contract/Payment).

| Role | Student/Case ScopeKind | Lead ScopeKind | Contract/Payment ScopeKind |
|---|---|---|---|
| EXECUTIVE_DIRECTOR | GLOBAL | GLOBAL | GLOBAL |
| DEPARTMENT_MANAGER | GLOBAL — see `docs/ASSUMPTIONS.md` ASM-06 (no Department entity exists) | GLOBAL | GLOBAL |
| CONSULTANT | CASE_MEMBER — caller is a `CaseMember` (owner or collaborator) of a Case on that student | NONE | **NONE** — deliberately NOT CASE_MEMBER, unlike Student/Case (05-commercial: financial data does not follow from Case access) |
| DOCUMENT_SPECIALIST | CASE_MEMBER — same rule as CONSULTANT | NONE | NONE — same reasoning as CONSULTANT |
| SALES_MARKETING | NONE — no base permission grant, AuthGuard already blocks at layer 2 | **OWN_LEAD** — caller is the Lead's `ownerId` | NONE |
| ADMIN_FINANCE | NONE | NONE | **GLOBAL** — Contract/Payment/Closure is its entire SRS-defined domain, unlike its NONE scope on Student/Case |
| STUDENT_PARENT | OWN_STUDENT — the Student the caller IS (`Student.portalUserId`) or is a linked parent/guardian of (`StudentContact.portalUserId`, revocation-aware since Phase 11 — see section 2 below) — see `docs/ASSUMPTIONS.md` ASM-05 | NONE | OWN_STUDENT — same rule, resolved through `Contract.studentId` / `Payment.contract.studentId` |
| SYSTEM_ADMIN | NONE | NONE | NONE |

**Payment has no `studentId`/`ownerId` of its own** — `ScopePolicyService.assertPaymentAccessible`
resolves scope one hop further than `assertContractAccessible`, through the parent
Contract's Student. A `GET /contracts/:id/payments` list only needs
`assertContractAccessible` on the parent (contract-level access already fully gates every
payment under it); the standalone `GET/POST /payments/:id/...` routes call
`assertPaymentAccessible` directly.

**Task (Phase 06) reuses the Student/Case `ScopeKind` column above verbatim** —
`taskListFilter`/`assertTaskAccessible` call `scopeKindFor` directly, no separate map (see
`docs/ASSUMPTIONS.md` ASM-16). One addition on top of the base scope: a CASE_MEMBER-scoped
caller can also always see/manage a task they personally own even if it has no Case
(`caseId` null) or belongs to a Case they aren't otherwise a member of — "My Tasks" must
work for a task's owner regardless of the case-membership half of their scope.
STUDENT_PARENT is OWN_STUDENT-scoped for Student/Case but has no `tasks:*` permission
grant at all, so it never reaches Task's scope check in practice.

**Task manageability, one level deeper — owner/case-OWNER vs mere COLLABORATOR**: the same
pattern as Case's OWNER-vs-COLLABORATOR split (below), applied to Task —
`TasksService.requireManageable` allows a write (edit/status/assign/dependencies) only for
a GLOBAL-scope role, the task's own `ownerId`, or the Case's `OWNER` CaseMember; a mere
COLLABORATOR who neither owns the task nor owns the case can still *view* it
(CASE_MEMBER = any member) but not manage it.

**CASE_MEMBER, one level deeper — OWNER vs COLLABORATOR**: passing the CASE_MEMBER scope
check (being *any* member) is enough to **view** a case, but `CasesService.assertManageable`
requires the `OWNER` role specifically for **write** actions (add/remove member, stage,
status, close) — a `COLLABORATOR` can see the case but not manage it. `DOCUMENT_SPECIALIST`
never gets `cases:edit/assign/close` at all (section 2), so this OWNER-vs-COLLABORATOR
distinction only bites CONSULTANT in practice today.

**Phase 07 (Assessment/Roadmap/Milestone/Profile Evidence/Writing/LOR) reuses the same
Student/Case `ScopeKind` column, the same way Task does** — every one of these entities
carries its own `caseId` and calls `ScopePolicyService.assertCaseAccessible` directly, no
new scope map (`docs/ASSUMPTIONS.md` ASM-20). A `RoadmapMilestone`'s owner (`ownerId`,
distinct from Task's manageability split above) must be a CaseMember of the roadmap's Case
or hold a GLOBAL-scope role — `MilestonesService.assertValidOwner` — 07-profile's own
"Owner phải thuộc scope hợp lệ."

**Documents (Phase 07) is grant-based, not `ScopeKind`-based** — `DocumentsService.
assertAccessible` still checks GLOBAL-scope bypass via `scopeKindFor`, but for everyone
else requires an explicit `DocumentAccess` row (VIEW or DOWNLOAD) rather than resolving
scope generically through `ownerEntity`/`ownerId`. Grants are created by the linking
evidence/writing service the moment a Document is attached to a Case-scoped record
(`DocumentsService.grantCaseAccess` — every current CaseMember plus the linked student/
parent). See `docs/ASSUMPTIONS.md` ASM-23.

**Phase 12 — Document download adds a second, orthogonal gate on top of the same grant
check**: `scanStatus` must be `CLEAN` or the request is rejected (`403 DOCUMENT_NOT_READY`)
regardless of scope/grant — an infected or still-scanning file is undownloadable by
literally anyone, including a GLOBAL-scope role or the uploader. This is checked twice
(once when the short-lived signed URL is issued, once again when it's redeemed), since the
result could theoretically change in the window between the two. `EDIT`/`SHARE`/`ARCHIVE`
reuse the exact same grant check (`assertAccessible(id, 'EDIT'|'SHARE')`) — no new access
mechanism, only new actions checked against the existing one. `Reports` (`/reports/me`,
`/reports/cases/export`) reuses the existing `ScopePolicyService.caseListFilter` — a
report/export can never surface a Case row the caller couldn't otherwise reach directly.

**Phase 08 (`admission_master`) is GLOBAL — permission-gated only, no `ScopeKind` check
at all** — University/Program/ScholarshipMaster are shared catalog master data, the same
treatment as `ContractTemplate`/`TaskTemplate`: any role holding the relevant
`admission_master` permission sees/edits every row, there is no per-record ownership to
check. **UniversityChoice/Application/Offer/ScholarshipApplication reuse the same
Student/Case `ScopeKind` column** the same way Task/Phase 07 do — `assertCaseAccessible`
when the row's `caseId` is set, `assertStudentAccessible` otherwise (only `UniversityChoice.
caseId` is nullable — `Application`/`ScholarshipApplication` require it; see
`docs/ASSUMPTIONS.md` ASM-28), no new scope map. `Offer` has no `caseId`/`studentId` of its
own — scope resolves one hop further through its parent `Application`, the same pattern
`assertPaymentAccessible` already uses for `Payment` → `Contract`.

**Phase 09 (`visa_checklist_templates`) is GLOBAL — permission-gated only, same treatment
as `admission_master`.** **`Visa`/`Enrollment` reuse the same Student/Case `ScopeKind`
column, both with `caseId` required** (unlike `UniversityChoice`, see `docs/ASSUMPTIONS.md`
ASM-28's reasoning extended by ASM-35/ASM-36). **`VisaChecklistItem` (Visa-scoped OR
Pre-Departure-scoped) has no `caseId`/`studentId` of its own** — scope resolves through
its polymorphic parent: `assertCaseAccessible` via the parent `Visa.caseId` when
`entityType = 'Visa'`, or directly via `assertCaseAccessible(entityId)` when
`entityType = 'PreDeparture'` (since `entityId` IS the `caseId` in that case) — see
`docs/ASSUMPTIONS.md` ASM-33.

**Phase 10 (`partner`/`partner_programs`/`partner_documents`/`commission_rules`) is GLOBAL
— permission-gated only, no `ScopeKind` check, same treatment as `admission_master`/
`visa_checklist_templates`.** Unlike every prior phase, `PartnerStudentLink`/
`CommissionTransaction` (the two entities that DO carry `studentId`/`caseId`) do **not**
reuse the Student/Case `ScopeKind` column either — access to them is governed purely by the
`partner_student_links`/`commission_transactions` permission grant, with no additional
per-record Case-membership check layered on top. This is a deliberate departure from the
Task/Phase07/Phase08/Phase09 "reuse `assertCaseAccessible`" pattern: see
`docs/ASSUMPTIONS.md` ASM-43 for why — in short, the only roles ever granted anything on
these two resources (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/ADMIN_FINANCE) already carry
`ScopeKind.GLOBAL` everywhere else, so a Case-membership scope layer would have no role to
actually narrow. `PartnerDocument`/`CommissionRule`/`CommissionTransaction` each validate
their FK targets (`partnerId`, `partnerProgramId`, `sourceId`) exist and belong together at
the service layer (404 on a mismatch), which is a data-integrity check, not a record-scope
check.

**Phase 11 — parent-link revocation-awareness**: every one of the seven `ScopePolicyService`
methods that resolve OWN_STUDENT via `StudentContact` (`studentListFilter`,
`assertStudentAccessible`, `caseListFilter`, `assertCaseAccessible`, `contractListFilter`,
`assertContractAccessible`, `assertPaymentAccessible`) additionally requires
`portalStatus = 'ACTIVE'`, not merely a non-null `portalUserId` — a revoked or
still-`INVITED` link fails the scope check exactly like an unlinked user would, read live
from the DB on every call, never cached. `DocumentAccess` is a second, independent grant
mechanism (not covered by these seven methods) — `PortalAccessService.revokeParentAccess`
additionally expires all of the revoked user's non-expired `DocumentAccess` rows in the same
transaction, so a previously-granted document-download permission cannot outlive the
relationship either. Task (Phase 06) does **not** extend this reuse for STUDENT_PARENT —
Portal reaches Task through dedicated `TasksService.listForStudentPortal`/
`getForStudentPortal`/`portalSubmitOutput`/`portalUpdateStatus` methods that filter on
`visibleToStudent: true` and never call the staff `assertTaskAccessible` (which explicitly
404s every OWN_STUDENT caller — Task stays staff-only tooling except for rows a staff member
has explicitly opted in). See `docs/ASSUMPTIONS.md` ASM-46/ASM-48.

**`case-closure` (DEC-06/07/08) is a dedicated authorization surface, deliberately NOT a
reuse of the Student/Case `ScopeKind` above** — `ClosureService.assertClosureAccessible`
allows a GLOBAL-scope role or `ADMIN_FINANCE` specifically (even though `ADMIN_FINANCE` is
`NONE`-scoped on Student/Case everywhere else, per the table above — Closure is a narrowly
carved-out exception, not a broadened general Case grant), and otherwise (`allowCaseOwner:
true` call sites only — `request`/`handover`) requires the caller to be that specific case's
`OWNER` CaseMember, mirroring `CasesService.assertManageable`'s OWNER-vs-COLLABORATOR split
rather than mere CASE_MEMBER-any-role. Also unlike every other scope check in this document,
a denial here is `403 PERMISSION_DENIED` (`ForbiddenException`), not the usual `404` — the
existence of a case's closure workflow isn't the kind of sensitive record-content SRS AC-02
is protecting, so there's no enumeration risk to hide behind a 404.

**`school_master` (DEC-05(b)) is GLOBAL — permission-gated only, no `ScopeKind` check at
all**, same treatment as `admission_master`/`visa_checklist_templates` — a shared,
staff-wide reference list with no per-record ownership to check.

**Why 404, not 403, for an out-of-scope record**: SRS AC-02 — "Một user không thuộc case
không thể đọc Student/Document dù biết Student ID." A `403` on `GET /students/:id`
confirms the record exists (something you're not allowed to see); a `404` doesn't. Every
`ScopePolicyService.assert*Accessible` method returns the same `NOT_FOUND` regardless of
whether the record genuinely doesn't exist or merely isn't in the caller's scope. Cases and
Leads follow the identical rule.

**List endpoints** (`GET /students`, `GET /cases`, `GET /leads`) apply the equivalent
WHERE-clause filter (`*ListFilter` methods) so an out-of-scope row never even appears in a
paginated result — there is no ambiguity to hide there (an absent row from a list, unlike a
403 on a direct fetch, reveals nothing).

## 4. Actions (03-security/02_RBAC.md list) — implementation status

| Action | Implemented on | Not yet implemented on / why |
|---|---|---|
| VIEW | leads, students, cases, case-closure (`GET /cases/:id/closure` — checklist status), contracts, payments, tasks, users, audit_logs, University/Program/ScholarshipMaster, UniversityChoice, Application(+checklist), Offer, ScholarshipApplication, Visa(+checklist), VisaChecklistTemplate, pre-departure checklist, Enrollment, Partner, PartnerProgram, PartnerDocument, PartnerStudentLink, CommissionRule, CommissionTransaction, SchoolMaster (`GET /school-masters`, optional `search` query) | — |
| CREATE | leads, students, cases (`POST /students/:id/cases`), leads convert (`POST /leads/:id/convert` — creates Student+Case), contracts (`POST /contracts` — requires an existing Student, never creates one; see `docs/ASSUMPTIONS.md` ASM-15), payments (`POST /contracts/:id/payments` — installment schedule entries, only once the contract is signed), tasks (`POST /cases/:caseId/tasks` — always case-scoped; auto-generation via `TaskGenerationService` on Case/Contract/Roadmap/Application/ScholarshipApplication/Visa workflow events is idempotent per `(templateId, sourceEntityType, sourceEntityId)`, see `docs/ASSUMPTIONS.md` ASM-19/ASM-30/ASM-39); University/Program/ScholarshipMaster (ED/DM-only curation), UniversityChoice/Application/Offer/ScholarshipApplication (case-scoped, requires an existing Student+Case — never creates one, same "link, don't create" precedent as Contract); Visa (case-scoped, instantiates matching `VisaChecklistTemplate` rows into real checklist items — `docs/ASSUMPTIONS.md` ASM-33), pre-departure items, Enrollment (requires an ACCEPTED Offer, `docs/ASSUMPTIONS.md` ASM-36); Partner (duplicate-checked on name+country), PartnerProgram (nested under an existing Partner, optional FK to an existing Program — never a duplicate — `docs/ASSUMPTIONS.md` ASM-41), PartnerDocument (`documentId` must reference an existing Document — never creates one, same "link, don't create" precedent as every Phase 07-09 evidence field), PartnerStudentLink (validates Student/Case ownership, rejects a duplicate ACTIVE link), CommissionRule (basis/rate cross-validated server-side), CommissionTransaction (`docs/ASSUMPTIONS.md` ASM-44 — resolves + snapshots a matching CommissionRule via deterministic precedence, rejects a duplicate non-cancelled transaction for the same source+rule); SchoolMaster (`POST /school-masters`, ED/DM-only curation, duplicate-name-checked case-insensitively) | — |
| EDIT | leads, students, cases (stage/status via dedicated sub-routes, not a bare field PATCH — see docs/api/API_CONVENTIONS.md), contracts (`PATCH /contracts/:id` — DRAFT only; a signed contract's terms change only via `amend`, not `edit`), tasks (`PATCH /tasks/:id` — generic fields, frozen once DONE/CANCELLED; `PATCH /tasks/:id/status` — FSM-validated, moving to BLOCKED requires a blocker reason, moving to DONE requires every dependency to be DONE/CANCELLED first; `POST/DELETE /tasks/:id/dependencies` — self/circular-dependency rejected server-side, never a frontend-only check); Application (`PATCH /applications/:id` generic fields, frozen once WITHDRAWN; `POST /applications/:id/submit` — checklist-precondition-gated; `PATCH /applications/:id/status` — FSM-validated, excludes SUBMITTED/OFFER; `PATCH /checklist-items/:id`); Offer (`POST /offers/:id/respond` — RECEIVED only); ScholarshipApplication (`PATCH .../status` — excludes AWARDED/REJECTED; `POST .../confirm-eligibility`, `.../award`, `.../reject` — each its own dedicated action); University/Program/ScholarshipMaster (`PATCH`, ED/DM-only) plus their own `verify` action (below); Visa (`PATCH /visas/:id` generic fields, frozen once terminal; `POST /visas/:id/submit`/`.../appointment`/`.../interview`/`.../result` — each its own dedicated, precondition-gated action, never a bare status PATCH; `PATCH /visas/:id/status` — FSM-validated, excludes SUBMITTED/APPOINTMENT/INTERVIEW/GRANTED/REFUSED; `PATCH /visa-checklist-items/:id`/`.../pre-departure-items/:id`); Enrollment (`PATCH /enrollments/:id` generic fields, frozen once WITHDRAWN; `POST .../confirm` — at-most-one-CONFIRMED-per-case; `POST .../withdraw`); Partner (`PATCH`/`POST .../archive` — own ARCHIVE audit verb); PartnerProgram (`PATCH`/`POST .../archive`); PartnerDocument (`PATCH` — DRAFT only, "Không overwrite signed/final partner documents"; `POST .../activate` — DRAFT→ACTIVE, supersedes the prior ACTIVE version; `POST .../archive`); PartnerStudentLink (`PATCH`/`POST .../archive`); CommissionRule (`PATCH`/`POST .../activate`/`.../deactivate`); CommissionTransaction (`PATCH` — linkage fields, PENDING only; `POST .../confirm-eligibility`/`.../calculate`/`.../approve`/`.../mark-payable`/`.../pay`/`.../cancel` — each its own dedicated, FSM-gated action, never a bare status PATCH, `docs/ASSUMPTIONS.md` ASM-44/ASM-45); SchoolMaster (`PATCH /school-masters/:id` — rename and/or archive, ED/DM-only, duplicate-name-checked on rename) | — |
| APPROVE | contracts (`POST /contracts/:id/approve`/`reject`, REVIEW → APPROVED/DRAFT — SRS 6.16 monetary-threshold approval; a contract at/above its snapshotted `approvalThreshold` may only be approved by EXECUTIVE_DIRECTOR even though DEPARTMENT_MANAGER also holds `contracts:approve` — `ContractsService.assertApproverAllowed`, the same "permission is necessary but not sufficient" pattern as CASE_MEMBER OWNER-vs-COLLABORATOR in section 3); assessments (`POST /assessments/:id/approve`/`reject`, REVIEW → APPROVED/DRAFT — `assessments:approve`, held only by EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER, never CONSULTANT — separation of duties, see `docs/ASSUMPTIONS.md` ASM-25); roadmaps (`POST /roadmaps/:id/approve`/`reject`, REVIEW → APPROVED/DRAFT — `roadmaps:approve`, same ED/DM-only separation; ACTIVE requires an APPROVED roadmap with an APPROVED baseline Assessment, see `docs/ASSUMPTIONS.md` ASM-25) | — |
| VERIFY | University/Program/ScholarshipMaster (`POST .../:id/verify` — stamps `lastVerifiedAt` only, no other field; its own `admission_master:verify` permission, distinct from `edit` — "Source/verification fields có thể có permission riêng," 08-admission RBAC section) | — |
| ASSIGN | leads (`PATCH /leads/:id/assign` — owner reassignment), cases (`POST/DELETE /cases/:id/members` — collaborator management; `POST /cases/:id/reassign-owner` — Phase 13, a true ownership transfer: demotes every prior OWNER `CaseMember` to COLLABORATOR and updates `Case.ownerId` atomically, unlike the additive `POST .../members` with `role: OWNER`), tasks (`PATCH /tasks/:id/assign` — owner reassignment, gated by `TasksService.requireManageable`: the caller must be the task's current owner, the case's OWNER member, or a GLOBAL-scope role) | — |
| CONVERT | leads (`POST /leads/:id/convert`) — not in 02_RBAC.md's generic list, but the single most important Lead-specific action (04-core-crm/01_LEAD.md); deliberately its own permission rather than folded into `edit`, since converting has irreversible downstream effects (creates Student+Case) that a plain edit doesn't. | — |
| SEND | contracts (`POST /contracts/:id/send`, APPROVED → SENT — generates a secure, expiring `ContractReviewLink`; SRS 6.16 "Gửi client review bằng secure link có expiry") — its own permission (not folded into `edit`) since it dispatches an externally-reachable artifact, unlike an internal field edit. | — |
| SIGN | contracts (`POST /contracts/:id/sign`, SENT → SIGNED — completes Case↔Contract linkage, see `docs/ASSUMPTIONS.md` ASM-15) — its own permission for the same reason SEND is: a terminal, high-consequence, effectively-irreversible transition (Hard Rule #4: signed contracts are immutable from this point on). | — |
| AMEND | contracts (`POST /contracts/:id/amendments` — the only path to change terms on a contract that has ever been signed; rejects a no-op amendment with `NO_MATERIAL_CHANGE`) | — |
| RECORD | payments (`POST /payments/:id/record` — partial/full payment, idempotent via `Idempotency-Key`; rejects overpayment unless `allowOverpayment` is explicit) — not in 02_RBAC.md's generic list; Payment's own execution verb, kept separate from `edit` since a bare field edit could otherwise bypass the partial/overpayment/duplicate-reference business rules. | — |
| REFUND | payments (`POST /payments/:id/refund` — recorded on the same Payment row, see `docs/ASSUMPTIONS.md` ASM-14; supports partial refund) | — |
| WAIVE | payments (`POST /payments/:id/waive` — requires a `reason`, only from an unresolved payment) | — |
| DOWNLOAD | documents (`GET /documents/:id/download` — Phase 07; `documents:download` permission; server-enforced via `DocumentsService.assertAccessible` — GLOBAL-scope roles bypass, all others require a `DocumentAccess` row for the caller's user, 404 not 403 when absent; audited as `DOWNLOAD`; never returns a public URL, only the caller-supplied opaque `fileReference` after the permission check) | Real object storage / signed-URL issuance / virus scanning — remains Phase 12 (`fileReference` today is caller-supplied metadata only, see `docs/ASSUMPTIONS.md` ASM-23). |
| EXPORT | students (`GET /students/export`), contracts (`GET /contracts/export`), payments (`GET /payments/export`) | — |
| SHARE | contracts (`POST /contracts/:id/send`, audited as `SHARE` — dispatching the client review link is the closest fit to SRS's SHARE verb for an externally-reachable artifact) | No Document sharing endpoint exists yet. Note creation (`POST .../notes`) with `visibility: 'shared'` is the closest analog for entity-attached notes (see section 5), not a generic SHARE action. |
| DELETE | — (intentionally, everywhere) | Hard Rule #5 — no hard-delete path exists for any entity in this system; `archive`/`close` are the closest equivalent actions where applicable. |
| ARCHIVE | students (`PATCH /students/:id/archive`), cases — reachable indirectly via the CLOSED→ARCHIVED status transition (`PATCH /cases/:id/status`), gated by `cases:edit` (ARCHIVED is a manual transition target, unlike CLOSED — see `CasesService`'s `CASE_TRANSITIONS` table), contracts — reachable via `PATCH /contracts/:id/status` (LIQUIDATED → ARCHIVED), gated by `contracts:edit` | — |
| ~~CLOSE~~ REQUEST / EXECUTE | **Client Acceptance Remediation DEC-06/07/08 (2026-08-26) superseded this row** — the old `cases:close`/`PATCH /cases/:id/close` (below) is gone; Case closure is now the dedicated `case-closure` resource on `ClosureController` (`cases/:id/closure/*`), with two new actions not in 02_RBAC.md's generic list: **REQUEST** (`POST .../request` — CONSULTANT, the case's OWNER member only, "Tư vấn chỉ đề nghị") and **EXECUTE** (`POST .../handover`, `.../close`, `.../liquidation/confirm-company` — ADMIN_FINANCE as standard executor; EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER may also call these as an audited override, gated by `ClosureService.assertOverrideReasonIfNeeded` requiring a non-empty `overrideReason`). All 6 DEC-07 preconditions (closure reason, open-task check, outstanding Payment debt, non-terminal Visa, unconfirmed required Enrollment, incomplete pre-departure checklist, plus document handover) are enforced inside `ClosureService`, one `POST .../close` entry point, same "no logic duplicated into a Visa/Enrollment controller" discipline as the old design. See `docs/requirements/CLOSURE_LIQUIDATION_DESIGN.md`. ~~Historical (pre-2026-08-26): cases (`PATCH /cases/:id/close`) — kept as its own permission/action for the same reason CONVERT is its own action; Phase 09 extended the precondition set under the same `cases:close` permission.~~ | — |

## 5. Field-level protection (SRS section 13)

| SRS field group | Status | Where |
|---|---|---|
| Budget/Finance | Implemented (`Student.budget`/`budgetCurrency`) | `FieldPolicyService.redactStudent`, live on every `students` response. See `docs/ASSUMPTIONS.md` ASM-07 for the "V"/"Hạn chế"/"Không" → allow/redact simplification. |
| Internal notes | Implemented and live | `FieldPolicyService.canViewComment`, wired into `TimelineService` (Phase 04's `.../notes` + `.../timeline` sub-routes on Lead/Student/Case). See `docs/ASSUMPTIONS.md` ASM-10 — this is deliberately the minimum "create + list" slice of `Comment`, not the full generic Comment CRUD (threading, mentions, edit/delete). Phase 06's own instruction files (01_TASK.md, 02_NOTIFICATION.md) never asked for that expansion, so it remains un-built and un-scheduled rather than assumed-Phase-06. |
| Passport/ID | Implemented via the Document grant system, not field redaction | `Visa`/checklist items carry no raw passport-number/identity text field at all — only FK references (`evidenceDocumentId`, checklist `documentId`) into the existing Document subsystem, protected by `DocumentsService.assertAccessible`'s grant check (section 3) — see `docs/ASSUMPTIONS.md` ASM-38. Phase 13 fix: CONSULTANT is now `viewOnlyForRoles`-restricted (VIEW, no DOWNLOAD) on the specific documents linked as Visa evidence, matching SRS §13's "Xem hạn chế" — see the Visa evidence row below. |
| LOR contact/internal notes | Implemented (`LetterOfRecommendation.contactEmail`/`contactPhone`/`internalNotes`) | `FieldPolicyService.redactLor`, live on every `letters-of-recommendation` response. Redacted only for STUDENT_PARENT (recommender contact details and internal counseling notes are staff-facing; `recommenderName`/`relationship`/`requestStatus`/`submissionStatus` remain visible so a student can still see who was asked and where the request stands) — see `docs/ASSUMPTIONS.md` ASM-25. |
| Scholarship strategy/internal notes | Implemented (`ScholarshipApplication.internalNotes`) | `FieldPolicyService.redactScholarshipApplication`, live on every `scholarship-applications` response. Redacted only for STUDENT_PARENT, same pattern as LOR above. Program tuition, Offer deposit, and ScholarshipApplication award amounts are deliberately NOT redacted — see `docs/ASSUMPTIONS.md` ASM-32 for why those are treated as public/third-party catalog data, not the agency's own commercial terms. |
| Contract value | Implemented (`Contract.value`/`currency`/`approvalThreshold`) | `FieldPolicyService.redactContract`, live on every `contracts` response. Redacted for CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/SYSTEM_ADMIN — defense-in-depth second layer: `CONTRACT_ROLE_SCOPE` already gives all four of these roles `NONE` scope (section 3), so a record is never actually reached to redact in practice; tested directly anyway (`field-policy.service.spec.ts`), same pattern as Budget above. |
| Payment/Debt | Implemented (`Payment.amount`/`currency`/`paidAmount`/`refundedAmount`) | `FieldPolicyService.redactPayment`, same roles/reasoning as Contract value above. |
| Commission | Implemented — as a *resource-level* gate, not per-field redaction | `commission_rules`/`commission_transactions` permission grants (section 2) are the actual protection — CONSULTANT/SALES_MARKETING/STUDENT_PARENT get zero grant at all (never reach a redaction point), and the two roles that do get any grant (ADMIN_FINANCE, ED/DM) both see full commercial detail — no partial-visibility role exists for these two resources, so no field-level redaction was needed on top of the permission gate. `Payment` (Phase 05) remains deliberately separate — see `docs/ASSUMPTIONS.md` ASM-13. |
| Visa evidence | Implemented via the Document grant system, WITH a role-differentiated grant (Phase 13 fix) | Same base treatment as Passport/ID above — real Document FKs, grant-checked, never a public URL. Unlike every other evidence-bearing module's `grantCaseAccess` call (uniform VIEW+DOWNLOAD to every case member), Visa's 4 evidence-linking call sites (`visas.service.ts`, `visa-checklist.service.ts`) pass `{ viewOnlyForRoles: ['CONSULTANT'] }`: a Consultant case member gets VIEW only, never DOWNLOAD, on visa evidence they didn't personally upload — matching SRS §13's Consultant="Xem hạn chế" vs. Document Specialist/GĐĐH/Trưởng phòng's full access. The document's own uploader always keeps full access regardless of role (a separate, pre-existing grant path, unaffected by this option). Prior to this fix, Consultant held the same full access as Document Specialist — a genuine SRS deviation, not a deliberate documented decision; see `docs/security/SECURITY_TEST_REPORT.md` §9. |
| Visa internal notes / Enrollment internal notes | Implemented (`Visa.internalNotes`, `Enrollment.internalNotes`) | `FieldPolicyService.redactVisa`/`redactEnrollment`, live on every `visas`/`enrollments` response. Redacted only for STUDENT_PARENT; appointment/interview/result/refusal-reason fields stay visible — they are the affected Student/Parent's OWN visa outcome, not staff-internal secrets. See `docs/ASSUMPTIONS.md` ASM-38. |
| Partner internal notes | Implemented (`Partner.internalNotes`) | `FieldPolicyService.redactPartner`, live on every `partners` response. Redacted only for DOCUMENT_SPECIALIST — the one role granted `partner:view` without full commercial visibility (ED/DM/ADMIN_FINANCE all see it in full); CONSULTANT/SALES_MARKETING/STUDENT_PARENT get zero `partner` grant at all, so they never reach this record. See `docs/ASSUMPTIONS.md` ASM-43. |
| Partner document evidence | Implemented via the Document grant system | Same treatment as Passport/ID/Visa evidence above — `PartnerDocument.documentId` is a real FK, grant-checked via `DocumentsService.grantRoleAccess` (a new Phase 10 method: grants VIEW+DOWNLOAD to every current user of the roles holding `partner_documents:view`, since Partner-domain access is GLOBAL/permission-gated rather than Case-membership-based — see `docs/ASSUMPTIONS.md` ASM-42), never a public URL. |
| Audit logs | Implemented — as a *resource-level* gate, not per-field redaction | `audit_logs:view` permission (section 2 table above) — SRS's matrix for this row is really "who may query audit data at all," which is what `AuditLogsController`'s `@RequirePermission('audit_logs', 'view')` enforces. |
| Task internal fields, on the Portal path | Implemented (`Task.blocker`/`qualityScore`/`ownerId`) | `FieldPolicyService.redactTaskForPortal`, live on every Portal task response (list + detail). Deliberately unconditional (not role-varying like the other redactors above) since this method only ever runs on the Portal's own student-facing read path — the staff-facing `tasks` responses (section 5's existing rows, unaffected) still show these fields in full to whoever already holds `tasks:view`. See `docs/ASSUMPTIONS.md` ASM-48. |

## 6. Allow/deny coverage

Every ScopeKind above has both an ALLOW and a DENY integration test against real HTTP
endpoints and the real database — Student/Case in `apps/api/test/rbac.e2e-spec.ts`
(Phase 03), Lead's OWN_LEAD scope in `apps/api/test/lead-conversion.e2e-spec.ts` (Phase
04), Case write-mutation cross-case isolation + OWNER-vs-COLLABORATOR in
`apps/api/test/case-management.e2e-spec.ts` (Phase 04), and Contract/Payment's
`CONTRACT_ROLE_SCOPE` (GLOBAL/OWN_STUDENT/NONE) plus the monetary-threshold approval split
in `apps/api/test/contracts.e2e-spec.ts` and `apps/api/test/payments.e2e-spec.ts`
(Phase 05), and Task's reused `ROLE_SCOPE` plus owner/case-OWNER manageability in
`apps/api/test/tasks.e2e-spec.ts`, recipient-scoped Notification inbox access in
`apps/api/test/notifications.e2e-spec.ts` (Phase 06), and Phase 07's Assessment/Roadmap/
Milestone/profile-evidence/Writing/LOR entities (all reusing the same Student/Case
`ROLE_SCOPE` via `assertCaseAccessible`, see `docs/ASSUMPTIONS.md` ASM-20) plus
grant-based Document access, in `apps/api/test/assessment-roadmap.e2e-spec.ts`,
`apps/api/test/profile-evidence.e2e-spec.ts` and `apps/api/test/writing.e2e-spec.ts`
(Phase 07), and Phase 08's Admission entities — GLOBAL/permission-only master data plus
the reused Student/Case `ROLE_SCOPE` on UniversityChoice/Application/Offer/
ScholarshipApplication — in `apps/api/test/admission-master-data.e2e-spec.ts`,
`apps/api/test/admission-application.e2e-spec.ts` and `apps/api/test/
admission-offer-scholarship.e2e-spec.ts` (Phase 08), and Phase 09's Visa domain —
GLOBAL/permission-only `visa_checklist_templates` plus the reused Student/Case
`ROLE_SCOPE` on Visa/Enrollment/pre-departure items, and the extended Case Closure
validation — in `apps/api/test/visa.e2e-spec.ts` and `apps/api/test/
pre-departure-enrollment-closure.e2e-spec.ts` (Phase 09), and Phase 10's Partner CRM +
Commission domain — GLOBAL/permission-only across all six resources, zero-by-default for
CONSULTANT/SALES_MARKETING/STUDENT_PARENT, and the full CommissionTransaction FSM — in
`apps/api/test/partners.e2e-spec.ts` (Phase 10), and Phase 11's Student/Parent Portal —
the `portal:access` class-level gate, revocation-aware OWN_STUDENT scope reuse across every
domain Portal delegates to, parent invite/accept/revoke lifecycle, multi-child
account-reuse, IDOR/cross-student/unlinked/revoked DENY (called directly against the API,
not just checked through a UI), and the Task field-redaction split — in
`apps/api/test/portal.e2e-spec.ts` (Phase 11), and Phase 12's Platform build-out — real
upload/scan/signed-download/versioning/share/archive on Documents (MIME/extension/magic-
byte validation, IDOR on ownerId spoofing, cross-user grant isolation, principal-scoped
signed tokens) in `apps/api/test/documents-platform.e2e-spec.ts`, job idempotency/retry/
scheduler-dedup plus the SYSTEM_ADMIN-only `/admin/jobs` ALLOW/DENY split in
`apps/api/test/jobs-platform.e2e-spec.ts`, Reporting's ED/DM-only executive/manager
dashboards vs. every-staff-role `/reports/me` vs. zero-grant Student/Parent, plus scoped/
audited export, in `apps/api/test/reporting.e2e-spec.ts`, and webhook signature
verification/replay-protection/audit in `apps/api/test/webhooks.e2e-spec.ts` (Phase 12), and
Client Acceptance Remediation's dedicated `case-closure` authorization surface — REQUEST/
EXECUTE ALLOW/DENY, the ED/DM audited-override path, and the 403-not-404 exception — in
`apps/api/test/case-closure.e2e-spec.ts` (DEC-06/07/08, 2026-08-26). `school_master`'s
GLOBAL/permission-only ALLOW/DENY plus duplicate-name rejection is covered alongside
`AcademicRecord`'s existing scope tests in `apps/api/test/profile-evidence.e2e-spec.ts`
(DEC-05(b), 2026-08-27).
The fixture graph these exercise (also in
`database/seeds/seed.ts`, non-production only):

- **Student A** (`HS-2026-90001`) — has an active Case (`CASE-2026-90001`) with
  `demo.consultant.a` (OWNER) and `demo.docspecialist` (COLLABORATOR) as members
  (CASE_MEMBER ALLOW, and the OWNER-vs-COLLABORATOR manage-permission split), while
  `demo.consultant.b` is deliberately NOT a member (CASE_MEMBER DENY, including on writes
  — stage/close/add-member all return 404 for consultant.b). Self-linked to
  `demo.student.self` (OWN_STUDENT ALLOW) and parent-linked to `demo.parent.linked`
  (OWN_STUDENT ALLOW via parent).
- **Student B** (`HS-2026-90002`) — no case, no portal links — a DENY target for every
  scoped role, and used to prove a case-member-scoped LIST only returns rows the caller
  actually has access to (not just that a direct fetch is blocked).
- **`demo.parent.unlinked`** — a STUDENT_PARENT account linked to nothing — OWN_STUDENT
  DENY target.
- **`demo.parent.revoked`** — a dedicated STUDENT_PARENT account (distinct from
  `demo.parent.unlinked` above — deliberately not reused, so a "truly never linked" DENY
  fixture and a "was linked, now revoked" DENY fixture stay independently testable) with a
  real `StudentContact` row on Student A whose `portalStatus = REVOKED` and `portalUserId`
  still set — OWN_STUDENT DENY target that specifically exercises the Phase 11
  revocation-awareness fix (section 3): the old "just check `portalUserId` is non-null"
  logic would have wrongly ALLOWed this account; the current logic correctly DENYs it.
- An **INVITED** `StudentContact` fixture on Student A (`portalStatus = INVITED`, no
  `portalUserId` yet) with a real `ParentInvitation` row (known raw token, for a
  deterministic accept-flow test) — DENY target until accepted (an INVITED-but-not-yet-
  accepted link must not grant OWN_STUDENT access), then flips to an ALLOW target once
  accepted via `POST /public/portal/parent-invitations/:token/accept`.
- **`TASK-2026-90003`** (caseA, `visibleToStudent = true`, owned by `demo.consultant.a`) —
  the one Task fixture STUDENT_PARENT/self-student CAN see through the Portal, proving
  `visibleToStudent` gating (`TASK-2026-90001`/`TASK-2026-90002` above stay invisible to the
  Portal path despite being on the same case, since neither is opted in) and exercising the
  `redactTaskForPortal` field-redaction split (section 5).
- **`LEAD-2026-90001`**, owned by `demo.sales` — OWN_LEAD ALLOW target for `demo.sales`,
  DENY target for `demo.sales.b` (a second SALES_MARKETING account owning nothing).
- **Contract `HD-2026-90001`** (SIGNED, value 8000 USD, `Case.contractId` linked to
  `CASE-2026-90001`) — same Student A, so the identical GLOBAL/OWN_STUDENT ALLOW and
  CONSULTANT/unlinked-parent DENY pattern applies, plus proves CONSULTANT (a member of the
  linked Case) is still denied — Contract scope does not follow from Case scope. Carries
  two Payment fixtures: **`PAY-2026-90001`** (installment 1, fully PAID) and
  **`PAY-2026-90002`** (installment 2, PENDING with a due date in the past — the fixed
  overdue target, so `apps/api/test/payments.e2e-spec.ts`'s overdue assertions don't
  depend on test-run-time date math).
- **Task `TASK-2026-90001`** (owned by `demo.consultant.a`, caseA's OWNER member — the
  "task owner" and "case owner" manage-paths coincide) and **`TASK-2026-90002`** (owned by
  `demo.docspecialist`, a mere COLLABORATOR, deadline in the past — the fixed overdue
  target, and the one that actually distinguishes "manage your own task" from "manage as
  case owner": `demo.docspecialist` can manage `TASK-2026-90002` but not
  `TASK-2026-90001`).
- **Assessment `assessmentA`** (APPROVED, version 1, caseA) with one `AssessmentCriterion`
  (area `Academic`) — same Student/Case ALLOW/DENY pattern as Task above (CONSULTANT/
  DOCUMENT_SPECIALIST/STUDENT_PARENT ALLOW-to-view via caseA membership or OWN_STUDENT,
  consultant.b and Student B DENY). One fixture row each for **AcademicRecord**,
  **Competition**, **ResearchProject**, **Activity**, **WritingArtifact** (with one
  **WritingVersion**, v1) and **LetterOfRecommendation**, all on caseA, using fixed
  RFC4122 v4-shaped UUIDs (`00000000-0000-4000-8000-00000000XXXX`) so both
  `ParseUUIDPipe` (route params) and `class-validator`'s stricter `@IsUUID()` (body
  fields) accept them — exercise the Evidence→Document linkage (grant propagation to
  case members and the linked student, download gated through `documents:download`) and
  the LOR field-redaction ALLOW/DENY split (`FieldPolicyService.redactLor`, section 5).
- **University A** (`UNI-2026-90001`), **Program A** (`PRG-2026-90001`, under University
  A), and **ScholarshipMaster A** (`SCHM-2026-90001`, under University A + Program A) —
  GLOBAL master data: any `admission_master:view` holder can read them (ALLOW), ADMIN_
  FINANCE/SYSTEM_ADMIN (zero grant) get 403 (DENY at the permission layer, not scope).
  **Application A** (`APP-2026-90001`, SUBMITTED, caseA) with one **ApplicationChecklist**
  item and one **Offer** (`RECEIVED`) and one **ScholarshipApplication**
  (`SCH-2026-90001`, UNDER_REVIEW, caseA, `internalNotes` set) — same Student/Case ALLOW/
  DENY pattern as Assessment above (consultant.b DENY, ADMIN_FINANCE/SALES_MARKETING 403 at
  the permission layer since neither holds `applications`/`offers`/
  `scholarship_applications`), plus the ScholarshipApplication field-redaction ALLOW/DENY
  split (`FieldPolicyService.redactScholarshipApplication`, section 5).
- A second **Offer B** (`ACCEPTED`, applicationA) backs **Visa A** (`VISA-2026-90001`,
  SUBMITTED, caseA, `internalNotes` set) with one Visa-scoped **VisaChecklistItem**
  (`entityType='Visa'`, DONE) and one Case-scoped pre-departure **VisaChecklistItem**
  (`entityType='PreDeparture'`, category `flight`, PENDING), plus a matching
  **VisaChecklistTemplate** (`US`/`F-1`/"Passport copy") — same Student/Case ALLOW/DENY
  pattern as Visa above (consultant.b DENY, ADMIN_FINANCE/SALES_MARKETING 403 since
  neither holds `visa`/`pre_departure`), plus the Visa field-redaction ALLOW/DENY split
  (`FieldPolicyService.redactVisa`, section 5). **Enrollment A** (CONFIRMED, caseA,
  `internalNotes` set) exercises the same pattern for `enrollment` plus
  `FieldPolicyService.redactEnrollment`.
- **Partner A** (`PT-US-90001`, AGENCY, `internalNotes` set) with **PartnerProgram A**
  (`PP-US-90001-01`, linked to the real Program A — `docs/ASSUMPTIONS.md` ASM-41), a
  **PartnerDocument** (MOU, `ACTIVE`, real `documentId` FK to a fixture Document), a
  **PartnerStudentLink** (studentA/caseA, `ACTIVE`), a **CommissionRule**
  (`CONTRACT_VALUE`, 10%, scoped to PartnerProgram A) and a **CommissionTransaction**
  (`PENDING`, sourced from Contract `HD-2026-90001`) — GLOBAL/permission-only across all
  six resources: ED/DM/ADMIN_FINANCE ALLOW (with ADMIN_FINANCE view-only on the first four),
  DOCUMENT_SPECIALIST ALLOW on `partner`/`partner_documents` only, CONSULTANT/
  SALES_MARKETING/STUDENT_PARENT DENY (403) on all six at the permission layer — no
  Case-membership scope check exists for this domain (section 3), plus the Partner
  field-redaction ALLOW/DENY split (`FieldPolicyService.redactPartner`, section 5).
- **`demo.parent.linked`** (STUDENT_PARENT, `portalStatus = ACTIVE` on Student A) and
  **`demo.student.self`** (Student A's own portal account) — the two Portal ALLOW callers,
  exercised across every `/portal/students/:id/*` route: profile (read-only), roadmap
  (derived progress %), the shared `TASK-2026-90003` above, documents actually granted to
  the caller (`DocumentsService.listAccessibleTo`), Application A/Offer B/ScholarshipApp A/
  Visa A/Enrollment A/Contract `HD-2026-90001` (all field-redacted the same way their
  respective staff-facing routes already are — internal notes/strategy/commission never
  visible), and the caller's own Notification inbox. `demo.parent.revoked`/the not-yet-
  accepted INVITED contact/`demo.parent.unlinked`/Student B/every staff role (via
  `portal:access`'s class-level gate) are the corresponding DENY callers, tested directly
  against the API (IDOR-style — arbitrary `documentId`/`applicationId`/`visaId` under a
  DENY caller's request all still 404, never leak existence).

## 7. Explicitly out of scope (Phase 03, extended by Phase 04-12)

- Field-level enforcement is now implemented for every SRS §13 group named through Phase
  11 (see section 5): Contract value and Payment/Debt (Phase 05), passport/visa evidence
  via the Document grant system and Visa/Enrollment internal notes via `FieldPolicyService`
  (Phase 09), Commission (permission-gated resource-level, no partial-visibility role
  exists) and Partner internal notes / partner document evidence (Phase 10), Task internal
  fields on the Portal path (Phase 11).
- DELETE on any resource (Hard Rule #5 — no hard-delete path exists anywhere; ASSIGN/
  CONVERT/CLOSE were added in Phase 04, SEND/SIGN/AMEND/RECORD/REFUND/WAIVE in Phase 05,
  DOWNLOAD in Phase 07, VERIFY in Phase 08 — see section 4).
- Real department/team-scoped record filtering (see `docs/ASSUMPTIONS.md` ASM-06).
- An admin UI to drive `GET /audit-logs` (see `docs/ASSUMPTIONS.md` ASM-08).
- A full Payment transaction ledger (every partial payment/refund as its own append-only
  row) — refund is recorded on the same Payment row instead; see `docs/ASSUMPTIONS.md`
  ASM-14.
- Commission (Partner-facing money) is now built (Phase 10, `CommissionRule`/
  `CommissionTransaction`) — kept deliberately separate from `Payment`/`Contract.value`/
  `ScholarshipApplication.awardAmount`, no shared FK/column with any of the three anywhere;
  see `docs/ASSUMPTIONS.md` ASM-13/ASM-44.
- Task auto-generation from every trigger `06-operations/01_TASK.md` originally named is
  now fully wired — `CASE_CREATED`/`CASE_STAGE_CHANGED`/`CONTRACT_ACTIVATED` (Phase 06),
  `APPLICATION_SUBMITTED`/`SCHOLARSHIP_AWARDED` (Phase 08), `VISA_GRANTED` (Phase 09, the
  last of the three originally-deferred triggers) — see `docs/ASSUMPTIONS.md`
  ASM-16/ASM-19/ASM-30/ASM-39.
- Real scheduled/queued notification dispatch and reminder cron (Redis/BullMQ is Phase 12
  scope) — the domain logic is fully built and manually triggerable; see
  `docs/ASSUMPTIONS.md` ASM-18. Deadline-based reminder cadences for Application/
  ScholarshipApplication/Visa specifically (`application deadline`/`scholarship deadline`/
  `visa deadline`) were not built — no instruction file asks for a concrete reminder
  cadence, unlike Task/Payment's explicit 30/14/7/3/1-day requirement; see
  `docs/ASSUMPTIONS.md` ASM-30/ASM-39.
- `document request` notification event (06-operations/02_NOTIFICATION.md names this, but
  it has no concrete owning entity/trigger definition anywhere — Phase 12). The other
  originally-deferred event, "visa appointment," is now wired as `VISA_APPOINTMENT_
  SCHEDULED` (Phase 09).
- Real object storage, signed-URL issuance, and virus scanning for `Document` (Phase 07
  built metadata-only CRUD + grant-based permission + a real, tested download-authorization
  gate; `fileReference` is a caller-supplied opaque key, not a resolvable object-storage
  path — remains Phase 12; see `docs/ASSUMPTIONS.md` ASM-23).
- Self-service Student/Parent actions on Admission/Visa entities — accepting/declining an
  Offer, confirming scholarship eligibility, proposing a University Choice, submitting/
  confirming/withdrawing a Visa or Enrollment are all staff-mediated in this phase
  (STUDENT_PARENT is view-only across every Phase 08/09 resource); see
  `docs/ASSUMPTIONS.md` ASM-31/ASM-37.
- University-portal-login credential storage — no instruction file in 08-admission/
  09-visa asks for one, so none was built (not even a "safe" placeholder); see
  `docs/ASSUMPTIONS.md` ASM-27.
- Reopening a CLOSED Case — Phase 04's own `CASE_TRANSITIONS` table has no reverse edge
  out of CLOSED, and no Phase 09 instruction concretely requires adding one despite a
  hedged mention; see `docs/ASSUMPTIONS.md` ASM-36.
- CommissionTransaction adjustment/reversal (a mechanism to correct a PAID transaction
  without a new row) — not named anywhere in 10-partners/01_PARTNER_CRM.md; PAID/CANCELLED
  are both hard-terminal instead, and a correction after cancellation is a fresh
  CommissionTransaction against the same source, never blocked by the duplicate check; see
  `docs/ASSUMPTIONS.md` ASM-45.
- Automatic CommissionTransaction generation from a Payment/Contract event — `docs/
  architecture/DOMAIN_MAP.md` domain 7's `CommissionTriggerEvent` expose point was never
  wired; creation is a manual, explicit staff/finance action naming its source, and
  `calculate()` always reads the live source regardless of how/when the transaction was
  created — see `docs/ASSUMPTIONS.md` ASM-44.
- Consultant/Sales-Marketing self-service visibility into Partner CRM/Commission data for
  their own cases — deliberately zero grant across all six Phase 10 resources per the
  phase's own repeated "không mặc định" cautions, not a Case-membership-based partial view;
  see `docs/ASSUMPTIONS.md` ASM-43.
- Self-service Student/Parent mutation on Admission/Visa entities remains staff-mediated
  even with the Portal now live (Phase 11 did not reopen the Phase 08/09 deferral above) —
  the Portal only ever exposes narrow, additive "submit evidence"/"acknowledge" actions
  (`MilestonesService.submitEvidence`, `ApplicationChecklistService.submitEvidence`,
  `TasksService.portalSubmitOutput`/`portalUpdateStatus` restricted to IN_PROGRESS/DONE) —
  never a student-initiated Offer accept/decline, Application/Scholarship/Visa/Enrollment
  status transition, or profile field edit; see `docs/ASSUMPTIONS.md` ASM-49.
- Student/Parent profile self-editing — the Portal's own instruction file draws a hard
  READ-ONLY line around ownership/internal-status/staff-assignment/contract-legal-state/
  commission/audit-data; no `PATCH /portal/students/:id` (or equivalent) route exists at
  all. See `docs/ASSUMPTIONS.md` ASM-49.
- A dedicated Portal Comment/messaging capability (`PortalMessage`/`StudentMessage`/
  `ParentComment`) — 11-portal/01_STUDENT_PARENT_PORTAL.md only conditionally names
  interaction ("nếu MD cho phép"), and no concrete comment/message requirement is stated
  anywhere in it; the existing `Comment` entity's student-visibility split (section 5,
  Internal notes row) was left as-is rather than extended into a new Portal-facing surface.
  See `docs/ASSUMPTIONS.md` ASM-49.
- Real object storage (S3/GCS/Azure Blob) — Phase 12 built a genuine private-storage
  pipeline (`StorageProvider` interface, signed URLs, async scan) but the default bound
  implementation is local disk (`LocalFilesystemStorageProvider`); no cloud credentials
  exist in this environment. Swapping in a real provider is a one-file `useClass` change
  behind the same interface, no controller/service change needed. See
  `docs/ASSUMPTIONS.md` ASM-50.
- Real malware-scan engine — the default `MalwareScanProvider` (`HeuristicMalwareScanProvider`)
  detects only the industry-standard EICAR test signature, not a real signature database;
  the async PENDING→CLEAN/INFECTED state machine and download-gating are real and enforced,
  the detection logic itself is a documented stand-in. See `docs/ASSUMPTIONS.md` ASM-50.
- Automatic document retention/legal-hold deletion — `retention_until`/`legal_hold` are
  tracked but no job reads them to purge anything; Hard Rule #5 (no hard-delete anywhere)
  and the phase's own "Không tự động delete legal/audit-required documents" instruction
  both point the same direction — retention stays informational/reporting-only. See
  `docs/ASSUMPTIONS.md` ASM-50.
- ESign/Calendar/Accounting/SMS provider adapters have no concrete call site — interfaces +
  no-op/log-only default implementations exist (ready for a future phase to wire a real
  feature behind them), but no Phase 01-12 instruction file names a concrete workflow
  requiring any of the four, so none was built out (only Email, wired into
  `NotificationsService`'s EMAIL channel via the new job queue, and ExternalSchoolData,
  wired into the University sync job, have a real call site). See `docs/ASSUMPTIONS.md`
  ASM-54.
- Webhook receivers beyond the one built (`POST /webhooks/esign`) — no other Phase 01-12
  instruction names a concrete inbound webhook source; the reusable signature-verification/
  idempotency infrastructure (`IncomingWebhookEvent`, `verifyWebhookSignature`) is ready for
  a future one. The esign webhook itself is deliberately side-effect-free on business data
  (records + audits only) — it never auto-mutates `Contract.status`, since that would be a
  new, unreviewed business rule no MD authorizes. See `docs/ASSUMPTIONS.md` ASM-53.
- Redis/BullMQ — the job queue is a Postgres-backed table (`BackgroundJob`) with an
  in-process poller instead, since no message-broker infra exists in this environment and
  the current scale doesn't need one; this revises the Phase 06 ASM-18 note that had named
  Redis/BullMQ specifically. See `docs/ASSUMPTIONS.md` ASM-52.
- General API rate-limiting beyond login's own account-lockout mechanism — NFR-SEC-06 names
  it, but adding a global limiter is new cross-cutting middleware every route would run
  through, with real regression risk against this project's own `--runInBand` full e2e
  suite; the one concretely-named brute-force target (login) already has real protection.
  See `docs/ASSUMPTIONS.md` ASM-56.
- A database-level fix for the "one active Case per Student" concurrent-request race — the
  invariant is enforced application-side (check-then-create); a durable partial-unique-index
  fix isn't expressible in `schema.prisma`'s declarative syntax and is hard to exercise
  deterministically in the existing e2e suite. See `docs/ASSUMPTIONS.md` ASM-57.
- Document checksum re-verification at download time — computed and checked at upload/
  version-create only; not a live risk with the current local-filesystem storage provider's
  single write path, but not re-verified on read either. See `docs/ASSUMPTIONS.md` ASM-58.
