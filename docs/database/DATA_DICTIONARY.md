# DATA DICTIONARY — Database Foundation (Phase 02A, extended by Phase 03 Security, Phase 04 Core CRM, Phase 05 Commercial, Phase 06 Operations, Phase 07 Profile Development, Phase 08 Admission, Phase 09 Visa, Phase 10 Partner CRM + Commission)

Source of truth: `database/schema.prisma`. Table/column names below use the actual
Postgres identifiers (`@map`/`@@map` targets in the schema), not the Prisma model names.

## 1. Scope

Implements every entity required by `02-foundation/01_DATABASE_FOUNDATION.md`:
User, Role, Permission, RolePermission, Lead, Student, StudentContact, Case, CaseMember,
Assessment, Roadmap, RoadmapMilestone, Task, TaskDependency, University, Program,
ScholarshipMaster, Application, Document, Contract, ContractTemplate, ContractAmendment,
Payment, Partner, PartnerProgram, PartnerDocument, AuditLog, Notification, Approval,
Comment — 29 tables. Plus, from `03-security/01_AUTH.md`: Session, PasswordResetToken,
MfaSecret, MfaBackupCode (section 4.20); from `05-commercial`: `ContractReviewLink`
(section 4.15) and the Contract/Payment column additions in the same section; from
`06-operations`: `TaskTemplate` (section 4.7) and the Task/Notification column additions
in sections 4.7/4.17; and a handful of columns on existing tables
(`users.locked_until`, `students`/`student_contacts.portal_user_id`,
`audit_logs.metadata`).

Extended by Phase 07 (`07-profile/`): `AssessmentCriterion`, `RoadmapMilestoneDependency`,
`AcademicRecord`, `TestRecord`, `Competition`, `ResearchProject`, `Activity`,
`WritingArtifact`, `WritingVersion`, `LetterOfRecommendation` (sections 4.8-4.10 below) —
plus building the `Document`/`DocumentAccess` controller+service (section 4.14) that the
schema had carried since Phase 02.

Extended by Phase 08 (`08-admission/`): `UniversityChoice`, `ApplicationChecklist`,
`Offer`, `ScholarshipApplication` (sections 4.11-4.12 below) — the Admission domain's
foundation-slice entities (University/Program/ScholarshipMaster/Application) now fully
built out with real services, workflow, and RBAC for the first time.

Extended by Phase 09 (`09-visa/`): `Visa`, `VisaChecklistTemplate`, `VisaChecklistItem`,
`Enrollment` (section 4.13 below) — plus the four new `CasesService.close()` precondition
checks and the `TaskTemplateTrigger.VISA_GRANTED` enum value (see section 4.13 and section
4.7's Task Engine notes).

Extended by Phase 10 (`10-partners/`): `PartnerStudentLink`, `CommissionRule`,
`CommissionTransaction` (section 4.16 below, new) — the Partners domain's foundation-slice
entities (`Partner`/`PartnerProgram`/`PartnerDocument`, schema-only since Phase 02) now
fully built out with real services, workflow, and RBAC for the first time, the same
"schema waited, this phase builds it" pattern Phase 07 applied to Documents and Phase 08
applied to Admission. `PartnerDocument` additionally gained `status`/`owner_id` columns and
a real `document_id` FK (replacing the unused Phase 02 `file_reference` string column).

Deferred to their owning phase (see `docs/architecture/DOMAIN_MAP.md` / `docs/PHASE_MAP.md`
for exactly where): PartnerStudentLink, CommissionRule, CommissionTransaction (Phase 10).

## 2. Additions beyond the required list

Two tables exist that are not in the 40-core-entity business model
(`00-context/00_MASTER_CONTEXT.md` / SRS section 7) and not in the Phase 02 required list
either. Both are justified by an explicit requirement in the Phase 02 instruction files
themselves, not invented ahead of scope (MASTER_CONTEXT Hard Rule #10 "Không silently
invent business rules"):

| Table | Justification |
|---|---|
| `document_access` | `01_DATABASE_FOUNDATION.md` requires `Document` in this phase, and SRS 6.19/6.21 + NFR-SEC-04 + Hard Rule #6 ("Private files không có public URL") make a Document meaningless from a security standpoint without a way to check *who* may view/download/edit/share it before a signed URL is ever issued. This is `DocumentAccess` from the 40-core-entity list (SRS section 7 already names it) — brought forward into Phase 02 because Document's own security requirement demands it, not a new invention. |
| `business_id_sequences` | `01_DATABASE_FOUNDATION.md` rule "business IDs immutable" + SRS section 8's ID format table cannot be satisfied by application code alone without *some* durable, race-safe counter. Backs `common/id/id-generator.service.ts`. Not a business entity — no business or reporting query ever reads it directly. |
| `idempotency_keys` | `02_API_FOUNDATION.md` explicitly requires an "idempotency strategy cho transaction-sensitive endpoint" — this table is what `common/idempotency/idempotency.interceptor.ts` persists against. Not a business entity. TTL via `expires_at`; expired rows are not yet auto-purged (see Known Issues in `docs/phase-status/PHASE_02.md` — a cleanup job is a Phase 12 (`12-platform/02_INTEGRATIONS_JOBS.md`) concern, not this phase's). |

## 3. Conventions applied to every table

- **Primary key**: `id UUID DEFAULT gen_random_uuid()`-equivalent (Prisma `@default(uuid())`) on every table except the two-column composite-key join/infra tables (`role_permissions`, `case_members`, `task_dependencies`, `business_id_sequences`). Internal FKs always reference this UUID, never the business code (SRS section 10: "dùng UUID/internal IDs bên trong... business ID hiển thị theo format quy định").
- **Business ID**: a separate `*_code` column, `UNIQUE`, immutable once set (MASTER_CONTEXT "business IDs immutable"; SRS section 8 "ID không thay đổi trong vòng đời bản ghi"). Never reused after archive — the generator (`BusinessIdSequence`) only increments.
- **Timestamps**: `created_at DEFAULT now()` on every table; `updated_at` (auto-managed `@updatedAt`) on every table whose rows are ever mutated after insert. `AuditLog` and the two join tables that are never updated in place do not have `updated_at`.
- **Soft delete / archive**: `archived_at TIMESTAMP NULL` on `students`, `cases`, `contracts`, `documents` — the four entities SRS explicitly calls out as never hard-deleted (Hard Rule #5). No `deleted_at` boolean flag anywhere; a nullable timestamp doubles as "is archived" and "when."
- **Immutable/legal records**: `contracts.signed_at` + no update path exposed by the API once `status = SIGNED` — enforced at the service layer (`ContractsService.update()`'s `requireStatus(['DRAFT'])` guard, Phase 05); live terms can still change after signing, but only through `ContractAmendment` (before/after snapshot), never a direct field edit. The DB layer allows the column to change because Postgres has no first-class "freeze after condition" constraint without a trigger, which is out of scope for this foundation.
- **Currency**: `CHAR(3)` (ISO 4217) alongside every `DECIMAL(14,2)` money column — never a bare number with an implied currency.
- **Country code**: `CHAR(2)` (ISO 3166-1 alpha-2), per SRS section 8.
- **JSONB usage**: only `assessments.baseline`, `assessments.gap`, `notifications.payload`, `documents`/`idempotency_keys` response-style blobs, `contract_templates.merge_fields`, and audit before/after snapshots — all metadata/semi-structured-by-nature fields, never a substitute for a normalized relation on a core entity (SRS section 17 "JSONB cho field mở rộng nhưng entity cốt lõi phải normalize").

## 4. Table reference

### 4.1 `users` (Identity)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| username | text UNIQUE | |
| email | text UNIQUE | |
| password_hash | text | Never plaintext (SRS 6.1). Hashing algorithm/policy is Phase 03. |
| full_name | text | |
| status | enum (`ACTIVE`,`SUSPENDED`,`OFFBOARDED`) | SRS 6.1. |
| role_id | uuid FK -> roles.id | Single role per user (SRS 6.1's per-module/action permission model is expressed through Role -> RolePermission, not multi-role users — see docs/ASSUMPTIONS.md ASM-04). |
| last_login_at | timestamp null | |
| failed_login_count | int default 0 | Backs "khóa tài khoản sau ngưỡng thất bại" (SRS 6.1) — the lockout *policy* itself is Phase 03. |
| offboarded_at | timestamp null | |

### 4.2 `roles` (Identity)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | enum RoleCode UNIQUE | Fixed set of 8 (SRS section 3). |
| name, description | text | Editable label — the *code* is what business logic keys off. |
| active | bool | |

### 4.3 `permissions` / `role_permissions` (Identity)
| Column | Type | Notes |
|---|---|---|
| permissions.resource | text | e.g. `students`. |
| permissions.action | text | e.g. `view`, `create`, `edit`, `approve`, `download`, `export`, `share`, `delete`, `assign` (SRS 6.1). |
| permissions.field_scope | text null | For a future field-level grant (SRS 6.1/13); unused by Phase 02's own seed. |
| UNIQUE(resource, action, field_scope) | | |
| role_permissions | (role_id, permission_id) composite PK | Many-to-many join. |

### 4.4 `leads` (CRM)
| Column | Type | Notes |
|---|---|---|
| lead_code | text UNIQUE | `LEAD-YYYY-NNNNN`. |
| major_interest | text null | Phase 04 addition (`04-core-crm/01_LEAD.md` field list). |
| status | enum LeadStatus | New→Contacted→Qualified→Consultation→Contracting→Converted/Lost (SRS 6.2). `CONVERTED` reachable only via the `POST /leads/:id/convert` service method, never a bare status PATCH — see `LeadsService.LEAD_TRANSITIONS`. |
| converted_student_id | uuid FK -> students.id, null — **NOT unique** | Set on conversion. Deliberately not unique — more than one Lead can resolve to the same Student via the merge flow (SRS 6.2, `docs/ASSUMPTIONS.md` ASM-11). Was `@unique` in Phase 02; fixed in Phase 04 after the merge path hit a real constraint violation in testing (`docs/DECISIONS.md` DEC-03). Indexed (non-unique) for query performance. |
| owner_id | uuid FK -> users.id | |
| "notes" (SRS/04_LEAD.md field) | *not a column* | Backed by `comments` (`entity_type='Lead'`) instead — see `docs/ASSUMPTIONS.md` ASM-10. |

### 4.5 `students` / `student_contacts` (Case Management)
| Column | Type | Notes |
|---|---|---|
| students.student_code | text UNIQUE | `HS-YYYY-NNNNN`. |
| students.budget / budget_currency | decimal(14,2) / char(3) | Sensitive field (SRS section 13) — no column-level DB restriction; field-level filtering is Phase 03. |
| students.archived_at | timestamp null | Soft delete. |
| student_contacts.student_id | uuid FK, ON DELETE CASCADE | A contact cannot outlive its Student. |
| student_contacts.portal_status | enum PortalLinkStatus (NONE/INVITED/ACTIVE/REVOKED) | Phase 11 addition — the parent-portal relationship's own lifecycle, independent of whether `portal_user_id` happens to be set (kept, never nulled, even after REVOKED — history/audit). Every `ScopePolicyService` OWN_STUDENT check requires `portal_status = ACTIVE`, not merely a non-null `portal_user_id` — access is denied on the next request after revocation, no caching. See `docs/ASSUMPTIONS.md` ASM-46. |
| student_contacts.revoked_at / revoked_by_id | timestamp null / uuid null | Phase 11 — set together by `PortalAccessService.revokeParentAccess`. `revoked_by_id` has no `User` back-relation, same FK-less "who did this" pointer pattern as `roadmap_milestones.owner_id` (section 4.8). |

### 4.6 `cases` / `case_members` (Case Management)
| Column | Type | Notes |
|---|---|---|
| cases.case_code | text UNIQUE | `CASE-YYYY-NNNNN`. |
| cases.contract_id | uuid FK -> contracts.id, UNIQUE, null | One Contract activates at most one Case. Null at Case creation (Phase 04 creates Cases without a Contract — `docs/ASSUMPTIONS.md` ASM-12) — Phase 05's `ContractsService.sign()` sets this, at signing time, not at Contract creation time (`docs/ASSUMPTIONS.md` ASM-15). |
| cases.department | text null | Phase 04 addition (`04-core-crm/02_STUDENT_CASE.md` field list) — descriptive/master-data-style only, NOT used for RBAC scope (`docs/ASSUMPTIONS.md` ASM-06). |
| cases.status | enum CaseStatus | Open/Active/On Hold/Completed/Closed/Archived (SRS section 9). `CLOSED` reachable only via `PATCH /cases/:id/close` (closure reason required + open-task guard), never the generic status PATCH — see `CasesService.CASE_TRANSITIONS`/`CLOSABLE_FROM`. |
| cases.closure_reason | text null | Required by the service layer when status transitions to Closed (SRS section 9) — not a DB CHECK constraint in this phase. |
| case_members | (case_id, user_id) composite PK | `role` = OWNER or COLLABORATOR. `removed_at` (Phase 04 addition, nullable) marks a member no longer active without deleting the row — see `docs/database/ERD.md` section 3 / the CaseMember model's own doc comment for why this stays a flat table rather than a full history log. |
| **Invariant (Phase 04, service-layer, not a DB constraint)** | | At most one `Case` per `student_id` with `status NOT IN (CLOSED, ARCHIVED)` at any time — enforced by `CasesService.createForStudent` and `LeadsService.convert` (which reuses an existing active Case instead of creating a second one). Not a partial unique index because Postgres partial-unique-on-enum-set is workable but the service-layer check already needed to run anyway (for the friendlier `409 DUPLICATE_ACTIVE_CASE` error with the existing case's id) — a DB-level backstop could still be added later without changing this behavior. |

### 4.7 `tasks` / `task_dependencies` / `task_templates` (Case Management — extended Phase 06)
| Column | Type | Notes |
|---|---|---|
| tasks.task_code | text UNIQUE | `TASK-YYYY-NNNNN`. |
| tasks.case_id | uuid FK, null | A task can exist without a case (e.g. an internal ops task) — nullable by design. |
| tasks.status | enum TaskStatus | No `OVERDUE` value — derived, see ERD.md section 3. `TasksService.isOverdue` is the single function every read path uses (list filter, computed response field) — 06-operations/01_TASK.md "Không tạo nhiều implementation khác nhau cho overdue." Status FSM (`TasksService.TASK_TRANSITIONS`): NOT_STARTED→{IN_PROGRESS,BLOCKED,CANCELLED}, IN_PROGRESS→{BLOCKED,DONE,CANCELLED}, BLOCKED→{IN_PROGRESS,CANCELLED}, DONE/CANCELLED terminal. |
| tasks.blocker | text null | Required (non-empty) whenever `status` moves to BLOCKED — 06-operations rule "task Blocked phải thể hiện blocker hợp lý," enforced in `TasksService.updateStatus`, not just at the DB/DTO level. |
| tasks.quality_score | int null | Feeds KPI (SRS 6.18) — computed *from* here in a later phase, never entered directly as a KPI number (AC-15). Settable only via the status-transition endpoint (paired with marking DONE), not the generic field-edit endpoint. |
| tasks.template_id / source_entity_type / source_entity_id | uuid FK null / text null / text null | Auto-generation lineage (Phase 06) — set only for tasks created by `TaskGenerationService`. `(template_id, source_entity_type, source_entity_id)` is UNIQUE — the idempotency guard (06-operations "task generation phải idempotent"); NULL-for-manual-tasks coexist freely under Postgres unique-index NULL semantics (same pattern as `payments.reference`). See `docs/ASSUMPTIONS.md` ASM-19 for what "idempotent" means across repeat stage re-entries, not just literal retries. |
| task_dependencies | (task_id, depends_on_task_id) composite PK | Self-dependency and circular-dependency (`TasksService.wouldCreateCycle`, a graph walk) rejected server-side before insert — never a frontend-only check. Completing a task (`status → DONE`) requires every `dependsOnTask` to already be DONE **or** CANCELLED — see `docs/ASSUMPTIONS.md` ASM-17 for why CANCELLED also satisfies the gate. |
| task_templates.trigger_event | enum TaskTemplateTrigger (CASE_CREATED, CASE_STAGE_CHANGED, CONTRACT_ACTIVATED) | 06-operations/01_TASK.md names `application`/`visa`/`scholarship` triggers too, but no owning entity/controller exists yet (Phase 07/08/09) — only the three buildable-now triggers are modeled; see `docs/ASSUMPTIONS.md` ASM-16 and the enum's own schema.prisma comment. |
| task_templates.trigger_stage_value | text null | Only meaningful for CASE_STAGE_CHANGED — the `cases.stage` value (free text) that fires this template. |
| task_templates.deadline_offset_days | int null | Nullable in the DB, but required at the `CreateTaskTemplateDto` level — every generation source must produce a task with a concrete deadline (`tasks.deadline` is NOT NULL). |
| tasks.visible_to_student | bool, default false | Phase 11 Portal addition — every pre-Phase-11 task (and every new one unless explicitly opted in) stays staff-only, matching Phase 06's original "internal tooling" intent unchanged. Portal's `PortalController` task routes only ever query `visibleToStudent: true` rows and reach them through dedicated `TasksService.listForStudentPortal`/`getForStudentPortal`/`portalSubmitOutput`/`portalUpdateStatus` methods — never the staff `assertTaskAccessible` path, which explicitly 404s all OWN_STUDENT callers. `FieldPolicyService.redactTaskForPortal` additionally hides `blocker`/`qualityScore`/`ownerId` on every student-facing task response. |

### 4.8 `assessments` / `assessment_criteria` / `roadmaps` / `roadmap_milestones` / `roadmap_milestone_dependencies` (Counseling — extended Phase 07)
| Column | Type | Notes |
|---|---|---|
| assessments.status | enum (`DRAFT`,`REVIEW`,`APPROVED`,`SUPERSEDED`) | `REVIEW` added Phase 07. Approved rows are never edited — a new version row is inserted instead (UNIQUE(case_id, version)); moving from APPROVED to a new DRAFT version auto-supersedes the prior row in the same transaction. |
| assessments.change_reason | text null | Required (DTO-level `CHANGE_REASON_REQUIRED`) only when creating a new version off a previously-APPROVED one — null for a case's first (version 1) assessment. Phase 07. |
| assessments.approved_by_id / approved_at | uuid null / timestamptz null | Set by `POST /assessments/:id/approve`, held by `assessments:approve` (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only — CONSULTANT never holds `approve`, separation of duties, see `docs/ASSUMPTIONS.md` ASM-25). Phase 07. |
| assessments.baseline / gap | jsonb null | Legacy Phase 02 columns, left in place but unused by Phase 07 code — gap analysis now lives per-criterion in `assessment_criteria.gap` (see below), which is queryable/typed instead of an opaque blob. |
| assessment_criteria | UNIQUE(assessment_id, area) | Phase 07. One row per assessment area (`area` free text — Academic/English/Test/Research/Competition/Leadership/Community/Awards/Writing suggested, not hard-coded). `current_score`/`target_score`/`gap` are `DECIMAL(6,2)` (not JSON) so gap analysis is a real, comparable number per area. `evidence_document_id` is a real FK to `documents` (not a string reference — see `docs/ASSUMPTIONS.md` ASM-24). |
| roadmaps.assessment_id | uuid FK null | Baseline this roadmap version was approved against — a stable pointer to one specific `Assessment` row, never silently repointed to a newer version. |
| roadmaps.status | enum RoadmapStatus | Draft→Review→Approved→Active→Completed→Archived (SRS 6.5). `ACTIVE` requires the roadmap itself be APPROVED **and** its baseline Assessment be APPROVED (service-layer FSM, `RoadmapsService`) — see section 5 below. |
| roadmap_milestones.owner_role | enum RoleCode null | Which role template owns the milestone by default (Phase 02). |
| roadmap_milestones.owner_id | uuid null | Phase 07 addition — the actual assigned staff member, distinct from `owner_role`. Validated server-side as a member of the roadmap's Case (`MilestonesService.assertValidOwner`) when set — see `docs/ASSUMPTIONS.md` ASM-20. |
| roadmap_milestones.target / evidence_document_id | text null / uuid FK null | Phase 07 additions — `target` is free-text (a metric's target value); `evidence_document_id` is a real FK to `documents`. |
| roadmap_milestones.status | enum MilestoneStatus | Phase 07 — reuses `TaskStatus`'s shape (NOT_STARTED/IN_PROGRESS/BLOCKED/DONE/CANCELLED), same FSM semantics as `tasks.status`. |
| tasks.milestone_id | uuid FK null | Phase 07 — Task Engine reuse, not a duplicate: lets a Roadmap milestone's execution work be tagged onto ordinary `Task` rows via `TasksService.createForCase`'s optional `milestoneId` parameter. Nullable so every pre-Phase-07 task (and any task with no milestone) is unaffected. |
| task_templates.trigger_event | enum TaskTemplateTrigger, +`ROADMAP_APPROVED` (Phase 07) | Fires `TaskGenerationService.generateForEvent` once when a Roadmap transitions to APPROVED — reuses the exact Phase 06 idempotency mechanism (`(template_id, source_entity_type, source_entity_id)` unique constraint), no new dedup logic. See `docs/ASSUMPTIONS.md` ASM-16/ASM-19. |
| roadmap_milestone_dependencies | (milestone_id, depends_on_milestone_id) composite PK, both FK cascade | Phase 07. Deliberately a **separate** table from `task_dependencies`, not a reuse of it — a Milestone is a planning-level unit distinct from task-execution ordering (`docs/ASSUMPTIONS.md` ASM-22). Same self/circular-dependency rejection (graph walk) and DONE-or-CANCELLED completion gate as `task_dependencies`, enforced in `RoadmapsService`/`MilestonesService`. Milestone completion additionally requires every tagged `Task` to be DONE/CANCELLED (combining both dependency graphs). |

### 4.9 `academic_records` / `test_records` / `competitions` / `research_projects` / `activities` (Counseling, Profile Evidence — Phase 07)
| Column | Type | Notes |
|---|---|---|
| academic_records.period | text | Free text (e.g. "Grade 11, 2024–2025") — school terms/calendars vary too widely for a fixed enum. A later period is always a NEW row, never a replacement of an earlier one (SRS 6.7, Hard Rule #4); correcting THIS period's own GPA in place is fine — that's not the history the rule protects. |
| academic_records.gpa / grading_scale | decimal(5,2) null / text null | `grading_scale` is free text (4.0, 10, %, ...) — not hard-coded to one scale. |
| test_records | UNIQUE(case_id, test_type, attempt_number) | `test_type` is free text — 07-profile/02_PROFILE_EVIDENCE.md "Không hard-code chỉ IELTS hoặc SAT." One row per attempt; a new attempt is always a new row, the previous attempt's row is never overwritten. Rejecting a duplicate `(case_id, test_type, attempt_number)` insert is the `DUPLICATE_TEST_ATTEMPT` business error, not silently allowed to violate the unique index. |
| test_records.subscores | jsonb null | Sub-score breakdown (e.g. IELTS band per skill) — semi-structured by nature, not a core normalized field (same JSONB-usage rule as section 3). |
| competitions | — | One row per participation — "nếu có nhiều competition, mỗi participation là một record riêng" (SRS 6.8), never folded into a single Student-level summary. |
| research_projects | — | Deliberately its own entity, not folded into `activities` or `writing_artifacts` (07-profile/02_PROFILE_EVIDENCE.md "Không tạo Research model trùng với Activity hoặc Writing") — captures mentor/methodology/publication that neither of those models has. |
| activities.category | text null | Free text/configurable — "Không giới hạn activity vào một loại cố định." |
| activities.verified_by_id / verified_at, academic_records.verified_by_id / verified_at, test_records.verified_by_id / verified_at | uuid null / timestamptz null | Staff verification metadata — set by the `verify` action, not implied by mere record existence. |
| `*.evidence_document_id` (all five tables) | uuid FK null | Real FK to `documents`, not a plain string reference — see `docs/ASSUMPTIONS.md` ASM-24. Creating/setting this link triggers `DocumentsService.grantCaseAccess(documentId, caseId)`, granting VIEW+DOWNLOAD to every current CaseMember plus the linked student/parent portal users — evidence is never visible without an explicit, server-checked grant. |

### 4.10 `writing_artifacts` / `writing_versions` / `letters_of_recommendation` (Counseling, Writing — Phase 07)
| Column | Type | Notes |
|---|---|---|
| writing_artifacts.type | text | Free text (Resume/Essay/SOP/Motivation Letter/Study Plan/LOR/custom...) — same configurable-field precedent as `cases.stage`/`assessment_criteria.area`, not a fixed enum a new writing type would need a migration to add. |
| writing_artifacts.status | enum WritingStatus | Draft→Review→Revision→Final→Submitted, server-enforced (`WritingArtifactsService.updateStatus`) — illegal jumps rejected, never a client-supplied arbitrary status. Creating a new `WritingVersion` on a FINAL/SUBMITTED artifact auto-reverts it to REVISION. |
| writing_versions | UNIQUE(artifact_id, version_number) | "WritingArtifact và WritingVersion phải tách biệt. Không overwrite version cũ" — a version row, once created, is never updated except its own review fields (`review_status`/`reviewer_id`/`reviewed_at`, a verdict not content). There is no "edit this version's text" endpoint at all — new content always means a new row with `version_number + 1`, so destructive editing of Final/Submitted content is structurally impossible, not just policy-forbidden. |
| writing_versions.content / document_id | text null / uuid FK null | A version carries inline text content, an uploaded-file reference (real FK to `documents`), or both. |
| writing_versions.review_status | enum WritingReviewStatus (PENDING/APPROVED/CHANGES_REQUESTED) | A per-version reviewer verdict, distinct from `writing_artifacts.status` (the overall workflow gate). Review feedback/comments reuse the existing `comments` table (`entity_type = 'WritingVersion'`) — no duplicate `ReviewComment` entity, per 03_WRITING.md. |
| letters_of_recommendation.request_status / submission_status | enum LorRequestStatus (NOT_REQUESTED/REQUESTED/IN_PROGRESS/RECEIVED/DECLINED) / enum LorSubmissionStatus (PENDING/SUBMITTED/NOT_REQUIRED) | Its own entity, not a `writing_artifacts` row typed "LOR" — a recommendation letter's tracking shape (recommender contact, request/submission logistics) has nothing in common with `writing_versions`' content/review shape. |
| letters_of_recommendation.contact_email / contact_phone / internal_notes | text null / text null / text null | Field-level restricted from STUDENT_PARENT (`FieldPolicyService.redactLor`) — recommender contact details and internal counseling notes are staff-only; `recommender_name`/`relationship`/`request_status`/`submission_status` remain visible. See `docs/security/RBAC_MATRIX.md` section 5. |
| letters_of_recommendation.evidence_document_id | uuid FK null | Real FK to `documents`, same grant-on-link pattern as section 4.9's evidence fields. |

### 4.11 `universities` / `programs` / `scholarship_masters` / `university_choices` (Admission, Master Data — foundation slice, extended Phase 08)
| Column | Type | Notes |
|---|---|---|
| universities/programs/scholarship_masters.status | enum MasterDataStatus | Active/Inactive — configurable master data, not hard-coded (SRS section 2). |
| *.last_verified_at | timestamp null | SRS 6.9 "Lưu source URL và last_verified_at". Phase 08 adds a dedicated `POST .../:id/verify` action (its own `admission_master:verify` permission, distinct from `edit`) that stamps only this column — "Source/verification fields có thể có permission riêng." |
| universities.university_code / programs.program_code / scholarship_masters.scholarship_code | text UNIQUE | `UNI-YYYY-NNNNN` / `PRG-YYYY-NNNNN` / `SCHM-YYYY-NNNNN` — Phase 08 populated these Phase-02-defined columns for the first time; none of the three formats are in `00-context/00_MASTER_CONTEXT.md`'s ID table, so they were invented (the `M` in `SCHM` disambiguates from `SCH-YYYY-NNNNN`, already reserved for Scholarship *Application*) — see `docs/ASSUMPTIONS.md` ASM-26. |
| universities.owner_id / university_choices.owner_id / application_checklist_items.owner_id (section 4.12) | uuid null | Phase 08 — FK-less plain string pointer to a User, same "assigned-staff pointer, not a formal relation" pattern as `roadmap_milestones.owner_id` (Phase 07); no `User` back-relation added. See `docs/ASSUMPTIONS.md` ASM-27. |
| programs.university_id | uuid FK | Program must belong to exactly one University — "Không duplicate Program chỉ vì nhiều application"; Application references a Program by ID only, never a duplicated university-name string. |
| programs.requirements / source | text null / text null | Phase 08 additions — `requirements` (admission/entry requirements, distinct from `eligibility`) and `source` (where the data came from) per 08-admission/01_MASTER_DATA.md's field list. `application_fee` has no separate currency column of its own — it shares `tuition_currency` (a program's application fee is charged by the same institution, same currency, as its tuition; a dedicated `application_fee_currency` column was judged a redundant near-duplicate). |
| scholarship_masters.university_id / program_id | uuid FK null / uuid FK null | Both nullable — a scholarship may tie to a specific Program OR directly to a University generally (08-admission "program/university"). A business-level convention (usually exactly one is set), not DB-enforced beyond both being independently optional FKs. |
| scholarship_masters.percentage | decimal(5,2) null | Phase 08 addition — some scholarships are percentage-of-tuition rather than a fixed `amount`; both nullable, a row uses whichever applies. |
| Duplicate checks (service layer, not DB constraints) | | `DUPLICATE_UNIVERSITY` ((official_name, country_code), case-insensitive), `DUPLICATE_PROGRAM` ((university_id, degree_level, major, intake)), `DUPLICATE_SCHOLARSHIP_MASTER` ((provider, name, university_id, program_id)) — 08-admission "kiểm tra duplicate University/Program/ScholarshipMaster." |
| universities/programs/scholarship_masters.source_url / external_id / retrieved_at / sync_status | text null / text null / timestamp null / enum ExternalSyncStatus | Phase 12 additions (12-platform/02_INTEGRATIONS_JOBS.md "External data: source, URL, retrieved_at, last_verified_at, sync status, external ID"), completing `source`/`last_verified_at` above. `UniversitiesService.syncExternal` matches by `external_id` only (never inserts a new row) — see `docs/ASSUMPTIONS.md` ASM-51. `sync_status = MANUAL_OVERRIDE` when a staff member has verified a row more recently than the last sync — the sync skips it rather than overwriting. Program/ScholarshipMaster carry the same columns for schema consistency; no sync method reads/writes them yet (no concrete data source exists for either). |
| university_choices | UNIQUE(student_id, program_id) | Phase 08, new table. School Selection — a Student's own Reach/Match/Safety shortlist, deliberately NOT stored on University/Program master ("Không đưa Reach/Match/Safety vào University hoặc Program master"). `case_id` nullable (School Selection may start before a Case formally exists — 01_MASTER_DATA.md's own field list omits Case entirely) — see `docs/ASSUMPTIONS.md` ASM-28. Scope resolves via whichever FK is set: `assertCaseAccessible` when `case_id` is present, `assertStudentAccessible` otherwise. |
| university_choices.tier | enum UniversityChoiceTier (REACH/MATCH/SAFETY) | — |
| university_choices.status | enum UniversityChoiceStatus (PROPOSED/SHORTLISTED/CONFIRMED/REMOVED) | Light workflow, no hard-delete (Hard Rule #5) — REMOVED archives a choice without deleting the row. |
| university_choices.reviewed_by_id / reviewed_at / review_notes | uuid null / timestamp null / text null | Set together by a dedicated `POST .../review` action — "review information nếu được yêu cầu" — never by the generic edit endpoint. |

### 4.12 `applications` / `application_checklist_items` / `offers` / `scholarship_applications` (Admission, Application + Offer + Scholarship — Phase 08)
| Column | Type | Notes |
|---|---|---|
| applications.application_code | text UNIQUE | `APP-YYYY-NNNNN`. |
| applications.case_id | uuid FK, NOT NULL | Tightened from Phase 02's nullable shape — 08-admission/02_APPLICATION.md requires "Application phải liên kết Student, Case, University, Program"; safe/additive since zero `applications` rows existed before this phase (confirmed via row-count check). University is reached via `programs.university_id`, never a duplicated direct FK. |
| applications.intended_intake | text null | Phase 08 addition — the specific intake this Application targets, distinct from `programs.intake` (the program's general cadence); part of the duplicate-application uniqueness combination below. |
| applications.status | enum ApplicationStatus (Planning/Preparing/ReadyForReview/Submitted/Offer/Waitlist/Reject/Withdrawn) | Server-side FSM (`ApplicationsService`), no bare client-supplied status. `SUBMITTED` reachable only via `POST .../submit` (checklist precondition — see below); `OFFER` reachable only via `OffersService.create` → `ApplicationsService.transitionToOffer`, never the generic `PATCH .../status` — "Không được chuyển Offer nếu chưa có offer record tương ứng." |
| applications.submitted_at / submission_channel / submission_reference / evidence_document_id | timestamp null / text null / text null / uuid FK null | Submission record (08-admission "submitted_at, channel, reference, evidence") — set together, once, on the READY_FOR_REVIEW → SUBMITTED transition; never overwritten by a later resubmission of the SAME row (a genuine resubmission is a new Application row — see the duplicate-prevention row below). `evidence_document_id` is a real FK (Phase 07 ASM-24 precedent continued), not a plain string reference. |
| (student_id, program_id) on applications | plain index, NOT unique | Phase 02's original `@@unique([studentId, programId])` was relaxed to a service-layer "at most one non-terminal Application per (student_id, program_id, intended_intake)" check (`ApplicationsService.assertNoActiveDuplicate`, `409 ACTIVE_APPLICATION_EXISTS`) — the hard DB constraint would have permanently blocked legitimate reapplication after REJECT/WITHDRAWN. See `docs/DECISIONS.md` DEC-05. |
| application_checklist_items | FK to applications, cascade | One row per required/optional checklist item (08-admission checklist field list: required/owner/deadline/status/document/notes). `document_id` is a real FK into `documents` — no separate ApplicationFile/storage model. Mandatory-item completion (`required = true` AND `status NOT IN (DONE, WAIVED)`) is checked server-side before SUBMITTED, not just displayed. |
| application_checklist_items.status | enum ChecklistItemStatus (PENDING/IN_PROGRESS/DONE/WAIVED) | `completed_at` stamped when status first becomes DONE or WAIVED, cleared otherwise. |
| offers | FK to applications, cascade | Belongs to exactly one Application; an Application may carry multiple Offer rows over time (08-admission "một Application có nhiều offer... không overwrite offer lịch sử") — a revised/renegotiated offer is a NEW row. "Current offer" (`OffersService.getCurrent`) is a computed read (ACCEPTED first, else most recent non-expired RECEIVED), not a stored flag — same "computed, not synced" precedent as `tasks.status`'s derived-overdue rule. |
| offers.offer_type | text | Free text (Unconditional/Conditional/Deferred/...), same configurable-field precedent as `writing_artifacts.type`. |
| offers.is_conditional | bool | Explicit flag alongside the free-text `conditions` column — "kiểm tra... conditional offer" as a queryable fact, not just implied by non-null conditions text. |
| offers.status | enum OfferStatus (RECEIVED/ACCEPTED/DECLINED/EXPIRED/WITHDRAWN) | A RECEIVED offer past `acceptance_deadline` is lazily synced to EXPIRED on read (`OffersService.syncExpired`) — same lazy-sweep pattern as `payments.status = OVERDUE` (section 4.15). |
| scholarship_applications.scholarship_application_code | text UNIQUE | `SCH-YYYY-NNNNN` (master context-defined format). |
| scholarship_applications.case_id | uuid FK, NOT NULL | Required, unlike `university_choices.case_id` — the phase orchestration's cross-cutting linkage requirement explicitly names Case for ScholarshipApplication even though 03_OFFER_SCHOLARSHIP.md's own field list omits it; see `docs/ASSUMPTIONS.md` ASM-28. |
| scholarship_applications.scholarship_master_id | uuid FK | Kept fully separate from `scholarship_masters` — "Keep ScholarshipMaster separate from ScholarshipApplication"; many applications reference one master row via FK, never copied per applicant. |
| scholarship_applications.application_id | uuid FK null | Optional — a scholarship can be pursued independently of any specific university Application; when set, referenced by FK only, "không copy toàn bộ program/university data vào ScholarshipApplication." |
| scholarship_applications.status | enum ScholarshipApplicationStatus (Planning/Submitted/UnderReview/Interview/Awarded/Rejected/Withdrawn) | No exact status list was given by 03_OFFER_SCHOLARSHIP.md (only a field list) — this FSM was designed as a reasonable minimal workflow, documented as an assumption where the instruction was silent. AWARDED/REJECTED reachable only via their own dedicated `/award`/`/reject` actions, never the generic `PATCH .../status` (an award carries required extra data a bare status flip can't express safely). |
| scholarship_applications.eligibility_confirmed / eligibility_notes | bool default false / text null | "Kiểm tra eligibility trước các bước yêu cầu" — SUBMITTED is blocked (`409 ELIGIBILITY_NOT_CONFIRMED`) until a dedicated `POST .../confirm-eligibility` action sets this. Distinct from `scholarship_masters.eligibility` (the master's stated criteria text) — this is per-application staff verification that a specific student meets it. |
| scholarship_applications.essay_artifact_id | uuid FK null | Reuses the Phase 07 Writing subsystem (`writing_artifacts.type = 'Scholarship Essay'`, free text) instead of a duplicate essay/content field — "Không tạo duplicate entity." See `docs/ASSUMPTIONS.md` ASM-29. |
| scholarship_applications.internal_notes | text null | Staff-only strategy/interview commentary — field-level redacted from STUDENT_PARENT (`FieldPolicyService.redactScholarshipApplication`), same pattern as `letters_of_recommendation.internal_notes`. |
| scholarship_applications.award_amount / award_currency / award_coverage_type / award_period / award_acceptance_deadline / evidence_document_id | decimal(14,2) null / char(3) null / text null / text null / timestamp null / uuid FK null | SCHOLARSHIP RESULT (08-admission) — populated together by `POST .../award`. Deliberately no FK/shared column with `contracts`/`payments`/a future `commission_transactions` table — "Không trộn: scholarship amount / student contract fee / tuition payment / partner commission." |
| "documents" need for ScholarshipApplication | — | Satisfied by `documents.owner_entity = 'ScholarshipApplication'` (the pre-existing Phase 02 polymorphic pattern) rather than a duplicate checklist/attachment entity — see `docs/ASSUMPTIONS.md` ASM-29. |

### 4.13 `visas` / `visa_checklist_templates` / `visa_checklist_items` / `enrollments` (Visa — Phase 09)
| Column | Type | Notes |
|---|---|---|
| visas.visa_code | text UNIQUE | `VISA-YYYY-NNNNN` (master-context-defined format). |
| visas.case_id | uuid FK, NOT NULL | Visa always links to an existing Student/Case, never creating one — 09-visa "Visa phải liên kết Student/Case đã tồn tại." |
| visas.offer_id | uuid FK null | Nullable — not every Case's visa process is tied to one specific accepted Offer at creation time (a Case may proceed to Visa preparation while multiple Offers are still open); when set, disambiguates which Application/Offer/Program/University this Visa is for. |
| visas.visa_type | text | Free text (F-1/Student Visa/Tier 4/...), same configurable-field precedent as `offers.offer_type`/`writing_artifacts.type` — never a hard-coded enum. |
| visas.status | enum VisaStatus (NOT_STARTED/PREPARING/READY/SUBMITTED/APPOINTMENT/INTERVIEW/GRANTED/REFUSED/WITHDRAWN) | Server-side FSM (`VisasService`), no bare client-supplied status. `READY` requires every `required=true` `visa_checklist_items` row (entity_type='Visa') to be DONE/WAIVED first. SUBMITTED/APPOINTMENT/INTERVIEW/GRANTED/REFUSED each reachable only via their own dedicated action (`submit`/`scheduleAppointment`/`recordInterview`/`recordResult`), never `PATCH .../status` — same discipline as `applications.status`/`offers.status`. |
| (case_id) on visas, non-terminal status | plain index, service-layer check | "At most one non-terminal Visa per Case" is `VisasService.assertNoActiveDuplicate` (`409 ACTIVE_VISA_EXISTS`), not a DB unique constraint — mirrors `applications`' DEC-05 pattern so reapplying after WITHDRAWN/REFUSED creates a new row, preserving full history rather than overwriting it. |
| visas.submitted_at / submission_reference / evidence_document_id | timestamp null / text null / uuid FK null | Set together by `POST .../submit`. `evidence_document_id` is a real FK (Phase 07 ASM-24 precedent continued), not a plain string reference. |
| visas.appointment_at / appointment_location / appointment_reference | timestamp null / text null / text null | Set together by `POST .../appointment`. |
| visas.interview_at / interview_notes | timestamp null / text null | Set by `POST .../interview`. `interview_notes` is visible to the affected Student/Parent (their own outcome, not staff-internal commentary) — see `docs/ASSUMPTIONS.md` ASM-38. |
| visas.result_date / result_evidence_document_id / reason | timestamp null / uuid FK null / text null | Set together by `POST .../result` (GRANTED or REFUSED). `reason` doubles as refusal reason and withdrawal reason; visible to the affected Student/Parent, same ASM-38 reasoning. |
| visas.internal_notes | text null | Staff-only commentary — field-level redacted from STUDENT_PARENT (`FieldPolicyService.redactVisa`), same pattern as `scholarship_applications.internal_notes`. |
| visa_checklist_templates | UNIQUE(country_code, visa_type, title) | GLOBAL master/config data, same treatment as `task_templates`/`contract_templates` — checklist content is never hard-coded in application logic. `VisasService.create` instantiates matching `active=true` templates into real `visa_checklist_items` rows exactly once, at Visa creation time; never re-instantiated on read or edit. |
| visa_checklist_items.entity_type / entity_id | text / text | Polymorphic — `'Visa'` (entity_id = visas.id) for Visa-scoped items, `'PreDeparture'` (entity_id = cases.id) for pre-departure items, same pattern as `comments.entity_type`/`documents.owner_entity`. Deliberately ONE shared table for two Phase 09 consumers rather than a second/third near-duplicate checklist entity; Phase 08's already-PASSed `application_checklist_items` was left untouched, not retroactively generalized — see `docs/ASSUMPTIONS.md` ASM-33. Pre-departure items key off `cases.id` (not a Visa id) because pre-departure readiness is a Case-level milestone that outlives any single Visa attempt. |
| visa_checklist_items.category | text null | Free text grouping suggested by 09-visa (passport/visa/flight/insurance/accommodation/airport transfer/orientation/emergency contact/tuition deposit/travel documents) — never a hard-coded enum. Nullable — a Visa-scoped item has no natural category. Added via a same-phase corrective migration (`20260819090500_visa_checklist_item_category_phase09`) after the initial schema draft omitted it. |
| visa_checklist_items.status | enum ChecklistItemStatus (PENDING/IN_PROGRESS/DONE/WAIVED) | Reused unchanged from Phase 08 — not duplicated. `completed_at` stamped when status first becomes DONE or WAIVED. |
| enrollments.case_id | uuid FK, NOT NULL | A Student/Case transaction, not master data — 09-visa "Enrollment không phải master data." |
| enrollments.offer_id | uuid FK, NOT NULL | Enrollment creation requires this Offer to belong to the same Case AND be in `ACCEPTED` status (`409 INVALID_ENROLLMENT_TARGET` otherwise — rejects DECLINED/EXPIRED/WITHDRAWN/RECEIVED offers and offers from another Case). |
| enrollments.university_id / program_id | uuid FK, NOT NULL / uuid FK, NOT NULL | Derived server-side from the target Offer's Application → Program row, never accepted from client input — "không duplicate University/Program dữ liệu vào Enrollment." |
| enrollments.status | enum EnrollmentStatus (PLANNED/CONFIRMED/WITHDRAWN) | "At most one CONFIRMED Enrollment per Case" is `EnrollmentsService.assertNoActiveConfirmed` (`409 CONFIRMED_ENROLLMENT_EXISTS`), service-layer not a DB constraint — multiple PLANNED attempts and a full WITHDRAWN history remain visible, matching 09-visa's explicit "cần thiết kế lịch sử nếu cho phép nhiều lần nhập học" instruction. |
| enrollments.start_date / confirmation_date / evidence_document_id | timestamp null / timestamp null / uuid FK null | Set together by `POST .../confirm`. |
| enrollments.internal_notes | text null | Field-level redacted from STUDENT_PARENT, same `FieldPolicyService` pattern as `visas.internal_notes`. |
| Case Closure integration | — | `CasesService.close()` (Phase 04, extended not duplicated) gates on four new preconditions reusing existing services: `PaymentsService.hasOutstandingDebtForCase` (unconditional), `VisaStatusService.hasOpenVisa` (unconditional), `VisaStatusService.hasUnconfirmedRequiredEnrollment` (conditional on ≥1 Application existing), `VisaStatusService.hasIncompletePreDepartureChecklist` (conditional on ≥1 pre-departure item existing) — see `docs/ASSUMPTIONS.md` ASM-36. `VisaStatusService` lives in its own dependency-free leaf module so `case-management` can import it without a circular dependency, per `docs/architecture/DOMAIN_MAP.md`'s own pre-declared expose-point. |

### 4.14 `documents` / `document_access` (Documents — schema Phase 02, controller/service built Phase 07, real storage/scan/versioning Phase 12)
| Column | Type | Notes |
|---|---|---|
| documents.document_code | text UNIQUE | `DOC-YYYY-NNNNN`. |
| documents.owner_entity / owner_id | text / text | Polymorphic reference to whichever domain owns this file — not a DB FK (that domain's table may not exist yet in this phase). Validated at the service layer. Never a scope-check input — access is purely `document_access`-grant-based (see below); changing `owner_id` on an upload grants nothing extra. |
| documents.file_reference | text | Phase 12: a `StorageProvider`-issued key (default: a random UUID from `LocalFilesystemStorageProvider`), generated server-side on every real upload — never trusted from client input. Still never a public URL (Hard Rule #6). See `docs/ASSUMPTIONS.md` ASM-50. |
| documents.original_filename | text null | Phase 12 addition — sanitized (path separators/`..` stripped, length-capped) display name only, used for the `Content-Disposition` header on download. Never used to build a storage path. |
| documents.checksum_sha256 | text null | SRS 6.19 "checksum/hash để phát hiện file trùng". Phase 12: computed server-side (SHA-256 of the actual uploaded bytes) on every real upload; used for informational (non-blocking) duplicate detection — a same-checksum, same-owner upload returns `duplicateOfId` in the response but is never rejected (no MD names a blocking rule). |
| documents.scan_status | enum DocumentScanStatus (PENDING/CLEAN/INFECTED/ERROR) | Phase 12 addition. Independent of `status` (the document's own business-workflow state) — a FINAL/ARCHIVED document can still be scan-PENDING or scan-INFECTED. Download (`DocumentsService.requestDownload`/`downloadByToken`) is blocked unless `CLEAN`, checked at BOTH the authorize-and-issue-signed-URL step and again at the byte-serving step (defense-in-depth against a grant/scan-result change in the short window between the two). Set by the async `DOCUMENT_SCAN` job (`MalwareScanProvider`, default `HeuristicMalwareScanProvider` — detects the industry-standard EICAR test signature; a real AV engine is a drop-in replacement behind the same interface). |
| documents.previous_version_id | uuid FK null, UNIQUE (self-relation) | Phase 12 addition — "Final/submitted/legal files require versioning ... không overwrite." `POST /documents/:id/versions` always creates a brand-new Document row (own id/documentCode/`version = previous + 1`) chained back via this column — never an in-place file swap. Rejected (`409 DOCUMENT_ARCHIVED`) once the row being versioned is itself ARCHIVED. Existing `document_access` grants are copied forward to the new row so access continuity isn't lost on a correction. |
| documents.legal_hold | bool | Overrides retention-based cleanup when true. No automatic deletion job reads this column yet (Hard Rule #5 — nothing in this codebase hard-deletes) — retention/legal-hold tracking is informational only at this phase; see `docs/ASSUMPTIONS.md` ASM-50. |
| document_access | UNIQUE(document_id, principal_id, permission) | One row per (document, user, permission-kind) grant. Phase 07: `create` auto-grants the uploader VIEW+DOWNLOAD; `DocumentsService.grantCaseAccess(documentId, caseId)` (called by every Phase 07 evidence/writing service) grants VIEW+DOWNLOAD to every current CaseMember plus the linked student/parent portal users. `download` requires an explicit DOWNLOAD-permission row (or a GLOBAL-scope role) — 404, not 403, when absent (`DocumentsService.assertAccessible`). Phase 12: uploader is additionally auto-granted EDIT+SHARE (full control of their own upload); `POST /documents/:id/share` lets an EDIT/SHARE-holder grant VIEW/DOWNLOAD to another principal explicitly. |

**Phase 12 — signed download flow**: `GET /documents/:id/download` authorizes (existing grant
check) then issues a short-lived (`DOCUMENT_DOWNLOAD_URL_TTL_SECONDS`, default 60s), HMAC-
SHA256-signed, principal-and-document-scoped token (`SignedUrlService`) — never the file
bytes directly, never a permanent URL. The actual bytes are served by the separate `GET
/documents/download/:token` (unauthenticated at the RBAC-guard layer — the token itself IS
the authorization, same "token possession" pattern as `ContractReviewLink`/
`ParentInvitation`), which re-verifies the signature, expiry, live grant, and live scan
status before streaming from `StorageProvider.read`. See `docs/ASSUMPTIONS.md` ASM-50.

### 4.15 `contract_templates` / `contracts` / `contract_review_links` / `contract_amendments` / `payments` (Commercial — Phase 05)
| Column | Type | Notes |
|---|---|---|
| contracts.contract_code | text UNIQUE | `HD-YYYY-NNNNN`. |
| contracts.signed_document_id | text null | Reference to the signed artifact's Document — string reference, not FK (Documents is a separate domain owning that table; see ERD.md section 7 note). |
| contracts.status | enum ContractStatus | Draft→Review→Approved→Sent→Signed→Active→Completed→Liquidated→Archived (SRS section 9). Each transition has its own dedicated `ContractsService` method (submit/approve/reject/send/sign/updateStatus) with its own precondition — never a bare status PATCH. |
| contracts.merge_field_values | jsonb null | The actual values filled into `contract_templates.merge_fields`' schema for this specific contract instance (student name, program, fee breakdown, etc. — SRS 6.16 "merge fields"). |
| contracts.approval_threshold | decimal null | Snapshotted from `CONTRACT_APPROVAL_THRESHOLD_AMOUNT` at `submit()` time, not re-derived from the live env var at approval time — so a later change to the configured threshold doesn't retroactively rewrite which rule governed a past decision (SRS 6.16 monetary-threshold approval). |
| contract_review_links.token_hash | text UNIQUE | Opaque, single-purpose, expiring token for the unauthenticated client-review link (SRS 6.16 "secure link có expiry") — same pattern as `password_reset_tokens`/session refresh tokens: only the SHA-256 hash is persisted, the raw value is returned once from `POST /contracts/:id/send` and never logged. |
| contract_amendments.amendment_code | text UNIQUE | `AM-YYYY-NNNNN`. |
| contract_amendments.before / after | jsonb null | Snapshot of exactly which fields changed (value/currency/service_package/merge_field_values), not just the version numbers — 05-commercial rule "Amendment phải giữ lịch sử version trước/sau". |
| payments.payment_code | text UNIQUE | `PAY-YYYY-NNNNN`. |
| UNIQUE(contract_id, installment_no) on payments | | Duplicate-installment guard (05-commercial rule). |
| payments.paid_amount | decimal default 0 | Supports partial payment (SRS 6.16) without a separate PartialPayment table. |
| payments.reference | text null UNIQUE | Business-rule duplicate-transaction check. Postgres unique indexes treat every NULL as distinct, so any number of not-yet-recorded (reference IS NULL) payments coexist fine — only reusing the same non-null reference twice is rejected. |
| payments.refunded_amount / refunded_at / refunded_by_id / refund_reason | decimal default 0 / timestamptz null / uuid null / text null | Refund is recorded ON the same Payment row rather than a separate transaction row — the strongest possible "link to the original payment" (identity, not a join). Supports partial refund (`refunded_amount < paid_amount`); see `docs/ASSUMPTIONS.md` ASM-14. |
| payments.waived_at / waived_by_id / waived_reason | timestamptz null / uuid null / text null | 05-commercial rule "Waived phải có reason và audit" — `waived_reason` is mandatory at the DTO level; the action is `@Audit`-decorated. |
| payments.status = OVERDUE | enum value | Unlike `TaskStatus` (where "overdue" is display-only, never a stored value — see the `TaskStatus` enum comment in schema.prisma), `PaymentStatus.OVERDUE` is a real, filterable, stored status. `PaymentsService` lazily sweeps PENDING/PARTIALLY_PAID rows whose due date has passed into OVERDUE on read (list/getById/export), scoped to keep the sweep cheap, so `status=OVERDUE` queries stay correct without a separate scheduled job. |

### 4.16 `partners` / `partner_programs` / `partner_documents` / `partner_student_links` / `commission_rules` / `commission_transactions` (Partners — foundation slice, fully built out Phase 10)
| Column | Type | Notes |
|---|---|---|
| partners.partner_code | text UNIQUE | `PT-CC-NNNNN` (master-context-defined format). |
| partners.contact_phone | text null | Phase 10 addition, completing "contacts" alongside the Phase 02 `contact_name`/`contact_email` pair — not a multi-contact sub-entity. See `docs/ASSUMPTIONS.md` ASM-40. |
| partners.internal_notes | text null | Phase 10 addition — staff-only relationship/negotiation commentary, field-level redacted from DOCUMENT_SPECIALIST (`FieldPolicyService.redactPartner`) — see `docs/ASSUMPTIONS.md` ASM-43. |
| (name, country_code) on partners | plain index, service-layer check | Duplicate prevention, case-insensitive — `409 DUPLICATE_PARTNER`, same treatment as `universities`' own (official_name, country_code) check (Phase 08). Never referenced by name as a foreign key anywhere — every child table below links via `partner_id`. |
| partner_programs.partner_program_code | text UNIQUE | `PP-CC-NNNNN-NN` (master-context-defined format; the parent Partner's own code supplies the `CC-NNNNN` segment, `IdGeneratorService.nextPartnerProgramSuffix` generates only the `-NN` sub-sequence). |
| partner_programs.program_id | uuid FK null | Phase 10 addition — OPTIONAL, one-directional link to the existing Admission-domain `programs` row when a partner program genuinely corresponds to a catalog Program; left null when it's purely the partner's own commercial mapping. Never a duplicated University/Program row created in this module. See `docs/ASSUMPTIONS.md` ASM-41. |
| (partner_id, name, degree_level, major, intake) on partner_programs | plain index, service-layer check | Duplicate prevention — `409 DUPLICATE_PARTNER_PROGRAM`. |
| partner_documents.status | enum PartnerDocumentStatus (DRAFT/ACTIVE/EXPIRED/SUPERSEDED/ARCHIVED) | Phase 10 addition. `activate()` (DRAFT→ACTIVE) atomically marks any prior ACTIVE row for the same (partner, type) SUPERSEDED, inside one `$transaction`. An ACTIVE row is lazily synced to EXPIRED past `expiry_date` on read — same sweep pattern as `offers.status`/`payments.status`. |
| partner_documents.document_id | uuid FK null | Phase 10 — replaces the Phase 02 `file_reference` string column (confirmed zero rows before altering — no service had ever used it). Real FK into `documents`, same ASM-24 precedent as every Phase 07-09 evidence field — "PartnerDocument phải sử dụng Document subsystem hiện tại." Access is granted via the new `DocumentsService.grantRoleAccess(documentId, roleCodes)` method (Partner-domain access is GLOBAL/permission-gated, not Case-membership-based, so there is no CaseMember list to walk the way `grantCaseAccess` does). See `docs/ASSUMPTIONS.md` ASM-42. |
| partner_documents.owner_id | text null | Phase 10 addition — FK-less staff pointer, same pattern as `partners.owner_id`. |
| UNIQUE(partner_id, type, version) on partner_documents | | `create()` auto-increments `version` to (max existing version for this partner+type) + 1. `update()` (generic PATCH) is rejected once `status` leaves DRAFT — "Không overwrite signed/final partner documents"; a correction is a brand-new row, never an in-place edit. |
| partner_documents.type | enum PartnerDocumentType | MOU/Agreement/Commission Agreement/Rate Sheet/Other (SRS 6.17). |
| partner_student_links | FK to partners/students, cascade none (RESTRICT on partner/student, SET NULL on case/application) | Phase 10, new — SRS 6.17 "liên kết nhiều student/case/application bằng bảng trung gian." `case_id`/`application_id` both nullable; every FK validated against its real owning table at write time (never a blind client-supplied id), never a copied student/partner/application name. |
| partner_student_links.link_type | text | Free text (Referral/Agent/Sponsor/...), same configurable-field precedent as `visas.visa_type`/`offers.offer_type` — never a hard-coded enum. |
| (partner_id, student_id, case_id, application_id) on partner_student_links, status='ACTIVE' | service-layer check | "At most one ACTIVE link per exact tuple" — `409 DUPLICATE_PARTNER_STUDENT_LINK`. Archiving (`status='ARCHIVED'`, `end_date` stamped) frees the combination for a fresh link; no hard-delete (Hard Rule #5). |
| commission_rules | FK to partners (required), partner_programs (nullable), new table | Phase 10, new — config data, deliberately separate from `commission_transactions` (rule vs. fact) and carrying no shared FK/column with `payments`/`contracts.value`/`scholarship_applications.award_amount` anywhere (Hard Rule "Commission phải tách khỏi student payment"). No business-ID format defined — plain UUID, same "config/template data" precedent as `task_templates`/`contract_templates`/`visa_checklist_templates`. |
| commission_rules.basis | enum CommissionBasis (CONTRACT_VALUE/PAYMENT_COLLECTED/FIXED) | Only the two bases with a concrete existing source of truth to read from (`contracts.value`/`payments.paid_amount`), plus a source-less flat amount. "University-paid commission" and other abstractly-named bases with no concrete field/entity anywhere in `10-partners/01_PARTNER_CRM.md` were not built. See `docs/ASSUMPTIONS.md` ASM-44. |
| commission_rules.percentage_rate / fixed_amount | decimal(7,4) null / decimal(14,2) null | Fraction (0.1000 = 10%), not a percent-number. Exactly one of the two is required, cross-validated server-side against `basis` (`400 PERCENTAGE_RATE_REQUIRED`/`FIXED_AMOUNT_REQUIRED`/`PERCENTAGE_RATE_NOT_ALLOWED`/`FIXED_AMOUNT_NOT_ALLOWED`) — never both, never neither. Negative values always rejected; zero is allowed (a legitimate promotional/no-commission rule). |
| commission_rules.priority / partner_program_id | int default 0 / uuid FK null | Deterministic precedence when multiple ACTIVE rules could match: a `partner_program_id`-scoped rule outranks a partner-wide (null) one, then higher `priority` wins, then most-recently-created, then `id` — never random (`CommissionRulesService.selectRuleFor`). See `docs/ASSUMPTIONS.md` ASM-44. |
| commission_transactions | FK to partners (required), commission_rules/students/cases/applications (all nullable), new table | Phase 10, new — the actual financial fact. No business-ID format defined — plain UUID. |
| commission_transactions.source_type / source_id | text / uuid null | Polymorphic (`'Contract'` or `'Payment'`), same pattern as `documents.owner_entity`/`owner_id`. The underlying amount is always read LIVE from that Contract/Payment row at `calculate()` time — "dùng existing Payment source of truth," never a duplicate outstanding/paid calculation. |
| commission_transactions.basis / currency | enum CommissionBasis null / char(3) | Snapshotted from the matched `commission_rules` row at CREATE time (which rule applies is decided once, at creation). |
| commission_transactions.basis_amount / rate / calculated_amount | decimal(14,2) null / decimal(7,4) null / decimal(14,2) null | Snapshotted at CALCULATE time (ELIGIBLE→CALCULATED) — the rule is re-fetched fresh at that moment (a correction to the rule's rate between create and calculate is honored), and `calculatedAmount` is computed using `Prisma.Decimal` arithmetic exclusively (`.times()` / `.toDecimalPlaces(2, ROUND_HALF_UP)`) — never a JS-float `Number()` round-trip. A currency mismatch between the matched rule and the live source is rejected `409 CURRENCY_MISMATCH`, never silently converted. Re-calculating while still ELIGIBLE is a safe, idempotent recompute (pure function of current rule+source state), not an accumulation. |
| commission_transactions.status | enum CommissionTransactionStatus (PENDING/ELIGIBLE/CALCULATED/APPROVED/PAYABLE/PAID/CANCELLED) | Taken verbatim from the orchestration prompt's own example status list. Every forward transition (`confirm-eligibility`/`calculate`/`approve`/`mark-payable`/`pay`) is its own dedicated, precondition-gated action — never a bare client-supplied status. `CANCELLED` reachable from any non-PAID/non-CANCELLED state with a required `reason`. |
| (source_type, source_id, commission_rule_id) on commission_transactions, status != 'CANCELLED' | service-layer check | "No duplicate transaction for the same triggering event" — `409 DUPLICATE_COMMISSION_TRANSACTION`. Excludes CANCELLED so a corrected re-attempt after a cancellation is never blocked. |
| commission_transactions.paid_at / payment_reference | timestamp null / text null | Set together by `POST .../pay` (PAYABLE→PAID). PAID and CANCELLED are both hard-terminal — no direct edit, no adjustment/reversal mechanism (not named anywhere in `10-partners/01_PARTNER_CRM.md`) — see `docs/ASSUMPTIONS.md` ASM-45. |

### 4.17 `notifications` / `comments` / `approvals` (Notifications — extended Phase 06)
| Column | Type | Notes |
|---|---|---|
| notifications.channel | enum NotificationChannel | IN_APP/EMAIL/SMS/ZALO/WHATSAPP (SRS 6.20). Phase 06 fans every event out to both IN_APP and EMAIL (two rows) — not caller-selectable — matching "in-app + email bắt buộc." SMS/ZALO/WHATSAPP remain unused (Phase 12 `integrations`, per docs/architecture/TARGET_ARCHITECTURE.md section 6). |
| notifications.dedupe_key | text null UNIQUE | Phase 06 duplicate-send guard (06-operations "Prevent duplicate sends") — same nullable-`@unique` NULL-semantics pattern as `payments.reference`. `NotificationsService.notify` catches the resulting unique-violation and returns `null` (no-op) rather than erroring on a repeat. |
| notifications.sent_at | timestamptz null | IN_APP: set immediately at creation (the inbox row existing IS the delivery). EMAIL: stays null — no SMTP/provider is wired up yet (`docs/ASSUMPTIONS.md` ASM-18); this is an honest "recorded, not actually dispatched," not a stand-in success flag. |
| notifications.payload | jsonb null | Deliberately minimal per event — reference ids only, never financial amounts/currency, passport, commission, or raw internal-notes-grade text (SRS 6.20 "Không đưa dữ liệu nhạy cảm trực tiếp vào notification body"). A `TASK_BLOCKED` notification is the one exception that DOES include the blocker text — its only recipient is the Case's internal OWNER, who already has full read access to that field on the Task itself. Phase 08's `APPLICATION_SUBMITTED`/`SCHOLARSHIP_AWARDED` events follow the same minimal-payload rule — reference ids only, never `awardAmount`/tuition/deposit figures. |
| comments.entity_type / entity_id | text / text | Polymorphic — same pattern as Document ownership. Phase 07 reuses this table for Writing review feedback (`entity_type = 'WritingVersion'`) — no duplicate `ReviewComment` entity. |
| comments.visibility | text default `'internal'` | Not an enum in this phase — the visibility model (which roles see "internal" vs "shared") is Phase 03 RBAC field-level policy; the column just records the flag today. |
| approvals.decision | enum ApprovalDecision | Pending/Approved/Rejected. |

### 4.18 `audit_logs` (Identity, append-only)
See ERD.md section 2. No update or delete path is exposed anywhere in the API.

### 4.19 `business_id_sequences` / `idempotency_keys` (cross-cutting infra)
See section 2 above and `docs/api/API_CONVENTIONS.md` sections "Business ID generation" and
"Idempotency". No new business-ID format was needed for any Phase 07 entity — none are
listed in `00-context/00_MASTER_CONTEXT.md`'s ID-format table, so `AcademicRecord`,
`TestRecord`, `Competition`, `ResearchProject`, `Activity`, `WritingArtifact`,
`WritingVersion`, `LetterOfRecommendation` all use a plain UUID `id`, no `*_code` column.
Phase 08 populated `UNI`/`PRG`/`SCHM` (invented, master context silent — `docs/
ASSUMPTIONS.md` ASM-26) alongside the master-context-defined `APP`/`SCH`; `Offer`,
`UniversityChoice`, and `ApplicationChecklist` follow the same "no format needed, plain
UUID" rule as Phase 07's sub-record entities. Phase 09 populated the master-context-defined
`VISA` format for `Visa`; `VisaChecklistTemplate`, `VisaChecklistItem`, and `Enrollment`
follow the same "no format needed, plain UUID" sub-record rule — see `docs/ASSUMPTIONS.md`
ASM-34.

### 4.20 Phase 03 additions — `sessions`, `password_reset_tokens`, `mfa_secrets`, `mfa_backup_codes`, plus columns on existing tables

Directly required by `03-security/01_AUTH.md` ("session/refresh", "revoke session",
"password reset", "internal MFA") — not inventions beyond scope, unlike the Phase 02
additions in section 2.

| Table/column | Notes |
|---|---|
| `sessions` | `id` doubles as the access token's `jti` claim (`docs/security/AUTH_MODEL.md` section 1). `refresh_token_hash` — SHA-256, never the raw token. `revoked_at` nullable — append-style (revoke = set, never deleted; not archived elsewhere since a revoked session row has no further use beyond audit-adjacent history, which `audit_logs` already covers for the LOGIN/LOGOUT events themselves). |
| `password_reset_tokens` | `token_hash` — SHA-256. `used_at` nullable — single-use, checked before `expires_at` (replay prevention: `docs/security/AUTH_MODEL.md` section 4). |
| `mfa_secrets` | 1:1 with `users` (PK = `user_id`, no separate `id`). `secret_ciphertext` — AES-256-GCM, `iv:ciphertext:authTag` hex-joined (`common/security/mfa-encryption.util.ts`). |
| `mfa_backup_codes` | `code_hash` — SHA-256 (same hashing utility as `sessions`/`password_reset_tokens`, not the AES encryption used for the TOTP secret — backup codes only ever need comparison, never recovery). |
| `users.locked_until` | Brute-force lockout (`AUTH_LOGIN_MAX_ATTEMPTS`/`AUTH_LOCKOUT_MINUTES`). Cleared on successful login or password reset. |
| `students.portal_user_id` | Nullable, `UNIQUE`, FK to `users.id`. Back RBAC's OWN_STUDENT scope — see `docs/ASSUMPTIONS.md` ASM-05. |
| `student_contacts.portal_user_id` | Nullable, FK to `users.id`. **Not unique since Phase 11** (`docs/DECISIONS.md` DEC-06) — a plain index instead, since one Parent `User` commonly links to more than one `StudentContact` (multiple children). Paired with `student_contacts.portal_status`/`revoked_at`/`revoked_by_id` (section 4.5) for the full parent-portal-link lifecycle. |
| `audit_logs.metadata` | JSONB, nullable. Freeform action-specific context (SRS 6.21 export reason/filter/row-count/fields) that doesn't fit the existing `before_snapshot`/`after_snapshot` columns — those two are for entity-state diffs specifically, `metadata` is for everything else an audited action wants to record. |

### 4.21 `parent_invitations` (Identity — Phase 11 Portal)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | One row per invite **attempt**, not per `StudentContact` — supports re-invite history after an expiry/revoke without overwriting a single mutable field set. |
| student_contact_id | uuid FK, ON DELETE CASCADE | An invitation cannot outlive its `StudentContact`. |
| token_hash | text UNIQUE | SHA-256, never the raw token — same hash-only shape as `password_reset_tokens.token_hash`/`ContractReviewLink.tokenHash`. |
| expires_at | timestamp | Checked before acceptance. |
| invited_by_id | uuid FK -> users.id | The staff member who sent the invite (`students:edit`-gated action). |
| accepted_at | timestamp null | Single-use — checked before `expires_at`, same replay-prevention pattern as `password_reset_tokens.used_at`. |
| revoked_at | timestamp null | An invitation can be independently revoked before acceptance (distinct from `student_contacts.revoked_at`, which is the already-active-link revocation). |

"Verification" is token possession — the same standard `password_reset_tokens` already
established in Phase 03, not a new verification mechanism. Acceptance
(`PortalAccessService.acceptInvitation`) either reuses an existing `User` account (matched
by the contact's `email`, when one already holds the STUDENT_PARENT role — so a parent with
several children never gets a duplicate `User`) or creates a new one. See
`docs/ASSUMPTIONS.md` ASM-46.

### 4.22 `background_jobs` / `incoming_webhook_events` (Phase 12 platform infra)

| Column | Type | Notes |
|---|---|---|
| background_jobs.job_type | text | Free text (`DOCUMENT_SCAN`, `REMINDER_SWEEP_TASK`, `REMINDER_SWEEP_PAYMENT`, `EXTERNAL_DATA_SYNC`, `NOTIFICATION_EMAIL_DISPATCH`, ...) — a domain module registers its own handler per type (`JobRunnerService.registerProcessor`) in its own `onModuleInit`; the runner never imports domain services directly, keeping the dependency direction one-way. |
| background_jobs.dedupe_key | text UNIQUE, null | The idempotency mechanism — `JobsService.enqueue` upserts on it (a concurrent race on the same key is resolved by re-fetching the winner, not by a duplicate insert). Reminder sweeps key on `${jobType}:${utcDate}` (one sweep per UTC calendar day); document scans key on `document-scan:${documentId}`; email dispatch keys on `email-dispatch:${notificationId}`. |
| background_jobs.status | enum BackgroundJobStatus (PENDING/RUNNING/SUCCEEDED/FAILED) | `RUNNING` is claimed atomically (`updateMany` conditioned on `status = PENDING`) before a batch is processed, so two overlapping poll ticks can never double-process the same job. |
| background_jobs.attempts / max_attempts / last_error | int / int (default 5) / text null | `JobRunnerService` retries a `TransientJobError` with exponential backoff (`scheduled_for` pushed out, capped) until `attempts >= max_attempts`, then marks `FAILED` — any other thrown error type is treated as permanent and fails immediately, never retried. An unregistered `job_type` also fails immediately (`last_error = 'NO_PROCESSOR_REGISTERED'`). |
| background_jobs.correlation_id | text null | Threaded through a triggering sweep's own jobs (e.g. one `SchedulerService.tick()` call's `REMINDER_SWEEP_TASK`/`REMINDER_SWEEP_PAYMENT`/`EXTERNAL_DATA_SYNC` jobs share one correlationId) for cross-job log tracing. |
| background_jobs.scheduled_for | timestamp | When a job becomes eligible to run — `now()` for an immediate enqueue, pushed into the future for a backoff-delayed retry. `JobRunnerService.processPendingJobs` only claims rows with `scheduled_for <= now()`. |
| incoming_webhook_events | UNIQUE(source, event_id) | The idempotency/replay-protection mechanism for inbound webhooks — checked BEFORE any business-data mutation is attempted. `source` names which external system (`'esign'` today — see `apps/api/src/modules/documents/webhooks/`). |
| incoming_webhook_events.signature_valid | bool | Recorded even for a REJECTED (forged/invalid-signature) event — a forged delivery attempt is still auditable, never silently dropped without a trace. |

Neither table is a business entity — same cross-cutting-infra taxonomy as
`business_id_sequences`/`idempotency_keys` (section 4.19). See `docs/ASSUMPTIONS.md`
ASM-52/ASM-53.

## 5. Deliberately deferred DB-level enforcement

These SRS rules are enforced at the **service layer** in the phase that owns the relevant
business logic, not as a Postgres CHECK/trigger in this foundation migration — listed here
so it is explicit that they were considered, not missed:

- "Roadmap chỉ được approve khi assessment baseline tồn tại" (SRS 6.5) — implemented Phase 07 (`RoadmapsService`), service-layer, not a DB constraint.
- "Không cho Paid nếu paid amount chưa đủ installment amount trừ khi cấu hình partial" (SRS section 9) — Phase 05.
- "Case Closed phải có closure reason và checklist bắt buộc" (SRS section 9) — Phase 04/09 (checklist entities don't exist yet in this phase).
- Field-level visibility (passport/finance/contract value/payment/debt/commission/visa evidence/internal notes — SRS section 13) — Budget/Finance implemented Phase 03, Contract/Payment Phase 05, LOR contact/internal notes Phase 07, ScholarshipApplication internal notes Phase 08, Visa/Enrollment internal notes Phase 09, Commission (resource-level, no partial-visibility role) and Partner internal notes/partner document evidence Phase 10 (all `FieldPolicyService`) — every SRS §13 group named through Phase 10 is now implemented; see `docs/security/RBAC_MATRIX.md` section 5.
- Lead→Student duplicate detection (SRS 6.2) — Phase 04.
- Record-scope authorization (case ownership, student self, parent-linked, department — SRS section 2) — implemented Phase 03 (`ScopePolicyService`), enforced at the service layer per endpoint, not as a Postgres row-level-security policy (RLS was considered and rejected for this phase: the application already has one DB role/connection, and RLS would need per-request `SET ROLE`/session variables that add complexity without a clear benefit over an explicit, testable service-layer check — revisit only if a second direct-DB-access surface is ever introduced).
- "Prevent duplicate active applications... unless business rule explicitly allows it" (08-admission/02_APPLICATION.md) — implemented Phase 08 (`ApplicationsService.assertNoActiveDuplicate`), service-layer, not a DB unique constraint; see `docs/DECISIONS.md` DEC-05 for why the Phase 02 DB-level constraint had to be relaxed for this.
- "Kiểm tra eligibility trước các bước yêu cầu" (08-admission/03_OFFER_SCHOLARSHIP.md) — implemented Phase 08 (`ScholarshipApplicationsService.confirmEligibility` + a `SUBMITTED`-transition guard), service-layer.
- Duplicate University/Program/ScholarshipMaster prevention (08-admission MASTER DATA INTEGRITY) — implemented Phase 08, service-layer pre-create checks, not DB unique constraints (the matching combinations are multi-column and partly case-insensitive, which a plain unique index can't express).
- Duplicate Partner/PartnerProgram prevention and "at most one ACTIVE PartnerStudentLink per exact tuple" (10-partners/01_PARTNER_CRM.md) — implemented Phase 10, service-layer pre-create checks, same multi-column/case-insensitive reasoning as University/Program above.
- CommissionRule basis/rate cross-validation ("FIXED requires fixedAmount, CONTRACT_VALUE/PAYMENT_COLLECTED requires percentageRate, never both") and CommissionRule precedence selection when multiple rules match — implemented Phase 10 (`CommissionRulesService`), service-layer; a DB CHECK constraint could express the basis/rate exclusivity but not the precedence ranking, so both live at the service layer for one consistent enforcement point.
- "No duplicate CommissionTransaction for the same triggering event" (10-partners/01_PARTNER_CRM.md idempotency requirement) — implemented Phase 10 (`CommissionTransactionsService`), service-layer on `(sourceType, sourceId, commissionRuleId)` excluding CANCELLED rows, not a DB unique constraint (a genuine re-attempt after cancellation must remain possible).
- Parent-portal access revocation ("quyền truy cập phải mất ngay theo policy," 11-portal/01_STUDENT_PARENT_PORTAL.md) — implemented Phase 11 in `ScopePolicyService` (7 OWN_STUDENT-aware methods additionally require `student_contacts.portal_status = ACTIVE`, read fresh from the DB on every request, never cached) plus `PortalAccessService.revokeParentAccess` (expires all the revoked user's non-expired `document_access` grants in the same transaction) — a live authorization-time check, not a DB constraint, since revocation must take effect on the very next request regardless of which row a stale client might still reference.
- Parent-invitation token validity (not accepted, not revoked, not expired) — implemented Phase 11 (`PortalAccessService.acceptInvitation`), service-layer, same class of check as `password_reset_tokens` validation (Phase 03), not a DB CHECK constraint.
- Document duplicate detection (same checksum, same owner) — implemented Phase 12 (`DocumentsService.upload`), service-layer, informational only (`duplicateOfId` returned, never blocks the upload — no MD names a blocking rule), not a DB constraint (a hard unique on checksum would incorrectly block two genuinely different owners uploading the same public-domain file).
- Document download gating on malware-scan result — implemented Phase 12 (`DocumentsService.requestDownload`/`downloadByToken` both check `scan_status = CLEAN`), service-layer, checked twice (authorize-and-issue-URL step, and again at byte-serving time) rather than a DB CHECK constraint, since the check must also cross-reference the live `document_access` grant at the same moment.
- Document retention/legal-hold enforcement — `retention_until`/`legal_hold` are tracked (Phase 02 schema) but no automatic deletion job reads them as of Phase 12; per Hard Rule #5 (no hard-delete anywhere in this system) and 12-platform/01_DOCUMENTS.md "Không tự động delete legal/audit-required documents," building an auto-purge job was out of scope — see `docs/ASSUMPTIONS.md` ASM-50.
- External-data-sync "don't overwrite manually verified data" — implemented Phase 12 (`UniversitiesService.syncExternal`), service-layer (`lastVerifiedAt > retrievedAt` check), not a DB trigger, since the decision needs to compare two live timestamp columns per row at sync time.
- Webhook signature verification/replay protection — implemented Phase 12 (`WebhooksController`/`WebhooksService`), service-layer HMAC verification plus a DB-level `(source, event_id)` unique constraint for the idempotency half specifically (the one part of this that IS enforced at the DB layer, since "never process the same event twice" is exactly what a unique index guarantees for free).

## 6. Deviation from the literal 01_DATABASE_FOUNDATION.md required-entity list

None beyond the two documented additions in section 2. Every one of the 29 required
entities is present as its own table with its own business-ID column and no entity was
merged, renamed, or split. Phase 07's additions (sections 4.8-4.10), Phase 08's additions
(sections 4.11-4.12), Phase 09's additions (section 4.13), and Phase 10's additions
(section 4.16) are all additive migrations on top of this foundation — no Phase 01-09
column was dropped or repurposed without a documented, explicit reason (confirmed via
`prisma migrate diff` before applying each migration). The one exception is Phase 08's
relaxation of Application's original `@@unique([studentId, programId])` — a genuine Phase
02 vs. Phase 08 requirements conflict, not an accidental drop, recorded as
`docs/DECISIONS.md` DEC-05 rather than silently resolved. Phase 10's own `DROP COLUMN
partner_documents.file_reference` is not a comparable conflict — that column had zero rows
and no service had ever been built against it (confirmed by row-count check before
altering), the same "schema waited, this phase completes it" class of change as Phase 09's
`VisaChecklistItem.category` addition, not a requirements conflict warranting its own
DECISIONS.md entry. See `docs/phase-status/PHASE_07.md`/`PHASE_08.md`/`PHASE_09.md`/
`PHASE_10.md`.
