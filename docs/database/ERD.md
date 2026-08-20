# ERD — Database Foundation (Phase 02A)

Source of truth: `database/schema.prisma`. This document is a human-readable view of that
schema — if the two ever disagree, the schema file wins; update this document to match it,
not the other way around.

Scope: the entities required by `02-foundation/01_DATABASE_FOUNDATION.md` (plus the two
infra additions justified in `docs/database/DATA_DICTIONARY.md`), extended by Phase 07's
Profile Development slice (section 4 below: AssessmentCriterion, RoadmapMilestoneDependency,
AcademicRecord, TestRecord, Competition, ResearchProject, Activity, WritingArtifact,
WritingVersion, LetterOfRecommendation) and Phase 07's Documents domain (section 6:
Document, DocumentAccess), and by Phase 08's full build-out of the Admission domain
(section 5: UniversityChoice, ApplicationChecklist, Offer, ScholarshipApplication —
formerly foundation-only stubs, now fully implemented), by Phase 09's Visa domain
(section 12: Visa, VisaChecklistTemplate, VisaChecklistItem, Enrollment), by Phase 10's
full build-out of the Partners domain (section 8: PartnerStudentLink, CommissionRule,
CommissionTransaction — new; Partner, PartnerProgram, PartnerDocument — formerly
foundation-only stubs, now fully implemented), and by Phase 11's Student/Parent Portal
(section 10: `ParentInvitation` — new; `StudentContact` extended with
`portalStatus`/`revokedAt`/`revokedById`, `Task` extended with `visibleToStudent` — section
3). Portal introduced no new business-domain entity beyond `ParentInvitation` — every
Portal capability is a permission-gated read/action layer over existing tables. Phase 12
(12-platform/*.md) completes the Documents domain's real storage/scan/versioning pipeline
(section 6: `Document` extended with `originalFilename`/`scanStatus`/`previousVersionId`),
adds the external-data-sync columns to Admission master data (section 5:
`sourceUrl`/`externalId`/`retrievedAt`/`syncStatus` on University/Program/
ScholarshipMaster), and adds two cross-cutting infra tables (section 11: `BackgroundJob`,
`IncomingWebhookEvent`) — no new business-domain entity. No entity remains deferred to a
later phase in this ERD as of Phase 12 — see `docs/architecture/DOMAIN_MAP.md` for the full
domain ownership map.

## 1. Domain overview

```mermaid
erDiagram
    IDENTITY_DOMAIN {
        string note "User, Role, Permission, RolePermission, AuditLog"
    }
    CRM_DOMAIN {
        string note "Lead"
    }
    CASE_MGMT_DOMAIN {
        string note "Student, StudentContact, Case, CaseMember, Task, TaskDependency, TaskTemplate"
    }
    COUNSELING_DOMAIN {
        string note "Assessment, AssessmentCriterion, Roadmap, RoadmapMilestone, RoadmapMilestoneDependency, AcademicRecord, TestRecord, Competition, ResearchProject, Activity, WritingArtifact, WritingVersion, LetterOfRecommendation (Phase 07)"
    }
    ADMISSION_DOMAIN {
        string note "University, Program, ScholarshipMaster, UniversityChoice, Application, ApplicationChecklist, Offer, ScholarshipApplication (Phase 08)"
    }
    VISA_DOMAIN {
        string note "Visa, VisaChecklistTemplate, VisaChecklistItem, Enrollment (Phase 09)"
    }
    COMMERCIAL_DOMAIN {
        string note "ContractTemplate, Contract, ContractReviewLink, ContractAmendment, Payment"
    }
    PARTNERS_DOMAIN {
        string note "Partner, PartnerProgram, PartnerDocument, PartnerStudentLink, CommissionRule, CommissionTransaction (Phase 10)"
    }
    DOCUMENTS_DOMAIN {
        string note "Document, DocumentAccess"
    }
    NOTIFICATIONS_DOMAIN {
        string note "Notification, Comment, Approval"
    }

    CRM_DOMAIN ||--o{ CASE_MGMT_DOMAIN : "Lead.convertedStudentId -> Student"
    CASE_MGMT_DOMAIN ||--o{ COMMERCIAL_DOMAIN : "Case.contractId -> Contract"
    CASE_MGMT_DOMAIN ||--o{ COUNSELING_DOMAIN : "case_id FK"
    CASE_MGMT_DOMAIN ||--o{ ADMISSION_DOMAIN : "student_id / case_id FK"
    COUNSELING_DOMAIN ||--o{ ADMISSION_DOMAIN : "assessment backs roadmap; profile informs application"
    ADMISSION_DOMAIN ||--o{ PARTNERS_DOMAIN : "Program.id <- PartnerProgram.programId (nullable, real FK, Phase 10)"
    COMMERCIAL_DOMAIN ||--o{ CASE_MGMT_DOMAIN : "Contract.studentId -> Student"
    IDENTITY_DOMAIN ||--o{ CASE_MGMT_DOMAIN : "owner_id / actor_id FK everywhere"
    DOCUMENTS_DOMAIN ||--o{ COMMERCIAL_DOMAIN : "signedDocumentId reference (string, ASM-02)"
    DOCUMENTS_DOMAIN ||--o{ COUNSELING_DOMAIN : "evidenceDocumentId / documentId FK (real FK, ASM-24 — Phase 07)"
    DOCUMENTS_DOMAIN ||--o{ ADMISSION_DOMAIN : "evidenceDocumentId / documentId FK (real FK, Phase 08)"
    COUNSELING_DOMAIN ||--o{ ADMISSION_DOMAIN : "WritingArtifact.essayArtifactId <- ScholarshipApplication (Phase 08 reuse)"
    CASE_MGMT_DOMAIN ||--o{ COUNSELING_DOMAIN : "Task.milestoneId -> RoadmapMilestone (Phase 07 Task Engine reuse)"
    CASE_MGMT_DOMAIN ||--o{ ADMISSION_DOMAIN : "Task auto-generation: APPLICATION_SUBMITTED/SCHOLARSHIP_AWARDED (Phase 08)"
    NOTIFICATIONS_DOMAIN ||--o{ IDENTITY_DOMAIN : "recipient_id -> User"
    CASE_MGMT_DOMAIN ||--o{ VISA_DOMAIN : "student_id / case_id FK (Phase 09)"
    ADMISSION_DOMAIN ||--o{ VISA_DOMAIN : "Offer.id <- Visa.offerId (nullable) / Enrollment.offerId (required)"
    DOCUMENTS_DOMAIN ||--o{ VISA_DOMAIN : "evidenceDocumentId / resultEvidenceDocumentId / documentId FK (real FK)"
    CASE_MGMT_DOMAIN ||--o{ VISA_DOMAIN : "Task auto-generation: VISA_GRANTED (Phase 09)"
    VISA_DOMAIN ||--o{ CASE_MGMT_DOMAIN : "VisaStatusService exposes Case-closure preconditions (Phase 09)"
    COMMERCIAL_DOMAIN ||--o{ CASE_MGMT_DOMAIN : "PaymentsService.hasOutstandingDebtForCase exposes Case-closure precondition (Phase 09)"
    CASE_MGMT_DOMAIN ||--o{ PARTNERS_DOMAIN : "student_id / case_id / application_id FK (PartnerStudentLink, CommissionTransaction — Phase 10)"
    DOCUMENTS_DOMAIN ||--o{ PARTNERS_DOMAIN : "documentId FK (real FK, PartnerDocument — Phase 10)"
    COMMERCIAL_DOMAIN ||--o{ PARTNERS_DOMAIN : "CommissionTransaction.sourceType='Contract'|'Payment' (polymorphic, live-read at calculate time — Phase 10)"
```

Table ownership follows `docs/architecture/DOMAIN_MAP.md` exactly — one owning domain per
table, everyone else references by foreign key.

## 2. Identity domain

```mermaid
erDiagram
    USER ||--o{ ROLE : "belongs to"
    ROLE ||--o{ ROLE_PERMISSION : "granted"
    PERMISSION ||--o{ ROLE_PERMISSION : "granted via"
    USER ||--o{ AUDIT_LOG : "actor of"

    USER {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string full_name
        enum status
        uuid role_id FK
        datetime last_login_at
        int failed_login_count
        datetime offboarded_at
    }
    ROLE {
        uuid id PK
        enum code UK "8 roles — SRS section 3"
        string name
        bool active
    }
    PERMISSION {
        uuid id PK
        string resource
        string action
        string field_scope "nullable"
    }
    ROLE_PERMISSION {
        uuid role_id PK,FK
        uuid permission_id PK,FK
    }
    AUDIT_LOG {
        uuid id PK
        uuid actor_id FK "nullable — system actions"
        string action
        string object_type
        string object_id
        string student_id
        string case_id
        string result
        string ip_address
        string user_agent
        json before_snapshot
        json after_snapshot
        string request_id
        datetime created_at
    }
```

`AuditLog` has no `updated_at` and no soft-delete column on purpose — it is append-only
(Hard Rule #5, NFR-SEC-05); the API never exposes an update/delete path for it.

## 3. CRM + Case Management domains (extended by Phase 04 — Core CRM)

```mermaid
erDiagram
    LEAD }o--o| STUDENT : "converted_student_id (many Leads may merge into one Student)"
    STUDENT ||--o{ STUDENT_CONTACT : "has"
    STUDENT ||--o{ CASE : "has (at most one non-closed/archived at a time)"
    CASE ||--o| CONTRACT : "contract_id"
    CASE ||--o{ CASE_MEMBER : "has"
    CASE ||--o{ TASK : "has"
    TASK ||--o{ TASK_DEPENDENCY : "depends on"
    TASK_TEMPLATE ||--o{ TASK : "auto-generates (Phase 06)"

    LEAD {
        uuid id PK
        string lead_code UK "LEAD-YYYY-NNNNN"
        string contact_name
        string major_interest "Phase 04"
        enum status
        uuid owner_id FK
        uuid converted_student_id FK "nullable, NOT unique — see below"
    }
    STUDENT {
        uuid id PK
        string student_code UK "HS-YYYY-NNNNN"
        string full_name
        string target_country
        decimal budget "sensitive — SRS section 13"
        datetime archived_at "soft delete"
    }
    STUDENT_CONTACT {
        uuid id PK
        uuid student_id FK
        string type
        string name
        string relationship
        string phone "nullable"
        string email "nullable"
        uuid portal_user_id FK "nullable, NOT unique since Phase 11 — DEC-06"
        enum portal_status "NONE | INVITED | ACTIVE | REVOKED — Phase 11"
        datetime revoked_at "nullable — Phase 11"
        uuid revoked_by_id FK "nullable — Phase 11"
    }
    CASE {
        uuid id PK
        string case_code UK "CASE-YYYY-NNNNN"
        uuid student_id FK
        uuid contract_id FK "nullable, unique"
        uuid owner_id FK
        string department "Phase 04 — descriptive only, see docs/ASSUMPTIONS.md ASM-06"
        string stage
        enum status
        string closure_reason
        datetime archived_at "soft delete"
    }
    CASE_MEMBER {
        uuid case_id PK,FK
        uuid user_id PK,FK
        enum role "OWNER | COLLABORATOR"
        datetime removed_at "Phase 04 — nullable, null = currently active"
    }
    TASK {
        uuid id PK
        string task_code UK "TASK-YYYY-NNNNN"
        uuid case_id FK "nullable"
        string module
        string task_type
        uuid owner_id FK
        string priority
        datetime start_at "nullable"
        datetime deadline
        enum status
        string output
        int quality_score
        string blocker
        bool visible_to_student "default false — Phase 11 Portal, staff-only unless explicitly shared"
        uuid template_id FK "nullable — set only for auto-generated tasks, Phase 06"
        string source_entity_type "nullable — polymorphic, e.g. 'Case'/'Contract'"
        string source_entity_id "nullable"
    }
    TASK_DEPENDENCY {
        uuid task_id PK,FK
        uuid depends_on_task_id PK,FK
    }
    TASK_TEMPLATE {
        uuid id PK
        string code UK
        string name
        string module
        string task_type
        string title
        string priority "nullable"
        int deadline_offset_days "nullable — required at the DTO level for new templates"
        enum trigger_event "CASE_CREATED | CASE_STAGE_CHANGED | CONTRACT_ACTIVATED"
        string trigger_stage_value "nullable — only for CASE_STAGE_CHANGED"
        bool active
    }
```

Note: `Task.status` has no `OVERDUE` enum value — SRS section 9 explicitly says Overdue is
a **derived** state (computed from `deadline < now() AND status NOT IN (DONE, CANCELLED)`),
not something staff sets directly. Computing and surfacing it is a query/reporting concern
for a later phase, not a stored column here — implemented in Phase 06 as
`TasksService.isOverdue`, the one shared function every read path (list filter, computed
response field) calls, deliberately never written back to `status` (unlike
`PaymentStatus.OVERDUE`, which IS a stored, lazily-synced status — see section 7's Payment
note). This same derived-state pattern is why Case closure checks a live `Task` count
rather than a stored "is closable" flag — `CasesService.close()`; as of Phase 06, that
count now includes any auto-generated tasks too, since they're ordinary `Task` rows with no
special exemption from the open-task closure guard.

`(template_id, source_entity_type, source_entity_id)` is unique on `Task` — the idempotency
guarantee for auto-generation (06-operations/01_TASK.md "task generation phải idempotent");
Postgres treats a row with any NULL among those three columns as distinct from every other
such row, so ordinary manually-created tasks (all three NULL) are unaffected. See
`docs/ASSUMPTIONS.md` ASM-19 for what "idempotent" means here across repeat real-world
stage re-entries, not just literal request retries.

**`Lead.converted_student_id` is deliberately NOT unique** (fixed during Phase 04 — see
`docs/ASSUMPTIONS.md` ASM-11 and `docs/DECISIONS.md` DEC-03): the merge flow lets more than
one Lead resolve to the same Student, so `Student`'s back-relation is `leadOrigins Lead[]`,
not a single nullable `Lead?`.

## 4. Counseling domain (foundation slice, extended by Phase 07 — Profile Development)

```mermaid
erDiagram
    CASE ||--o{ ASSESSMENT : "has versions"
    ASSESSMENT ||--o{ ASSESSMENT_CRITERION : "has"
    ASSESSMENT ||--o{ ROADMAP : "backs"
    ROADMAP ||--o{ ROADMAP_MILESTONE : "has"
    ROADMAP_MILESTONE ||--o{ ROADMAP_MILESTONE_DEPENDENCY : "depends on"
    ROADMAP_MILESTONE ||--o{ TASK : "tagged via milestone_id (Phase 06 reuse)"
    CASE ||--o{ ACADEMIC_RECORD : "has"
    CASE ||--o{ TEST_RECORD : "has"
    CASE ||--o{ COMPETITION : "has"
    CASE ||--o{ RESEARCH_PROJECT : "has"
    CASE ||--o{ ACTIVITY : "has"
    CASE ||--o{ WRITING_ARTIFACT : "has"
    WRITING_ARTIFACT ||--o{ WRITING_VERSION : "has versions"
    CASE ||--o{ LETTER_OF_RECOMMENDATION : "has"

    ASSESSMENT {
        uuid id PK
        uuid case_id FK
        int version
        json baseline "legacy, Phase 02 — unused by Phase 07 code"
        json gap "legacy, Phase 02 — unused by Phase 07 code"
        enum status "DRAFT|REVIEW|APPROVED|SUPERSEDED"
        string change_reason "nullable — required when superseding an APPROVED version"
        uuid approved_by_id "nullable"
        datetime approved_at "nullable"
    }
    ASSESSMENT_CRITERION {
        uuid id PK
        uuid assessment_id FK
        string area "free text — Academic/English/Test/Research/... not hard-coded"
        decimal current_score "nullable"
        decimal target_score "nullable"
        decimal gap "nullable"
        string priority "nullable"
        string recommendation "nullable"
        uuid evidence_document_id FK "nullable — real FK, see ASM-24"
    }
    ROADMAP {
        uuid id PK
        uuid case_id FK
        uuid assessment_id FK "nullable — the baseline it was approved against"
        int version
        int horizon_years "nullable — 1-3 year horizon"
        enum status "DRAFT|REVIEW|APPROVED|ACTIVE|COMPLETED|ARCHIVED"
        uuid approved_by_id "nullable"
        datetime approved_at "nullable"
    }
    ROADMAP_MILESTONE {
        uuid id PK
        uuid roadmap_id FK
        string stage "nullable"
        string objective
        string metric "nullable"
        string target "nullable"
        enum owner_role "nullable"
        uuid owner_id FK "nullable — assigned staff member, see docs/ASSUMPTIONS.md"
        datetime start_at "nullable"
        datetime deadline "nullable"
        enum status "NOT_STARTED|IN_PROGRESS|BLOCKED|DONE|CANCELLED"
        uuid evidence_document_id FK "nullable"
    }
    ROADMAP_MILESTONE_DEPENDENCY {
        uuid milestone_id PK,FK
        uuid depends_on_milestone_id PK,FK
    }
    ACADEMIC_RECORD {
        uuid id PK
        uuid case_id FK
        string school
        string period "free text — 'never overwrite historical records' per period"
        decimal gpa "nullable"
        string grading_scale "nullable"
        uuid evidence_document_id FK "nullable"
        uuid verified_by_id "nullable"
        datetime verified_at "nullable"
    }
    TEST_RECORD {
        uuid id PK
        uuid case_id FK
        string test_type "free text — not hard-coded to IELTS/SAT"
        int attempt_number
        datetime test_date "nullable"
        datetime planned_date "nullable"
        decimal score "nullable"
        json subscores "nullable"
        decimal target "nullable"
        uuid evidence_document_id FK "nullable"
        uuid verified_by_id "nullable"
        datetime verified_at "nullable"
    }
    COMPETITION {
        uuid id PK
        uuid case_id FK
        string event_name
        int year "nullable"
        string season "nullable"
        string category "nullable"
        string registration_status "nullable"
        string result "nullable"
        string rank "nullable"
        string award "nullable"
        uuid evidence_document_id FK "nullable"
    }
    RESEARCH_PROJECT {
        uuid id PK
        uuid case_id FK
        string title
        string mentor "nullable"
        string role "nullable"
        datetime start_at "nullable"
        datetime end_at "nullable"
        string methodology "nullable"
        string output "nullable"
        string publication "nullable"
        string award "nullable"
        uuid evidence_document_id FK "nullable"
    }
    ACTIVITY {
        uuid id PK
        uuid case_id FK
        string organization
        string role "nullable"
        string category "nullable — configurable, not a fixed enum"
        datetime start_at "nullable"
        datetime end_at "nullable"
        decimal hours "nullable"
        string impact "nullable"
        string verifier_name "nullable"
        uuid verified_by_id "nullable"
        datetime verified_at "nullable"
        uuid evidence_document_id FK "nullable"
    }
    WRITING_ARTIFACT {
        uuid id PK
        uuid case_id FK
        string type "free text — Resume/Essay/SOP/Motivation Letter/Study Plan/custom"
        string title
        enum status "DRAFT|REVIEW|REVISION|FINAL|SUBMITTED"
        uuid owner_id FK
    }
    WRITING_VERSION {
        uuid id PK
        uuid artifact_id FK
        int version_number
        uuid created_by_id FK
        string change_summary "nullable"
        string content "nullable — inline text"
        uuid document_id FK "nullable — or an uploaded file"
        enum review_status "PENDING|APPROVED|CHANGES_REQUESTED"
        uuid reviewer_id "nullable"
        datetime reviewed_at "nullable"
    }
    LETTER_OF_RECOMMENDATION {
        uuid id PK
        uuid case_id FK
        string recommender_name
        string relationship "nullable"
        string contact_email "nullable — field-level redacted from STUDENT_PARENT"
        string contact_phone "nullable — field-level redacted from STUDENT_PARENT"
        datetime request_date "nullable"
        datetime deadline "nullable"
        enum request_status "NOT_REQUESTED|REQUESTED|IN_PROGRESS|RECEIVED|DECLINED"
        enum submission_status "PENDING|SUBMITTED|NOT_REQUIRED"
        string internal_notes "nullable — field-level redacted from STUDENT_PARENT"
        uuid evidence_document_id FK "nullable"
    }
```

`Assessment`/`Roadmap` are versioned via `(caseId, version)` unique pairs, never
overwritten in place (SRS 6.4/6.5, Hard Rule #4). Enforcing "Roadmap chỉ được approve khi
assessment baseline tồn tại" (SRS 6.5) is a service-layer rule, not a DB constraint — the
FK only requires that `assessmentId`, if set, point to a real row. `ACTIVE` additionally
requires the Roadmap itself be `APPROVED` (service-layer FSM, `RoadmapsService`).

**Phase 07 additions** (07-profile/01_ASSESSMENT_ROADMAP.md, 02_PROFILE_EVIDENCE.md,
03_WRITING.md):
- `AssessmentCriterion` — one row per assessment area, `@@unique([assessmentId, area])`;
  `AssessmentStatus` gained a `REVIEW` value (now DRAFT→REVIEW→APPROVED→SUPERSEDED).
- `RoadmapMilestone` gained `target`/`ownerId`/`evidenceDocumentId`; milestone-to-milestone
  sequencing lives in its own `RoadmapMilestoneDependency` table — deliberately separate
  from `TaskDependency` (a different, planning-level concern), same self/circular-rejection
  graph-walk pattern (`docs/ASSUMPTIONS.md` ASM-22). Milestone execution work reuses the
  Phase 06 Task Engine unchanged via the new `Task.milestoneId` nullable FK — never a
  parallel milestone-task concept (ASM-19's idempotency guarantee extends unmodified to
  the new `ROADMAP_APPROVED` trigger).
- `AcademicRecord`, `TestRecord` (`@@unique([caseId, testType, attemptNumber])`),
  `Competition`, `ResearchProject`, `Activity` — one row per period/attempt/participation,
  never overwritten across periods/attempts (SRS 6.7/6.8, Hard Rule #4).
- `WritingArtifact`/`WritingVersion` — kept strictly separate (`@@unique([artifactId,
  versionNumber])`); a version is created, never overwritten; content edits after
  FINAL/SUBMITTED can only happen by creating a new version (which reverts the artifact to
  REVISION). Review feedback reuses the existing `Comment` entity (entityType='WritingVersion'),
  not a duplicate `ReviewComment` model.
- `LetterOfRecommendation` — its own entity (not a `WritingArtifact` row typed "LOR"); field
  redacted for STUDENT_PARENT via `FieldPolicyService.redactLor` (`docs/security/RBAC_MATRIX.md`
  section 5).
- Every `evidenceDocumentId`/`documentId` field above is a real Prisma FK to `Document`
  (Phase 07's newly-built Documents module — see section 6), a deliberate departure from
  Phase 05's `Contract.signedDocumentId` plain-string precedent — see `docs/ASSUMPTIONS.md`
  ASM-23/ASM-24.

## 5. Admission domain (foundation slice, fully built out Phase 08 — 08-admission/*.md)

```mermaid
erDiagram
    UNIVERSITY ||--o{ PROGRAM : "offers"
    UNIVERSITY ||--o{ SCHOLARSHIP_MASTER : "may fund directly"
    PROGRAM ||--o{ SCHOLARSHIP_MASTER : "may fund"
    PROGRAM ||--o{ APPLICATION : "applied to"
    PROGRAM ||--o{ UNIVERSITY_CHOICE : "shortlisted as"
    STUDENT ||--o{ APPLICATION : "applies"
    STUDENT ||--o{ UNIVERSITY_CHOICE : "shortlists"
    STUDENT ||--o{ SCHOLARSHIP_APPLICATION : "pursues"
    CASE ||--o{ APPLICATION : "tracked under"
    CASE ||--o| UNIVERSITY_CHOICE : "tracked under (optional)"
    CASE ||--o{ SCHOLARSHIP_APPLICATION : "tracked under"
    APPLICATION ||--o{ APPLICATION_CHECKLIST : "has"
    APPLICATION ||--o{ OFFER : "receives"
    APPLICATION ||--o{ SCHOLARSHIP_APPLICATION : "optionally linked from"
    SCHOLARSHIP_MASTER ||--o{ SCHOLARSHIP_APPLICATION : "applied for via"
    WRITING_ARTIFACT ||--o| SCHOLARSHIP_APPLICATION : "essay (Phase 07 reuse)"

    UNIVERSITY {
        uuid id PK
        string university_code UK "UNI-YYYY-NNNNN — invented, master context silent, see ASM-26"
        string official_name
        string country_code "ISO 3166-1 alpha-2"
        string city "nullable"
        string campus "nullable"
        string website "nullable"
        string admissions_url "nullable"
        enum status
        uuid owner_id "nullable — FK-less staff pointer, see ASM-27"
        string source "nullable"
        string source_url "nullable — Phase 12"
        string external_id "nullable — Phase 12, matches against sync source"
        datetime retrieved_at "nullable — Phase 12, last sync timestamp"
        enum sync_status "NOT_SYNCED|SYNCED|MANUAL_OVERRIDE — Phase 12"
        datetime last_verified_at "nullable"
    }
    PROGRAM {
        uuid id PK
        string program_code UK "PRG-YYYY-NNNNN"
        uuid university_id FK
        string degree_level
        string major
        string intake "nullable"
        int duration_months "nullable"
        decimal tuition "nullable"
        string tuition_currency "nullable — also covers application_fee, see ASM below"
        decimal application_fee "nullable"
        string eligibility "nullable"
        string requirements "nullable"
        string source "nullable"
        string source_url "nullable — Phase 12"
        string external_id "nullable — Phase 12"
        datetime retrieved_at "nullable — Phase 12"
        enum sync_status "NOT_SYNCED|SYNCED|MANUAL_OVERRIDE — Phase 12"
        enum status
        datetime last_verified_at "nullable"
    }
    SCHOLARSHIP_MASTER {
        uuid id PK
        string scholarship_code UK "SCHM-YYYY-NNNNN — disambiguated from SCH (ScholarshipApplication), see ASM-26"
        string provider
        string name
        uuid university_id FK "nullable"
        uuid program_id FK "nullable"
        string eligibility "nullable"
        string coverage_type "nullable"
        decimal amount "nullable"
        decimal percentage "nullable"
        string amount_currency "nullable"
        datetime deadline "nullable"
        string required_documents "nullable"
        string conditions "nullable"
        string source "nullable"
        string source_url "nullable — Phase 12"
        string external_id "nullable — Phase 12"
        datetime retrieved_at "nullable — Phase 12"
        enum sync_status "NOT_SYNCED|SYNCED|MANUAL_OVERRIDE — Phase 12"
        enum status
        datetime last_verified_at "nullable"
    }
    UNIVERSITY_CHOICE {
        uuid id PK
        uuid student_id FK
        uuid case_id FK "nullable — School Selection may start before a Case exists, see ASM-28"
        uuid program_id FK
        enum tier "REACH | MATCH | SAFETY"
        string rationale "nullable"
        enum status "PROPOSED | SHORTLISTED | CONFIRMED | REMOVED"
        uuid owner_id "nullable — FK-less staff pointer"
        uuid reviewed_by_id "nullable"
        datetime reviewed_at "nullable"
        string review_notes "nullable"
    }
    APPLICATION {
        uuid id PK
        string application_code UK "APP-YYYY-NNNNN"
        uuid student_id FK
        uuid case_id FK "required — tightened from Phase 02's nullable shape, see docs/DECISIONS.md DEC-05"
        uuid program_id FK
        string intended_intake "nullable — part of the duplicate-application uniqueness combination"
        datetime deadline "nullable"
        enum status "Planning|Preparing|ReadyForReview|Submitted|Offer|Waitlist|Reject|Withdrawn"
        datetime submitted_at "nullable"
        string submission_channel "nullable"
        string submission_reference "nullable"
        uuid evidence_document_id FK "nullable — real FK, Phase 07 ASM-24 precedent continued"
    }
    APPLICATION_CHECKLIST {
        uuid id PK
        uuid application_id FK
        string title
        bool required
        uuid owner_id "nullable"
        datetime deadline "nullable"
        enum status "PENDING|IN_PROGRESS|DONE|WAIVED"
        uuid document_id FK "nullable"
        string notes "nullable"
        datetime completed_at "nullable"
    }
    OFFER {
        uuid id PK
        uuid application_id FK
        string offer_type "free text — Unconditional/Conditional/Deferred/..."
        datetime offer_date "nullable"
        datetime acceptance_deadline "nullable"
        decimal deposit_amount "nullable"
        string deposit_currency "nullable"
        bool is_conditional
        string conditions "nullable"
        enum status "RECEIVED|ACCEPTED|DECLINED|EXPIRED|WITHDRAWN"
        datetime responded_at "nullable"
        uuid evidence_document_id FK "nullable"
    }
    SCHOLARSHIP_APPLICATION {
        uuid id PK
        string scholarship_application_code UK "SCH-YYYY-NNNNN"
        uuid student_id FK
        uuid case_id FK "required, see ASM-28"
        uuid scholarship_master_id FK
        uuid application_id FK "nullable"
        enum status "Planning|Submitted|UnderReview|Interview|Awarded|Rejected|Withdrawn"
        bool eligibility_confirmed
        string eligibility_notes "nullable"
        datetime deadline "nullable"
        uuid essay_artifact_id FK "nullable — reuses Phase 07 WritingArtifact, see ASM-29"
        datetime interview_at "nullable"
        string internal_notes "nullable — field-level redacted from STUDENT_PARENT"
        string conditions "nullable"
        decimal award_amount "nullable"
        string award_currency "nullable"
        string award_coverage_type "nullable"
        string award_period "nullable"
        datetime award_acceptance_deadline "nullable"
        uuid evidence_document_id FK "nullable"
        datetime submitted_at "nullable"
        datetime decided_at "nullable"
    }
```

**Master data** (University/Program/ScholarshipMaster) is GLOBAL, permission-gated only —
no per-record scope, the same treatment as `ContractTemplate`/`TaskTemplate`
(`docs/security/RBAC_MATRIX.md` section 3). "Không duplicate University/Program/
ScholarshipMaster chỉ vì nhiều Application/Student/intake" — every transaction entity
above references these by FK only, never a copied name/tuition/amount; service-layer
duplicate checks (`DUPLICATE_UNIVERSITY`/`DUPLICATE_PROGRAM`/
`DUPLICATE_SCHOLARSHIP_MASTER`) additionally reject near-identical rows at create time.

**Phase 12** adds the external-data-sync columns (`sourceUrl`/`externalId`/`retrievedAt`/
`syncStatus`) 12-platform/02_INTEGRATIONS_JOBS.md names, completing `source`/
`lastVerifiedAt` (Phase 08). Only `UniversitiesService.syncExternal` was built (matched by
`externalId` only, never by name — a sync source row with no matching `externalId` is
skipped, never inserted, so "Không duplicate University" holds even under sync); Program/
ScholarshipMaster carry the same columns for schema consistency but have no sync method yet
(no concrete data source ever returns Program/ScholarshipMaster records — see
`docs/ASSUMPTIONS.md` ASM-51). A row is never silently overwritten once a staff member has
verified it more recently than the last sync (`lastVerifiedAt > retrievedAt`) — the sync
instead marks it `MANUAL_OVERRIDE` and skips.

**Application's duplicate-prevention** is service-layer, not a DB unique constraint —
Phase 02's original `@@unique([studentId, programId])` would have permanently blocked
legitimate reapplication; relaxed to a plain index + an "at most one non-terminal
Application per (student, program, intendedIntake)" check
(`ApplicationsService.assertNoActiveDuplicate`) — see `docs/DECISIONS.md` DEC-05. `OFFER`
status is reachable on the parent Application only by actually creating an Offer row
(`ApplicationsService.transitionToOffer`), never a bare status PATCH — "Không được chuyển
Offer nếu chưa có offer record tương ứng."

**Offer** supports multiple rows per Application (a renegotiated/revised offer is a new
row, never overwriting history); "current offer" is a computed read (most recent ACCEPTED,
else most recent non-expired RECEIVED), not a stored flag — same pattern as
`TasksService.isOverdue`. A RECEIVED offer past its `acceptanceDeadline` is lazily synced
to EXPIRED on read, mirroring `Payment.status`'s OVERDUE sweep.

**ScholarshipApplication** is kept fully separate from `ScholarshipMaster` (many
applications reference one master row, never copied) and deliberately carries no
FK/shared column with Contract/Payment/CommissionTransaction — award money is tracked
entirely on this row, never mixed with the agency's own commercial terms ("Không trộn
scholarship amount / student contract fee / tuition payment / partner commission"). AWARDED
and REJECTED are reachable only via their own dedicated actions, never a generic status
PATCH, since award carries required additional data.

See `docs/ASSUMPTIONS.md` ASM-26 through ASM-32 for the specific ambiguous-requirement
resolutions this phase recorded (business-ID formats, FK-less owner pointers, nullable vs.
required `caseId`, ApplicationChecklist/essay reuse instead of duplication, Task/
Notification trigger scoping, the RBAC grant matrix, and why catalog/third-party money
fields are not subject to Contract/Payment-style redaction).

## 6. Documents domain (schema since Phase 02; controller/service built Phase 07; real storage/scan/versioning Phase 12)

```mermaid
erDiagram
    DOCUMENT ||--o{ DOCUMENT_ACCESS : "grants"
    USER ||--o{ DOCUMENT_ACCESS : "principal"
    USER ||--o{ DOCUMENT : "uploaded_by"
    DOCUMENT |o--o| DOCUMENT : "previous_version_id (self, version chain)"

    DOCUMENT {
        uuid id PK
        string document_code UK "DOC-YYYY-NNNNN"
        string owner_entity
        string owner_id
        string document_type
        string title
        int version
        string file_reference "Phase 12 — server-generated private-storage key, never client-suppliable"
        string original_filename "nullable — Phase 12, display-only, never a storage path"
        string mime_type "nullable"
        bigint size_bytes "nullable"
        string checksum_sha256 "nullable"
        enum status "DRAFT|REVIEW|APPROVED|FINAL|SUBMITTED|ARCHIVED"
        enum scan_status "PENDING|CLEAN|INFECTED|ERROR — Phase 12, independent of status"
        uuid uploaded_by_id FK
        datetime retention_until "nullable"
        bool legal_hold
        datetime archived_at "nullable"
        uuid previous_version_id FK "nullable, unique — Phase 12 version chain"
    }
    DOCUMENT_ACCESS {
        uuid id PK
        uuid document_id FK
        uuid principal_id FK
        enum permission "VIEW|DOWNLOAD|EDIT|SHARE"
        datetime expires_at "nullable"
    }
```

`ownerEntity` + `ownerId` is a deliberate loose polymorphic reference (not a DB FK) — a
Document can belong to any of Contract/Application/Visa/Assessment/etc. across domains
that don't exist as foundation tables yet. It is validated at the service layer, not the
DB layer, exactly like `Comment`/`Approval` below.

**Phase 07** built the module (`DocumentsService`/`DocumentsController`,
`POST /documents`, `GET /documents/:id`, `GET /documents/:id/download`) that this schema
had waited for since Phase 02. `create` auto-grants the uploader `VIEW`+`DOWNLOAD`;
`grantCaseAccess(documentId, caseId)` — called by every Phase 07 evidence/writing service
immediately after an `evidenceDocumentId`/`documentId` link is set — grants `VIEW`+
`DOWNLOAD` to every current `CaseMember` plus the linked student/parent portal users.
Access is a grant-based check (`DocumentAccess` row required, except GLOBAL-scope roles),
not a `ScopeKind` lookup — see `docs/security/RBAC_MATRIX.md` section 3 and
`docs/ASSUMPTIONS.md` ASM-23.

**Phase 08** continues the same pattern unchanged for four new evidence links —
`Application.evidenceDocumentId`, `ApplicationChecklist.documentId`,
`Offer.evidenceDocumentId`, `ScholarshipApplication.evidenceDocumentId` — every Admission
service that sets one of these calls the same `grantCaseAccess` immediately after, no new
Documents-side code needed.

**Phase 12** replaces the Phase 07 metadata-only upload with a real private-storage
pipeline (`StorageProvider`, default `LocalFilesystemStorageProvider` — a non-web-served
directory outside `dist/`, never registered as a static-file route). `POST /documents` is
now a real multipart upload: `fileReference` is server-generated (a `StorageProvider`-
issued key, never derived from or trusted from the client), `checksumSha256`/`mimeType`/
`sizeBytes` are computed from the actual bytes, and `originalFilename` (new column) is a
sanitized display-only name. `MalwareScanProvider` (default: detects the industry-standard
EICAR test signature) runs asynchronously via the new job queue (section 11) —
`scanStatus` starts `PENDING` and download is blocked until it reaches `CLEAN`. Download is
a two-step signed-URL flow (`SignedUrlService`, HMAC-SHA256, short TTL, scoped to one
document + one principal): `GET /documents/:id/download` authorizes and returns a
short-lived `downloadUrl`; the actual bytes are served by the separate, unauthenticated-but-
signature-verified `GET /documents/download/:token`. `EDIT`/`SHARE`/`ARCHIVE` (all three
already reserved in the Phase 02 `DocumentAccessPermission` enum) are now real actions;
`POST /documents/:id/versions` is the only way to replace a document's content — always a
brand-new row chained via `previousVersionId`, existing grants copied forward, never an
in-place overwrite ("Final/submitted/legal files require versioning"). See
`docs/ASSUMPTIONS.md` ASM-50.

## 7. Commercial domain (Phase 05)

```mermaid
erDiagram
    CONTRACT_TEMPLATE ||--o{ CONTRACT : "generates"
    STUDENT ||--o{ CONTRACT : "signs"
    CONTRACT ||--o{ CONTRACT_AMENDMENT : "amended by"
    CONTRACT ||--o{ CONTRACT_REVIEW_LINK : "reviewed via"
    CONTRACT ||--o{ PAYMENT : "scheduled"
    CONTRACT ||--o| CASE : "activates"

    CONTRACT_TEMPLATE {
        uuid id PK
        string code UK
        int version
        bool active
        json merge_fields
    }
    CONTRACT {
        uuid id PK
        string contract_code UK "HD-YYYY-NNNNN"
        uuid student_id FK
        uuid template_id FK "nullable"
        json merge_field_values "this contract instance's filled-in template values"
        decimal value
        char currency "3"
        enum status "Draft/Review/Approved/Sent/Signed/Active/Completed/Liquidated/Archived"
        int version
        decimal approval_threshold "snapshotted at submit() — SRS 6.16 monetary threshold"
        datetime submitted_at
        datetime signed_at
        string signed_document_id "reference to Document, not FK — Document domain is separate"
        datetime sent_at
        datetime activated_at
        datetime completed_at
        datetime liquidated_at
        datetime archived_at
    }
    CONTRACT_REVIEW_LINK {
        uuid id PK
        uuid contract_id FK
        string token_hash UK "opaque token, hash only — raw value returned once"
        datetime expires_at
        datetime viewed_at "nullable"
        datetime revoked_at "nullable"
    }
    CONTRACT_AMENDMENT {
        uuid id PK
        string amendment_code UK "AM-YYYY-NNNNN"
        uuid contract_id FK
        int previous_version
        int new_version
        json before "nullable — fields changed, before"
        json after "nullable — fields changed, after"
        string reason
        datetime effective_date
    }
    PAYMENT {
        uuid id PK
        string payment_code UK "PAY-YYYY-NNNNN"
        uuid contract_id FK
        int installment_no
        decimal amount
        char currency "3"
        datetime due_date
        decimal paid_amount
        string reference "nullable, UNIQUE — duplicate-transaction guard"
        enum status "Pending/PartiallyPaid/Paid/Overdue/Refunded/Waived"
        decimal refunded_amount
        datetime refunded_at "nullable"
        string refund_reason "nullable"
        datetime waived_at "nullable"
        string waived_reason "nullable"
    }
```

`(contractId, installmentNo)` is unique on `Payment`. A signed `Contract`'s legal artifact
(`signed_at`/`signed_document_id`) is never overwritten in place (Hard Rule #4) — live-term
changes after signing go through `ContractAmendment`. `Case.contractId` is set at
`sign()`, not at Contract creation (`docs/ASSUMPTIONS.md` ASM-15). Refund is recorded on
the same `Payment` row rather than a separate transaction table (`docs/ASSUMPTIONS.md`
ASM-14). `PaymentStatus.OVERDUE` is a real stored status, lazily synced from PENDING/
PARTIALLY_PAID on read — see `docs/database/DATA_DICTIONARY.md` section 4.15.

## 8. Partners domain (foundation slice, fully built out Phase 10 — 10-partners/01_PARTNER_CRM.md)

```mermaid
erDiagram
    PARTNER ||--o{ PARTNER_PROGRAM : "offers"
    PARTNER ||--o{ PARTNER_DOCUMENT : "has"
    PARTNER ||--o{ PARTNER_STUDENT_LINK : "linked to"
    PARTNER ||--o{ COMMISSION_RULE : "defines"
    PARTNER ||--o{ COMMISSION_TRANSACTION : "earns"
    PARTNER_PROGRAM ||--o| PROGRAM : "optionally maps to (nullable, Admission domain)"
    PARTNER_PROGRAM ||--o{ COMMISSION_RULE : "may scope a rule"
    STUDENT ||--o{ PARTNER_STUDENT_LINK : "linked via"
    CASE ||--o{ PARTNER_STUDENT_LINK : "linked via (nullable)"
    APPLICATION ||--o{ PARTNER_STUDENT_LINK : "linked via (nullable)"
    DOCUMENT ||--o| PARTNER_DOCUMENT : "documentId (nullable, real FK)"
    COMMISSION_RULE ||--o{ COMMISSION_TRANSACTION : "matched by (snapshotted, not live-joined)"
    CONTRACT ||--o| COMMISSION_TRANSACTION : "sourceType='Contract' (polymorphic)"
    PAYMENT ||--o| COMMISSION_TRANSACTION : "sourceType='Payment' (polymorphic)"
    STUDENT ||--o{ COMMISSION_TRANSACTION : "nullable convenience FK"
    CASE ||--o{ COMMISSION_TRANSACTION : "nullable convenience FK"

    PARTNER {
        uuid id PK
        string partner_code UK "PT-CC-NNNNN"
        string name
        enum type "UNIVERSITY_REPRESENTATIVE|AGENCY|LANGUAGE_CENTER|OTHER"
        char country_code "2"
        string contact_name "nullable"
        string contact_email "nullable"
        string contact_phone "nullable — Phase 10 addition, completes 'contacts'"
        string website "nullable"
        uuid owner_id "nullable — FK-less staff pointer"
        string internal_notes "nullable — field-level redacted from DOCUMENT_SPECIALIST"
        enum status "ACTIVE|INACTIVE"
    }
    PARTNER_PROGRAM {
        uuid id PK
        string partner_program_code UK "PP-CC-NNNNN-NN"
        uuid partner_id FK
        uuid program_id FK "nullable — Phase 10 addition, optional link to Admission's Program"
        string name
        string degree_level "nullable"
        string major "nullable"
        string intake "nullable"
        decimal tuition "nullable"
        string tuition_currency "nullable"
        string scholarship_info "nullable"
        string admissions_rule "nullable"
        enum status "ACTIVE|INACTIVE"
    }
    PARTNER_DOCUMENT {
        uuid id PK
        uuid partner_id FK
        enum type "MOU|AGREEMENT|COMMISSION_AGREEMENT|RATE_SHEET|OTHER"
        int version
        enum status "DRAFT|ACTIVE|EXPIRED|SUPERSEDED|ARCHIVED — Phase 10 addition"
        datetime effective_date "nullable"
        datetime expiry_date "nullable"
        uuid document_id FK "nullable — Phase 10: real FK into Document, replaces the unused Phase 02 file_reference string column"
        uuid owner_id "nullable — Phase 10 addition"
    }
    PARTNER_STUDENT_LINK {
        uuid id PK
        uuid partner_id FK
        uuid student_id FK
        uuid case_id FK "nullable"
        uuid application_id FK "nullable"
        string link_type "free text — Referral/Agent/Sponsor/..., never a hard-coded enum"
        enum status "ACTIVE|ARCHIVED"
        datetime effective_date "nullable"
        datetime end_date "nullable"
        string notes "nullable"
    }
    COMMISSION_RULE {
        uuid id PK
        uuid partner_id FK
        uuid partner_program_id FK "nullable — null means partner-wide"
        enum basis "CONTRACT_VALUE|PAYMENT_COLLECTED|FIXED"
        decimal percentage_rate "nullable — fraction, required unless basis=FIXED"
        decimal fixed_amount "nullable — required only when basis=FIXED"
        char currency "3"
        string conditions "nullable"
        int priority "default 0 — deterministic precedence tie-break"
        datetime effective_date "nullable"
        datetime expiry_date "nullable"
        enum status "ACTIVE|INACTIVE"
    }
    COMMISSION_TRANSACTION {
        uuid id PK
        uuid partner_id FK
        uuid commission_rule_id FK "nullable"
        uuid student_id FK "nullable — derived from source when resolvable"
        uuid case_id FK "nullable"
        uuid application_id FK "nullable"
        string source_type "'Contract' | 'Payment' — polymorphic"
        uuid source_id "nullable"
        enum basis "nullable — snapshotted from the matched rule at CREATE"
        decimal basis_amount "nullable — snapshotted at CALCULATE, read live from the source"
        decimal rate "nullable — snapshotted at CALCULATE"
        decimal calculated_amount "nullable — snapshotted at CALCULATE, Decimal-only math"
        char currency "3"
        enum status "PENDING|ELIGIBLE|CALCULATED|APPROVED|PAYABLE|PAID|CANCELLED"
        datetime paid_at "nullable"
        string payment_reference "nullable"
        string reason "nullable — cancellation reason / notes"
    }
```

**Partner** is GLOBAL, permission-gated only (no per-record scope) — same treatment as
University/Program (`docs/security/RBAC_MATRIX.md` section 3). Duplicate prevention on
(name, countryCode), case-insensitive, `409 DUPLICATE_PARTNER` — "Không duplicate Partner
chỉ vì nhiều Program/Student/Application/Case/CommissionTransaction." Never referenced by
name as a foreign key anywhere; every child row below links via `partnerId`.

**PartnerProgram** always belongs to an existing Partner (nested creation route). Duplicate
prevention on (partnerId, name, degreeLevel, major, intake). `programId` is an OPTIONAL,
one-directional FK into the existing Admission-domain `Program` — set when a partner
program genuinely corresponds to a catalog row, left null when it's purely the partner's
own commercial mapping; never a duplicated University/Program row created in this module —
see `docs/ASSUMPTIONS.md` ASM-41.

**PartnerDocument** reuses the existing Document subsystem (`documentId` real FK, same
ASM-24 precedent as every Phase 07-09 evidence field) — no PartnerFile/PartnerStorage
model. Legal/commercial documents are immutable once ACTIVE ("Không overwrite signed/final
partner documents") — `update()` rejects any PATCH once status leaves DRAFT; a correction
creates a brand-new PartnerDocument row (`(partnerId, type, version)` unique, version
auto-incremented), and `activate()` atomically marks the prior ACTIVE row for the same
(partner, type) as SUPERSEDED. A DRAFT past no natural expiry stays DRAFT indefinitely; an
ACTIVE row past `expiryDate` is lazily synced to EXPIRED on read, the same sweep pattern as
`Offer.status`/`Payment.status`. See `docs/ASSUMPTIONS.md` ASM-42.

**PartnerStudentLink** is a pure junction table (SRS 6.17 "liên kết nhiều student/case/
application bằng bảng trung gian") — every FK is validated against its real owning table,
nothing is ever copied (no student/partner/application name stored on the row). "At most
one ACTIVE link per (partner, student, case, application) tuple" is a service-layer check,
not a DB constraint — archiving frees the combination for a fresh link. A Student may carry
links to many different Partners; a Partner may carry links to many
Students/Cases/Applications — never collapsed into a duplicate Case/Application entity.

**CommissionRule** is deliberately separate from `CommissionTransaction` (config vs. fact)
and carries no shared FK/column with `Payment`/`Contract.value`/
`ScholarshipApplication.awardAmount` anywhere (Hard Rule "Commission phải tách khỏi student
payment"). `basis` determines whether `percentageRate` (a fraction, e.g. 0.10 = 10%) or
`fixedAmount` applies — cross-validated server-side, never both/neither. When several
active rules could match the same transaction, precedence is deterministic: a
PartnerProgram-specific rule beats a partner-wide one, then higher `priority` wins, then
most-recently-created, then `id` — never random (`CommissionRulesService.selectRuleFor`).
See `docs/ASSUMPTIONS.md` ASM-44.

**CommissionTransaction** is the actual financial fact. `basis`/`currency` are snapshotted
from the matched CommissionRule at CREATE time; `basisAmount`/`rate`/`calculatedAmount` are
snapshotted at CALCULATE time, reading the live `Contract.value` or `Payment.paidAmount`
(never a duplicate outstanding/paid calculation — "dùng existing Payment source of truth").
All money math uses `Prisma.Decimal` arithmetic exclusively (`.times()`/
`.toDecimalPlaces(2, ROUND_HALF_UP)`), never a JS-float `Number()` round-trip. The FSM
(PENDING→ELIGIBLE→CALCULATED→APPROVED→PAYABLE→PAID, CANCELLED from any non-terminal state)
is taken verbatim from the orchestration prompt's own example status list — every forward
transition is its own dedicated, precondition-gated action, never a bare client-supplied
status. "No duplicate transaction for the same triggering event" is enforced at the service
layer on `(sourceType, sourceId, commissionRuleId)`, excluding CANCELLED rows. PAID and
CANCELLED are both hard-terminal — no adjustment/reversal mechanism exists (not named
anywhere in 10-partners/01_PARTNER_CRM.md); see `docs/ASSUMPTIONS.md` ASM-45.

See `docs/ASSUMPTIONS.md` ASM-40 through ASM-45 for the specific ambiguous-requirement
resolutions this phase recorded (contacts/business-ID formats, the PartnerProgram↔Program
FK design, the PartnerDocument rebuild, the RBAC/field-redaction matrix, CommissionRule
basis/precedence design, and the no-adjustment-mechanism decision).

## 9. Notifications domain

```mermaid
erDiagram
    USER ||--o{ NOTIFICATION : "recipient"
    USER ||--o{ COMMENT : "author"
    USER ||--o{ APPROVAL : "approver"

    NOTIFICATION {
        uuid id PK
        uuid recipient_id FK
        string event
        enum channel "IN_APP | EMAIL | SMS | ZALO | WHATSAPP"
        json payload "never financial/passport/internal-notes-grade data — see note"
        string dedupe_key UK "nullable — Phase 06 dedup key"
        datetime sent_at "nullable — IN_APP set immediately, EMAIL stays null (no provider yet)"
        datetime read_at
    }
    COMMENT {
        uuid id PK
        string entity_type "polymorphic — see note"
        string entity_id
        uuid author_id FK
        string body
        string visibility "internal | shared"
    }
    APPROVAL {
        uuid id PK
        string entity_type "polymorphic"
        string entity_id
        uuid approver_id FK
        enum decision
        datetime decided_at
    }
```

`Comment`/`Approval` use the same `entityType` + `entityId` polymorphic pattern as
`Document.ownerEntity/ownerId` — one shared model instead of a per-domain duplicate
(ARCH-DEC-04-equivalent reasoning), validated at the service layer.

`Notification.dedupe_key` (Phase 06) is `@unique`, same nullable-unique NULL-semantics
pattern as `Payment.reference`/`ContractReviewLink.token_hash` — a caller-supplied key
like `task-deadline:{taskId}:{offsetDays}:{channel}` makes re-firing the same logical
event a no-op (`NotificationsService.notify` catches the resulting unique-constraint
violation and returns `null` rather than erroring). `payload` is deliberately minimal per
event — e.g. `CONTRACT_APPROVAL_REQUEST` carries `contractId`/`contractCode`/`studentId`
but never `value`/`currency`; `PAYMENT_OVERDUE_REMINDER` carries `paymentId`/`dueDate` but
never `amount` — SRS 6.20 "Không đưa dữ liệu nhạy cảm trực tiếp vào notification body." No
queue/scheduler dispatches these yet — see `docs/ASSUMPTIONS.md` ASM-18.

## 10. Identity domain, extended (Phase 03A/B — Auth + RBAC scope links; Phase 11 — Parent invitation)

```mermaid
erDiagram
    USER ||--o{ SESSION : "has"
    USER ||--o{ PASSWORD_RESET_TOKEN : "has"
    USER ||--o| MFA_SECRET : "has"
    USER ||--o{ MFA_BACKUP_CODE : "has"
    STUDENT ||--o| USER : "portal_user_id (self)"
    STUDENT_CONTACT }o--o| USER : "portal_user_id (linked parent, NOT unique since Phase 11)"
    STUDENT_CONTACT ||--o{ PARENT_INVITATION : "has (Phase 11)"
    USER ||--o{ PARENT_INVITATION : "invited_by_id (staff who sent it)"

    PARENT_INVITATION {
        uuid id PK
        uuid student_contact_id FK
        string token_hash UK "never the raw token — hash-only, same shape as password_reset_tokens"
        datetime expires_at
        uuid invited_by_id FK
        datetime accepted_at "nullable — single-use"
        datetime revoked_at "nullable"
    }

    SESSION {
        uuid id PK "also the access-token jti claim"
        uuid user_id FK
        string refresh_token_hash UK
        datetime expires_at
        datetime revoked_at "nullable"
    }
    PASSWORD_RESET_TOKEN {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        datetime expires_at
        datetime used_at "nullable — single-use, replay prevention"
    }
    MFA_SECRET {
        uuid user_id PK,FK "1:1"
        string secret_ciphertext "AES-256-GCM encrypted TOTP secret"
        bool enabled
    }
    MFA_BACKUP_CODE {
        uuid id PK
        uuid user_id FK
        string code_hash UK
        datetime used_at "nullable — single-use"
    }
```

`users.locked_until` (brute-force lockout) and `audit_logs.metadata` (JSONB — SRS 6.21
export reason/filter/row-count/fields) are column additions on existing Phase 02 tables,
not new tables — see `docs/database/DATA_DICTIONARY.md` section 4.20.

`Student.portalUserId` (nullable, unique) and `StudentContact.portalUserId` (nullable, NOT
unique — see below) are what `ScopePolicyService` (`docs/security/RBAC_MATRIX.md`)
evaluates for the OWN_STUDENT scope kind — see `docs/ASSUMPTIONS.md` ASM-05 for why they
exist.

**Phase 11 — Student/Parent Portal**: `StudentContact.portalUserId`'s original Phase 03
`@unique` constraint was relaxed to a plain index (`docs/DECISIONS.md` DEC-06) — one Parent
`User` commonly links to more than one `StudentContact` row (multiple children), which the
unique constraint made structurally impossible. Every `ScopePolicyService` OWN_STUDENT check
that resolves a linked-parent additionally requires `portalStatus = 'ACTIVE'` (not merely a
non-null `portalUserId`) — access from a `REVOKED` or still-`INVITED` contact is denied on
the very next request, no caching. `ParentInvitation` is a new, narrowly-scoped token table
(never a parallel auth system) — one row per invite attempt, so re-inviting after an
expiry/revoke has its own history rather than overwriting a single mutable field set.
"Verification" is token possession, the same standard `password_reset_tokens` already
established in Phase 03. No new `StudentPortalProfile`/`ParentApplication`/parallel Student
or Parent entity was created — Portal is a read/action layer over the existing
Student/Case/Task/Document/Application/... domains, gated by this relationship plus the new
`portal:access` permission (`docs/security/RBAC_MATRIX.md`). See `docs/ASSUMPTIONS.md`
ASM-46 through ASM-49.

## 11. Cross-cutting infra (not business entities)

```mermaid
erDiagram
    BUSINESS_ID_SEQUENCE {
        string prefix PK
        string bucket PK "year, or ISO country code, depending on the ID format"
        int last_value
    }
    IDEMPOTENCY_KEY {
        uuid id PK
        string key UK
        string request_path
        string request_hash
        json response_body
        datetime expires_at
    }
    BACKGROUND_JOB {
        uuid id PK
        string job_type
        json payload
        string dedupe_key UK "nullable — the idempotency mechanism"
        enum status "PENDING|RUNNING|SUCCEEDED|FAILED"
        int attempts
        int max_attempts
        string last_error "nullable"
        string correlation_id "nullable"
        datetime scheduled_for
        datetime started_at "nullable"
        datetime completed_at "nullable"
    }
    INCOMING_WEBHOOK_EVENT {
        uuid id PK
        string source
        string event_id "UK together with source — replay protection"
        bool signature_valid
        enum status "RECEIVED|PROCESSED|REJECTED"
        json payload
        datetime received_at
        datetime processed_at "nullable"
    }
```

See `docs/database/DATA_DICTIONARY.md` "Additions beyond the required list" for why these
exist and why they are deliberately kept out of the 40-entity business model.

**Phase 12** (12-platform/02_INTEGRATIONS_JOBS.md) adds `BackgroundJob` — the DB-backed
queue behind document scanning, reminder-sweep scheduling, and email dispatch (`JobsService`
enqueues idempotently on `dedupeKey`; `JobRunnerService` polls, dispatches to a registered
per-`jobType` handler, and retries `TransientJobError`s with exponential backoff, capping at
`maxAttempts` before marking `FAILED` — see `docs/ASSUMPTIONS.md` ASM-52) — and
`IncomingWebhookEvent` — a generic, reusable webhook-receipt log; `(source, eventId)`
uniqueness is the idempotency/replay-protection mechanism, checked before any business-data
mutation is attempted (`docs/ASSUMPTIONS.md` ASM-53). Both are process infrastructure, not
business entities, same reasoning as `BusinessIdSequence`/`IdempotencyKey` above.

## 12. Visa domain (Phase 09 — 09-visa/*.md)

```mermaid
erDiagram
    STUDENT ||--o{ VISA : "holds"
    STUDENT ||--o{ ENROLLMENT : "enrolls via"
    CASE ||--o{ VISA : "tracked under"
    CASE ||--o{ ENROLLMENT : "tracked under"
    OFFER ||--o| VISA : "optionally targets (nullable)"
    OFFER ||--o{ ENROLLMENT : "targets (required, must be ACCEPTED)"
    UNIVERSITY ||--o{ ENROLLMENT : "derived from Offer's Program, not client input"
    PROGRAM ||--o{ ENROLLMENT : "derived from Offer's Program, not client input"
    VISA ||--o{ VISA_CHECKLIST_ITEM : "entityType='Visa', entityId=Visa.id"
    CASE ||--o{ VISA_CHECKLIST_ITEM : "entityType='PreDeparture', entityId=Case.id"
    VISA_CHECKLIST_TEMPLATE ||--o{ VISA_CHECKLIST_ITEM : "instantiated once at Visa.create (country+visaType match)"
    DOCUMENT ||--o| VISA : "evidenceDocumentId (nullable)"
    DOCUMENT ||--o| VISA : "resultEvidenceDocumentId (nullable)"
    DOCUMENT ||--o| VISA_CHECKLIST_ITEM : "documentId (nullable)"
    DOCUMENT ||--o| ENROLLMENT : "evidenceDocumentId (nullable)"

    VISA {
        uuid id PK
        string visa_code UK "VISA-YYYY-NNNNN"
        uuid student_id FK
        uuid case_id FK "required"
        uuid offer_id FK "nullable — not every Case's Visa targets one specific Offer"
        string country_code "ISO 3166-1 alpha-2"
        string visa_type "free text — F-1/Student Visa/Tier 4/etc, never a hard-coded enum"
        enum status "NOT_STARTED|PREPARING|READY|SUBMITTED|APPOINTMENT|INTERVIEW|GRANTED|REFUSED|WITHDRAWN"
        datetime submitted_at "nullable"
        string submission_reference "nullable"
        uuid evidence_document_id FK "nullable — submission evidence"
        datetime appointment_at "nullable"
        string appointment_location "nullable"
        string appointment_reference "nullable"
        datetime interview_at "nullable"
        string interview_notes "nullable — field-level redacted from STUDENT_PARENT, see ASM-38"
        datetime result_date "nullable"
        uuid result_evidence_document_id FK "nullable — granted/refused evidence"
        string reason "nullable — refusal/withdrawal reason, visible to the affected student, see ASM-38"
        string internal_notes "nullable — field-level redacted from STUDENT_PARENT"
    }
    VISA_CHECKLIST_TEMPLATE {
        uuid id PK
        string country_code "ISO 3166-1 alpha-2"
        string visa_type
        string title
        bool required
        int sort_order "nullable"
        bool active
    }
    VISA_CHECKLIST_ITEM {
        uuid id PK
        string entity_type "'Visa' | 'PreDeparture' — polymorphic, same pattern as Comment/Approval/Document.ownerEntity"
        uuid entity_id "Visa.id when entityType='Visa'; Case.id when entityType='PreDeparture'"
        string title
        string category "nullable — free text (passport/visa/flight/insurance/accommodation/...), never a hard-coded enum"
        bool required
        uuid owner_id "nullable — FK-less staff pointer"
        datetime deadline "nullable"
        enum status "PENDING|IN_PROGRESS|DONE|WAIVED (reused from Phase 08 ChecklistItemStatus)"
        uuid document_id FK "nullable"
        string notes "nullable"
        datetime completed_at "nullable"
    }
    ENROLLMENT {
        uuid id PK
        uuid student_id FK
        uuid case_id FK "required"
        uuid offer_id FK "required — must resolve to an ACCEPTED Offer"
        uuid university_id FK "derived server-side from Offer's Program, never client input"
        uuid program_id FK "derived server-side from Offer's Program, never client input"
        datetime start_date "nullable"
        datetime confirmation_date "nullable"
        enum status "PLANNED|CONFIRMED|WITHDRAWN"
        uuid evidence_document_id FK "nullable"
        string internal_notes "nullable — field-level redacted from STUDENT_PARENT"
    }
```

**Visa** links to Student/Case directly (never creating a new Student/Case) and optionally
to a specific Offer when the Case's workflow already produced one; "at most one
non-terminal Visa per Case" is a service-layer check
(`VisasService.assertNoActiveDuplicate`, mirroring Application's DEC-05 pattern), not a DB
unique constraint — reapplying after WITHDRAWN/REFUSED creates a new row, preserving full
history. The FSM (`NOT_STARTED -> PREPARING -> READY -> SUBMITTED -> APPOINTMENT ->
INTERVIEW -> GRANTED/REFUSED`, plus `WITHDRAWN` from any non-terminal state) is enforced
entirely server-side with dedicated actions for SUBMITTED/APPOINTMENT/INTERVIEW/GRANTED/
REFUSED — never a bare status PATCH, same discipline as Application/Offer in Phase 08.
READY requires every `required=true` `VisaChecklistItem` under `entityType='Visa'` to be
DONE or WAIVED first.

**VisaChecklistTemplate** is GLOBAL master/config data keyed by `(countryCode, visaType,
title)`, the same treatment as `TaskTemplate`/`ContractTemplate` — checklist content is
never hard-coded in application logic. `VisasService.create` instantiates matching active
templates into real `VisaChecklistItem` rows exactly once, at Visa creation time; templates
are never re-instantiated on read or edit.

**VisaChecklistItem** is deliberately ONE shared polymorphic entity for two Phase 09
consumers (Visa-scoped items and Case-level Pre-Departure items) rather than two near-
duplicate tables — see `docs/ASSUMPTIONS.md` ASM-33 for why this was judged safe to
introduce as new shared structure while Phase 08's already-PASSed `ApplicationChecklist`
was deliberately left untouched, not retroactively generalized into the same model.
Pre-Departure items use `entityId = Case.id` (not `Visa.id`) because pre-departure
readiness is a Case-level milestone that outlives any single Visa attempt.

**Enrollment** is a Student/Case *transaction*, not master data — it references
University/Program by FK only (server-derived from the target Offer's Program, never
accepted from the client, and never copying name/tuition). Creating an Enrollment requires
the target Offer to belong to the same Case and be in `ACCEPTED` status
(`INVALID_ENROLLMENT_TARGET` otherwise — rejects DECLINED/EXPIRED/WITHDRAWN/RECEIVED
offers and offers from other Cases). "At most one CONFIRMED Enrollment per Case" is a
service-layer check (`EnrollmentsService.assertNoActiveConfirmed`); multiple `PLANNED`
attempts and a full WITHDRAWN history are allowed, matching the Phase 09 instruction's
explicit "cần thiết kế lịch sử nếu cho phép nhiều lần nhập học" requirement.

**Closure** (`CasesService.close`, Phase 04's existing Case FSM, extended not duplicated)
gates on four new Phase 09 preconditions in addition to Phase 04's existing open-task
check: outstanding Contract/Payment debt (`PaymentsService.hasOutstandingDebtForCase`,
unconditional), any non-terminal Visa (`VisaStatusService.hasOpenVisa`, unconditional), an
unconfirmed Enrollment when at least one Application exists for the Case
(`VisaStatusService.hasUnconfirmedRequiredEnrollment`, conditional), and an incomplete
Pre-Departure checklist when at least one item exists
(`VisaStatusService.hasIncompletePreDepartureChecklist`, conditional) — see
`docs/ASSUMPTIONS.md` ASM-36 for why the last two are conditional rather than
unconditional. All four checks reuse existing Phase 04/05 services; no duplicate debt
calculation or second Case FSM was introduced.

See `docs/ASSUMPTIONS.md` ASM-33 through ASM-39 for the specific ambiguous-requirement
resolutions this phase recorded (Enrollment as its own entity, the shared
VisaChecklistItem design, the RBAC grant matrix, field-level redaction scope, and the
closure-precondition conditionality reasoning).
