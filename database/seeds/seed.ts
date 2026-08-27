// Foundation + Security seed — Phase 02A extended by Phase 03 (03-security).
//
// Two layers:
//  1. Always seeded (safe in any environment): the 8-role catalogue and the full
//     resource/action permission matrix documented in docs/security/RBAC_MATRIX.md, plus
//     one SYSTEM_ADMIN bootstrap user ("admin").
//  2. Seeded ONLY when NODE_ENV !== 'production': one demo user per role (known password,
//     clearly non-production credentials) plus a small fixture Case/Student graph wired
//     so every ScopeKind (GLOBAL, CASE_MEMBER, OWN_STUDENT, NONE) has both an ALLOW and a
//     DENY account to test against — this is what
//     apps/api/test/rbac.e2e-spec.ts exercises. Real production seeding must never create
//     these.
//
// Idempotent: safe to re-run (upsert by natural key).

import { PrismaClient, RoleCode } from '@prisma/client';
import { createHash, randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

// Duplicated from apps/api/src/common/security/token.util.ts — same separate-TS-project-
// boundary reasoning as hashPassword below.
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// Duplicated from apps/api/src/common/security/password.util.ts — see that file's header
// comment for why (separate TS project boundary, ~10 lines, not worth a shared package).
function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/// SRS section 3 — the 8 roles named in 00_MASTER_CONTEXT.md ROLES / SRS "Vai trò và RBAC".
const ROLES: { code: RoleCode; name: string; description: string }[] = [
  { code: 'EXECUTIVE_DIRECTOR', name: 'Giám đốc điều hành', description: 'Toàn quyền hệ thống, phê duyệt, dashboard toàn cục.' },
  { code: 'DEPARTMENT_MANAGER', name: 'Trưởng phòng', description: 'Điều phối case, task, workload trong bộ phận quản lý.' },
  { code: 'CONSULTANT', name: 'Tư vấn', description: 'Assessment, Roadmap, tư vấn và profile development cho case được phân công.' },
  { code: 'DOCUMENT_SPECIALIST', name: 'Hồ sơ', description: 'Document, Application, Scholarship, Visa cho case được phân công.' },
  { code: 'SALES_MARKETING', name: 'Sale/Marketing', description: 'Lead, nguồn lead, campaign, referral.' },
  { code: 'ADMIN_FINANCE', name: 'Hành chính - Tài chính (HCTH)', description: 'Hợp đồng, phụ lục, payment, công nợ, thanh lý.' },
  { code: 'STUDENT_PARENT', name: 'Học sinh / Phụ huynh', description: 'Truy cập dữ liệu của chính mình qua student/parent portal.' },
  { code: 'SYSTEM_ADMIN', name: 'System Admin', description: 'User/Role/Permission/Configuration/Monitoring.' },
];

/// Full resource/action matrix for every endpoint that exists after Phase 03. Mirrors
/// docs/security/RBAC_MATRIX.md exactly — that document is the human-readable rendering
/// of this table, not an independent source of truth. `students`/`cases` grants encode
/// the base role→permission check only; ScopePolicyService narrows further to the actual
/// record set at request time (see docs/security/RBAC_MATRIX.md "how to read this").
const PERMISSIONS: { resource: string; action: string }[] = [
  { resource: 'students', action: 'view' },
  { resource: 'students', action: 'create' },
  { resource: 'students', action: 'edit' },
  { resource: 'students', action: 'archive' },
  { resource: 'students', action: 'export' },
  { resource: 'cases', action: 'view' },
  { resource: 'cases', action: 'edit' },
  { resource: 'cases', action: 'assign' },
  // Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014, 2026-08-26) — the
  // old `cases:close` permission is retired: closure is now a dedicated, unified workflow
  // (`case-closure`), not a `cases` action. ADMIN_FINANCE (HCTH) is the standard executor
  // (`execute`); EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER may use the same `execute` action as
  // an audited exception (`ClosureService` requires an `overrideReason` from them, never a
  // second/weaker permission); CONSULTANT may only `request`. `view` is granted to all four.
  { resource: 'case-closure', action: 'view' },
  { resource: 'case-closure', action: 'request' },
  { resource: 'case-closure', action: 'execute' },
  { resource: 'leads', action: 'view' },
  { resource: 'leads', action: 'create' },
  { resource: 'leads', action: 'edit' },
  { resource: 'leads', action: 'assign' },
  { resource: 'leads', action: 'convert' },
  { resource: 'users', action: 'view' },
  { resource: 'users', action: 'suspend' },
  { resource: 'users', action: 'offboard' },
  { resource: 'audit_logs', action: 'view' },
  // Phase 12 — background-job status observability (12-platform/02_INTEGRATIONS_JOBS.md
  // "Jobs: job status nếu exposed"). SYSTEM_ADMIN only, same domain boundary as
  // users/audit_logs above.
  { resource: 'jobs', action: 'view' },
  // Phase 05 (05-commercial) — Contract/Payment. See docs/security/RBAC_MATRIX.md for the
  // per-role rationale (why CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/SYSTEM_ADMIN
  // get none of these despite some of them holding students/cases grants).
  { resource: 'contracts', action: 'view' },
  { resource: 'contracts', action: 'create' },
  { resource: 'contracts', action: 'edit' },
  { resource: 'contracts', action: 'approve' },
  { resource: 'contracts', action: 'send' },
  { resource: 'contracts', action: 'sign' },
  { resource: 'contracts', action: 'amend' },
  { resource: 'contracts', action: 'export' },
  { resource: 'payments', action: 'view' },
  { resource: 'payments', action: 'create' },
  { resource: 'payments', action: 'record' },
  { resource: 'payments', action: 'refund' },
  { resource: 'payments', action: 'waive' },
  { resource: 'payments', action: 'export' },
  // Phase 06 (06-operations) — Task Engine. Notification has no permission of its own —
  // its inbox is self-service for every authenticated role (recipientId always ===
  // caller, enforced in NotificationsService, never a role-gated resource) — see
  // docs/security/RBAC_MATRIX.md.
  { resource: 'tasks', action: 'view' },
  { resource: 'tasks', action: 'create' },
  { resource: 'tasks', action: 'edit' },
  { resource: 'tasks', action: 'assign' },
  // Phase 07 (07-profile) — Counseling: Assessment/Roadmap, Profile Evidence (Academic/
  // Test/Competition/Research/Activity — one grouped resource, matching
  // 07-profile/02_PROFILE_EVIDENCE.md's own file-level grouping of all five), Writing
  // (WritingArtifact/WritingVersion/LOR — matching 03_WRITING.md grouping LOR alongside
  // Resume/Essay/SOP), and the new minimal Documents module. See docs/security/
  // RBAC_MATRIX.md for the per-role rationale.
  { resource: 'assessments', action: 'view' },
  { resource: 'assessments', action: 'create' },
  { resource: 'assessments', action: 'edit' },
  { resource: 'assessments', action: 'approve' },
  { resource: 'roadmaps', action: 'view' },
  { resource: 'roadmaps', action: 'create' },
  { resource: 'roadmaps', action: 'edit' },
  { resource: 'roadmaps', action: 'approve' },
  { resource: 'profile_evidence', action: 'view' },
  { resource: 'profile_evidence', action: 'create' },
  { resource: 'profile_evidence', action: 'edit' },
  // Client Acceptance Remediation DEC-05(b) (2026-08-27) — a separate resource from
  // `profile_evidence` because this is master-data curation (a shared, staff-wide school
  // list), not case-scoped counseling work; view is broad, create/edit is ED/DM-only,
  // mirroring the exact `admission_master`/`visa_checklist_templates` convention below.
  { resource: 'school_master', action: 'view' },
  { resource: 'school_master', action: 'create' },
  { resource: 'school_master', action: 'edit' },
  { resource: 'writing', action: 'view' },
  { resource: 'writing', action: 'create' },
  { resource: 'writing', action: 'edit' },
  { resource: 'documents', action: 'view' },
  { resource: 'documents', action: 'create' },
  { resource: 'documents', action: 'download' },
  // Phase 12 (12-platform/01_DOCUMENTS.md) — EDIT (metadata only)/SHARE (grant another
  // principal VIEW/DOWNLOAD)/ARCHIVE. Granted to the four staff roles that already hold
  // `documents:create` (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/CONSULTANT/
  // DOCUMENT_SPECIALIST) — deliberately NOT STUDENT_PARENT, whose document mutation stays
  // scoped to Portal's narrow evidence-submission flow only (docs/ASSUMPTIONS.md ASM-49).
  { resource: 'documents', action: 'edit' },
  { resource: 'documents', action: 'share' },
  { resource: 'documents', action: 'archive' },
  // Phase 12 (12-platform/03_REPORTING.md). One resource — `view` (dashboards, granted to
  // every staff role; ED/DM-only routes are further narrowed inside ReportsService itself,
  // not via a separate permission) and `export` (ED/DM only, same precedent as
  // `students:export`). Student/Parent reporting is Portal, already built — zero grant
  // here for STUDENT_PARENT (docs/ASSUMPTIONS.md ASM-55).
  { resource: 'reports', action: 'view' },
  { resource: 'reports', action: 'export' },
  // Phase 08 (08-admission) — Admission: University/Program/ScholarshipMaster (grouped as
  // `admission_master`, matching 01_MASTER_DATA.md's own file-level grouping of all
  // three), UniversityChoice, Application (covers ApplicationChecklist too — matches
  // 02_APPLICATION.md's own grouping), Offer, ScholarshipApplication. See docs/security/
  // RBAC_MATRIX.md for the per-role rationale. `admission_master` has its own `verify`
  // action ("Source/verification fields có thể có permission riêng").
  { resource: 'admission_master', action: 'view' },
  { resource: 'admission_master', action: 'create' },
  { resource: 'admission_master', action: 'edit' },
  { resource: 'admission_master', action: 'verify' },
  { resource: 'university_choices', action: 'view' },
  { resource: 'university_choices', action: 'create' },
  { resource: 'university_choices', action: 'edit' },
  { resource: 'applications', action: 'view' },
  { resource: 'applications', action: 'create' },
  { resource: 'applications', action: 'edit' },
  { resource: 'offers', action: 'view' },
  { resource: 'offers', action: 'create' },
  { resource: 'offers', action: 'edit' },
  { resource: 'scholarship_applications', action: 'view' },
  { resource: 'scholarship_applications', action: 'create' },
  { resource: 'scholarship_applications', action: 'edit' },
  // Phase 09 (09-visa) — Visa: `visa` covers Visa + its Visa-scoped checklist items
  // (matches 01_VISA.md's own grouping); `visa_checklist_templates` is the country+
  // visa-type configurable master data; `pre_departure` covers the Case-scoped
  // pre-departure checklist; `enrollment` covers Enrollment. See docs/security/
  // RBAC_MATRIX.md for the per-role rationale.
  { resource: 'visa', action: 'view' },
  { resource: 'visa', action: 'create' },
  { resource: 'visa', action: 'edit' },
  { resource: 'visa_checklist_templates', action: 'view' },
  { resource: 'visa_checklist_templates', action: 'create' },
  { resource: 'visa_checklist_templates', action: 'edit' },
  { resource: 'pre_departure', action: 'view' },
  { resource: 'pre_departure', action: 'create' },
  { resource: 'pre_departure', action: 'edit' },
  { resource: 'enrollment', action: 'view' },
  { resource: 'enrollment', action: 'create' },
  { resource: 'enrollment', action: 'edit' },
  // Phase 10 (10-partners) — Partner CRM + Commission: `partner` (Partner master),
  // `partner_programs` (PartnerProgram), `partner_documents` (PartnerDocument),
  // `partner_student_links` (PartnerStudentLink — the Partner<->Student/Case/Application
  // junction), `commission_rules` (CommissionRule config), `commission_transactions`
  // (CommissionTransaction, the actual financial fact) — six distinct resources per
  // "Không dùng một permission tổng PARTNER_* cho mọi hành động." See docs/security/
  // RBAC_MATRIX.md for the per-role rationale.
  { resource: 'partner', action: 'view' },
  { resource: 'partner', action: 'create' },
  { resource: 'partner', action: 'edit' },
  { resource: 'partner_programs', action: 'view' },
  { resource: 'partner_programs', action: 'create' },
  { resource: 'partner_programs', action: 'edit' },
  { resource: 'partner_documents', action: 'view' },
  { resource: 'partner_documents', action: 'create' },
  { resource: 'partner_documents', action: 'edit' },
  { resource: 'partner_student_links', action: 'view' },
  { resource: 'partner_student_links', action: 'create' },
  { resource: 'partner_student_links', action: 'edit' },
  { resource: 'commission_rules', action: 'view' },
  { resource: 'commission_rules', action: 'create' },
  { resource: 'commission_rules', action: 'edit' },
  { resource: 'commission_transactions', action: 'view' },
  { resource: 'commission_transactions', action: 'create' },
  { resource: 'commission_transactions', action: 'edit' },
  // Phase 11 (11-portal) — Student/Parent Portal. `portal:access` is the single gate on
  // the entire `/portal/*` self-service surface (`PortalController`), granted ONLY to
  // STUDENT_PARENT — every actual data-scope decision inside it is
  // `ScopePolicyService.assertStudentAccessible` (record-scope), not a second permission
  // per view. See docs/security/RBAC_MATRIX.md and docs/ASSUMPTIONS.md ASM-49.
  { resource: 'portal', action: 'access' },
];

const GRANTS: Record<RoleCode, { resource: string; action: string }[]> = {
  // SRS 6.1 "Không bỏ qua audit; vẫn ghi nhận mọi export/download" — GĐĐH is broad but
  // still runs through every guard/interceptor like anyone else.
  EXECUTIVE_DIRECTOR: [
    { resource: 'students', action: 'view' },
    { resource: 'students', action: 'create' },
    { resource: 'students', action: 'edit' },
    { resource: 'students', action: 'archive' },
    { resource: 'students', action: 'export' },
    { resource: 'cases', action: 'view' },
    { resource: 'cases', action: 'edit' },
    { resource: 'cases', action: 'assign' },
    // DEC-06 — GĐĐH may exercise the audited exception path (ClosureService requires an
    // overrideReason from this role, never a weaker check), not a standalone closure path.
    { resource: 'case-closure', action: 'view' },
    { resource: 'case-closure', action: 'execute' },
    { resource: 'leads', action: 'view' },
    { resource: 'leads', action: 'create' },
    { resource: 'leads', action: 'edit' },
    { resource: 'leads', action: 'assign' },
    { resource: 'leads', action: 'convert' },
    { resource: 'users', action: 'view' },
    { resource: 'audit_logs', action: 'view' },
    // Full Contract oversight (CONTRACT_ROLE_SCOPE = GLOBAL) including final approval
    // above the monetary threshold (ContractsService.assertApproverAllowed reserves
    // over-threshold approval to EXECUTIVE_DIRECTOR specifically, on top of this grant).
    // Payment execution (record/refund/waive) stays with ADMIN_FINANCE — GĐĐH can still
    // view/export for oversight without being a day-to-day cashier.
    { resource: 'contracts', action: 'view' },
    { resource: 'contracts', action: 'create' },
    { resource: 'contracts', action: 'edit' },
    { resource: 'contracts', action: 'approve' },
    { resource: 'contracts', action: 'send' },
    { resource: 'contracts', action: 'sign' },
    { resource: 'contracts', action: 'amend' },
    { resource: 'contracts', action: 'export' },
    { resource: 'payments', action: 'view' },
    { resource: 'payments', action: 'export' },
    // Task Engine (Phase 06) — GLOBAL scope on Task, same as Student/Case (Task reuses
    // ROLE_SCOPE — docs/ASSUMPTIONS.md ASM-16).
    { resource: 'tasks', action: 'view' },
    { resource: 'tasks', action: 'create' },
    { resource: 'tasks', action: 'edit' },
    { resource: 'tasks', action: 'assign' },
    // Phase 07 — full oversight, including final approval (separation of duties: the
    // Consultant who builds an Assessment/Roadmap does not self-approve it — same
    // reasoning as Contract approval in Phase 05).
    { resource: 'assessments', action: 'view' },
    { resource: 'assessments', action: 'create' },
    { resource: 'assessments', action: 'edit' },
    { resource: 'assessments', action: 'approve' },
    { resource: 'roadmaps', action: 'view' },
    { resource: 'roadmaps', action: 'create' },
    { resource: 'roadmaps', action: 'edit' },
    { resource: 'roadmaps', action: 'approve' },
    { resource: 'profile_evidence', action: 'view' },
    { resource: 'profile_evidence', action: 'create' },
    { resource: 'profile_evidence', action: 'edit' },
    { resource: 'school_master', action: 'view' },
    { resource: 'school_master', action: 'create' },
    { resource: 'school_master', action: 'edit' },
    { resource: 'writing', action: 'view' },
    { resource: 'writing', action: 'create' },
    { resource: 'writing', action: 'edit' },
    { resource: 'documents', action: 'view' },
    { resource: 'documents', action: 'create' },
    { resource: 'documents', action: 'download' },
    { resource: 'documents', action: 'edit' },
    { resource: 'documents', action: 'share' },
    { resource: 'documents', action: 'archive' },
    // Phase 08 — full oversight of the Admission domain, including master-data curation
    // and verification (only ED/DM curate the University/Program/ScholarshipMaster
    // catalog — "Master data permissions phải tách khỏi Student transaction permissions").
    { resource: 'admission_master', action: 'view' },
    { resource: 'admission_master', action: 'create' },
    { resource: 'admission_master', action: 'edit' },
    { resource: 'admission_master', action: 'verify' },
    { resource: 'university_choices', action: 'view' },
    { resource: 'university_choices', action: 'create' },
    { resource: 'university_choices', action: 'edit' },
    { resource: 'applications', action: 'view' },
    { resource: 'applications', action: 'create' },
    { resource: 'applications', action: 'edit' },
    { resource: 'offers', action: 'view' },
    { resource: 'offers', action: 'create' },
    { resource: 'offers', action: 'edit' },
    { resource: 'scholarship_applications', action: 'view' },
    { resource: 'scholarship_applications', action: 'create' },
    { resource: 'scholarship_applications', action: 'edit' },
    // Phase 09 — full oversight of the Visa domain, including master-data curation
    // (only ED/DM curate the country+visa-type checklist template catalog).
    { resource: 'visa', action: 'view' },
    { resource: 'visa', action: 'create' },
    { resource: 'visa', action: 'edit' },
    { resource: 'visa_checklist_templates', action: 'view' },
    { resource: 'visa_checklist_templates', action: 'create' },
    { resource: 'visa_checklist_templates', action: 'edit' },
    { resource: 'pre_departure', action: 'view' },
    { resource: 'pre_departure', action: 'create' },
    { resource: 'pre_departure', action: 'edit' },
    { resource: 'enrollment', action: 'view' },
    { resource: 'enrollment', action: 'create' },
    { resource: 'enrollment', action: 'edit' },
    // Phase 10 — full oversight of the Partner CRM + Commission domain.
    { resource: 'partner', action: 'view' },
    { resource: 'partner', action: 'create' },
    { resource: 'partner', action: 'edit' },
    { resource: 'partner_programs', action: 'view' },
    { resource: 'partner_programs', action: 'create' },
    { resource: 'partner_programs', action: 'edit' },
    { resource: 'partner_documents', action: 'view' },
    { resource: 'partner_documents', action: 'create' },
    { resource: 'partner_documents', action: 'edit' },
    { resource: 'partner_student_links', action: 'view' },
    { resource: 'partner_student_links', action: 'create' },
    { resource: 'partner_student_links', action: 'edit' },
    { resource: 'commission_rules', action: 'view' },
    { resource: 'commission_rules', action: 'create' },
    { resource: 'commission_rules', action: 'edit' },
    { resource: 'commission_transactions', action: 'view' },
    { resource: 'commission_transactions', action: 'create' },
    { resource: 'commission_transactions', action: 'edit' },
    { resource: 'reports', action: 'view' },
    { resource: 'reports', action: 'export' },
  ],
  // Department scope approximated as GLOBAL — see docs/ASSUMPTIONS.md ASM-06.
  DEPARTMENT_MANAGER: [
    { resource: 'students', action: 'view' },
    { resource: 'students', action: 'create' },
    { resource: 'students', action: 'edit' },
    { resource: 'students', action: 'archive' },
    { resource: 'students', action: 'export' },
    { resource: 'cases', action: 'view' },
    { resource: 'cases', action: 'edit' },
    { resource: 'cases', action: 'assign' },
    // DEC-06 — same audited exception path as EXECUTIVE_DIRECTOR (see its own grant above).
    { resource: 'case-closure', action: 'view' },
    { resource: 'case-closure', action: 'execute' },
    { resource: 'leads', action: 'view' },
    { resource: 'leads', action: 'create' },
    { resource: 'leads', action: 'edit' },
    { resource: 'leads', action: 'assign' },
    { resource: 'leads', action: 'convert' },
    // Same Contract oversight as EXECUTIVE_DIRECTOR (below-threshold approval; over-
    // threshold is still reserved to EXECUTIVE_DIRECTOR by assertApproverAllowed), but
    // Payment execution is ADMIN_FINANCE's job, not Department Manager's — view/export
    // only, no record/refund/waive.
    { resource: 'contracts', action: 'view' },
    { resource: 'contracts', action: 'create' },
    { resource: 'contracts', action: 'edit' },
    { resource: 'contracts', action: 'approve' },
    { resource: 'contracts', action: 'send' },
    { resource: 'contracts', action: 'sign' },
    { resource: 'contracts', action: 'amend' },
    { resource: 'contracts', action: 'export' },
    { resource: 'payments', action: 'view' },
    { resource: 'payments', action: 'export' },
    { resource: 'tasks', action: 'view' },
    { resource: 'tasks', action: 'create' },
    { resource: 'tasks', action: 'edit' },
    { resource: 'tasks', action: 'assign' },
    { resource: 'assessments', action: 'view' },
    { resource: 'assessments', action: 'create' },
    { resource: 'assessments', action: 'edit' },
    { resource: 'assessments', action: 'approve' },
    { resource: 'roadmaps', action: 'view' },
    { resource: 'roadmaps', action: 'create' },
    { resource: 'roadmaps', action: 'edit' },
    { resource: 'roadmaps', action: 'approve' },
    { resource: 'profile_evidence', action: 'view' },
    { resource: 'profile_evidence', action: 'create' },
    { resource: 'profile_evidence', action: 'edit' },
    { resource: 'school_master', action: 'view' },
    { resource: 'school_master', action: 'create' },
    { resource: 'school_master', action: 'edit' },
    { resource: 'writing', action: 'view' },
    { resource: 'writing', action: 'create' },
    { resource: 'writing', action: 'edit' },
    { resource: 'documents', action: 'view' },
    { resource: 'documents', action: 'create' },
    { resource: 'documents', action: 'download' },
    { resource: 'documents', action: 'edit' },
    { resource: 'documents', action: 'share' },
    { resource: 'documents', action: 'archive' },
    // Phase 08 — same as EXECUTIVE_DIRECTOR.
    { resource: 'admission_master', action: 'view' },
    { resource: 'admission_master', action: 'create' },
    { resource: 'admission_master', action: 'edit' },
    { resource: 'admission_master', action: 'verify' },
    { resource: 'university_choices', action: 'view' },
    { resource: 'university_choices', action: 'create' },
    { resource: 'university_choices', action: 'edit' },
    { resource: 'applications', action: 'view' },
    { resource: 'applications', action: 'create' },
    { resource: 'applications', action: 'edit' },
    { resource: 'offers', action: 'view' },
    { resource: 'offers', action: 'create' },
    { resource: 'offers', action: 'edit' },
    { resource: 'scholarship_applications', action: 'view' },
    { resource: 'scholarship_applications', action: 'create' },
    { resource: 'scholarship_applications', action: 'edit' },
    // Phase 09 — same as EXECUTIVE_DIRECTOR.
    { resource: 'visa', action: 'view' },
    { resource: 'visa', action: 'create' },
    { resource: 'visa', action: 'edit' },
    { resource: 'visa_checklist_templates', action: 'view' },
    { resource: 'visa_checklist_templates', action: 'create' },
    { resource: 'visa_checklist_templates', action: 'edit' },
    { resource: 'pre_departure', action: 'view' },
    { resource: 'pre_departure', action: 'create' },
    { resource: 'pre_departure', action: 'edit' },
    { resource: 'enrollment', action: 'view' },
    { resource: 'enrollment', action: 'create' },
    { resource: 'enrollment', action: 'edit' },
    // Phase 10 — same as EXECUTIVE_DIRECTOR.
    { resource: 'partner', action: 'view' },
    { resource: 'partner', action: 'create' },
    { resource: 'partner', action: 'edit' },
    { resource: 'partner_programs', action: 'view' },
    { resource: 'partner_programs', action: 'create' },
    { resource: 'partner_programs', action: 'edit' },
    { resource: 'partner_documents', action: 'view' },
    { resource: 'partner_documents', action: 'create' },
    { resource: 'partner_documents', action: 'edit' },
    { resource: 'partner_student_links', action: 'view' },
    { resource: 'partner_student_links', action: 'create' },
    { resource: 'partner_student_links', action: 'edit' },
    { resource: 'commission_rules', action: 'view' },
    { resource: 'commission_rules', action: 'create' },
    { resource: 'commission_rules', action: 'edit' },
    { resource: 'commission_transactions', action: 'view' },
    { resource: 'commission_transactions', action: 'create' },
    { resource: 'commission_transactions', action: 'edit' },
    { resource: 'reports', action: 'view' },
    { resource: 'reports', action: 'export' },
  ],
  // CASE_MEMBER scope — see docs/security/RBAC_MATRIX.md. No `create`: Student rows are
  // created via Lead conversion (04-core-crm/01_LEAD.md), not directly by a consultant.
  // cases:edit/assign are granted at role level but narrowed by CasesService.
  // assertManageable to "must be the case's OWNER member", not just any member — see that
  // method's doc comment. Task grants mirror Case's (CASE_MEMBER scope, same reasoning) —
  // full view/create/edit/assign, narrowed per-task by TasksService.requireManageable the
  // same way. DEC-06 (GAP-007, 2026-08-26): Consultant may only `request` closure
  // (advisory — ClosureService.requestClosure, narrowed to case-owner) — never `execute`;
  // the old `cases:close` grant is retired.
  CONSULTANT: [
    { resource: 'students', action: 'view' },
    { resource: 'students', action: 'edit' },
    { resource: 'cases', action: 'view' },
    { resource: 'cases', action: 'edit' },
    { resource: 'cases', action: 'assign' },
    { resource: 'case-closure', action: 'view' },
    { resource: 'case-closure', action: 'request' },
    { resource: 'tasks', action: 'view' },
    { resource: 'tasks', action: 'create' },
    { resource: 'tasks', action: 'edit' },
    { resource: 'tasks', action: 'assign' },
    // Phase 07 — "Assessment, Roadmap, tư vấn và profile development cho case được phân
    // công" (SRS role description) is CONSULTANT's core domain. No `approve` on
    // assessments/roadmaps — separation of duties, ED/DM only (see the note above their
    // own grants).
    { resource: 'assessments', action: 'view' },
    { resource: 'assessments', action: 'create' },
    { resource: 'assessments', action: 'edit' },
    { resource: 'roadmaps', action: 'view' },
    { resource: 'roadmaps', action: 'create' },
    { resource: 'roadmaps', action: 'edit' },
    { resource: 'profile_evidence', action: 'view' },
    { resource: 'profile_evidence', action: 'create' },
    { resource: 'profile_evidence', action: 'edit' },
    { resource: 'school_master', action: 'view' },
    { resource: 'writing', action: 'view' },
    { resource: 'writing', action: 'create' },
    { resource: 'writing', action: 'edit' },
    { resource: 'documents', action: 'view' },
    { resource: 'documents', action: 'create' },
    { resource: 'documents', action: 'download' },
    { resource: 'documents', action: 'edit' },
    { resource: 'documents', action: 'share' },
    { resource: 'documents', action: 'archive' },
    // Phase 08 — "Consultant có thể làm application-related work trong case scope."
    // `admission_master`: view only ("Consultant có thể sử dụng Program nhưng không nhất
    // thiết được chỉnh tuition" — catalog curation stays ED/DM-only). Full view/create/
    // edit on the case-scoped transaction entities (School Selection, Application, Offer,
    // ScholarshipApplication) — this IS Consultant's counseling-execution domain.
    { resource: 'admission_master', action: 'view' },
    { resource: 'university_choices', action: 'view' },
    { resource: 'university_choices', action: 'create' },
    { resource: 'university_choices', action: 'edit' },
    { resource: 'applications', action: 'view' },
    { resource: 'applications', action: 'create' },
    { resource: 'applications', action: 'edit' },
    { resource: 'offers', action: 'view' },
    { resource: 'offers', action: 'create' },
    { resource: 'offers', action: 'edit' },
    { resource: 'scholarship_applications', action: 'view' },
    { resource: 'scholarship_applications', action: 'create' },
    { resource: 'scholarship_applications', action: 'edit' },
    // Phase 09 — "Consultant chỉ trong case scope": full view/create/edit on the
    // case-scoped Visa/pre-departure/Enrollment work (its counseling-execution domain,
    // same as Admission above); view-only on the checklist-template catalog (master-data
    // curation stays ED/DM-only, mirrors `admission_master`).
    { resource: 'visa', action: 'view' },
    { resource: 'visa', action: 'create' },
    { resource: 'visa', action: 'edit' },
    { resource: 'visa_checklist_templates', action: 'view' },
    { resource: 'pre_departure', action: 'view' },
    { resource: 'pre_departure', action: 'create' },
    { resource: 'pre_departure', action: 'edit' },
    { resource: 'enrollment', action: 'view' },
    { resource: 'enrollment', action: 'create' },
    { resource: 'enrollment', action: 'edit' },
    // Phase 10 — Commission/PartnerProgram/PartnerDocument/PartnerStudentLink stay ZERO:
    // 10-partners/01_PARTNER_CRM.md's own RBAC callout ("Consultant không mặc định được
    // xem commission/partner commercial terms" — see docs/ASSUMPTIONS.md ASM-43) still
    // holds for those. `partner:view` (base Partner CRM directory) is the one exception,
    // added per the client's own permission matrix (sheet03 Phan_quyen_module row
    // "Partner CRM": Tư vấn = "Xem") — confirmed via live RBAC re-audit that this cell was
    // actually zero, not restricted, contradicting the matrix. View-only, matching the
    // matrix's "Xem," not "Có".
    { resource: 'partner', action: 'view' },
    { resource: 'reports', action: 'view' },
  ],
  // DOCUMENT_SPECIALIST is narrower than CONSULTANT on CASE management specifically (no
  // cases:edit/assign/close — see the existing note above CONSULTANT's grant) — that
  // narrowing is about who runs the CASE, not who executes Task work. Task execution
  // (view/create/edit/assign) is granted at parity with CONSULTANT: the real narrowing
  // for a mere CASE_MEMBER collaborator (which DOCUMENT_SPECIALIST always is in this
  // fixture graph — never a case OWNER) already happens in
  // `TasksService.requireManageable`, which only ever lets a non-owner-of-the-case manage
  // a task they personally own — granting the base permission doesn't expand that.
  DOCUMENT_SPECIALIST: [
    { resource: 'students', action: 'view' },
    { resource: 'cases', action: 'view' },
    { resource: 'tasks', action: 'view' },
    { resource: 'tasks', action: 'create' },
    { resource: 'tasks', action: 'edit' },
    { resource: 'tasks', action: 'assign' },
    // Phase 07 — view-only on counseling data itself (07-profile's own instruction:
    // "Application/Document Specialist không tự động có quyền sửa mọi counseling/profile
    // data nếu RBAC không cho phép" — its SRS domain is Document/Application/Scholarship/
    // Visa, not Assessment/Roadmap/profile development). Full `documents:*` — Document IS
    // its actual domain.
    { resource: 'assessments', action: 'view' },
    { resource: 'roadmaps', action: 'view' },
    { resource: 'profile_evidence', action: 'view' },
    { resource: 'school_master', action: 'view' },
    { resource: 'writing', action: 'view' },
    { resource: 'documents', action: 'view' },
    { resource: 'documents', action: 'create' },
    { resource: 'documents', action: 'download' },
    { resource: 'documents', action: 'edit' },
    { resource: 'documents', action: 'share' },
    { resource: 'documents', action: 'archive' },
    // Phase 08 — "Application/Document Specialist có quyền xử lý hồ sơ nhưng không mặc
    // nhiên có quyền tài chính hoặc counseling nội bộ." Full view/create/edit on
    // Application (+checklist) — this IS its document-processing domain. View-only on
    // master data, School Selection, Offer, and ScholarshipApplication (those are
    // counseling/strategy/negotiation calls, not paperwork processing).
    { resource: 'admission_master', action: 'view' },
    { resource: 'university_choices', action: 'view' },
    { resource: 'applications', action: 'view' },
    { resource: 'applications', action: 'create' },
    { resource: 'applications', action: 'edit' },
    { resource: 'offers', action: 'view' },
    { resource: 'scholarship_applications', action: 'view' },
    // Phase 09 — same document-processing-domain reasoning as Application: full
    // view/create/edit on Visa (+checklist) and pre-departure (both paperwork-heavy —
    // passport/visa/flight/insurance evidence). View-only on Enrollment (a counseling
    // commitment decision, not paperwork) and the checklist-template catalog (master
    // data).
    { resource: 'visa', action: 'view' },
    { resource: 'visa', action: 'create' },
    { resource: 'visa', action: 'edit' },
    { resource: 'visa_checklist_templates', action: 'view' },
    { resource: 'pre_departure', action: 'view' },
    { resource: 'pre_departure', action: 'create' },
    { resource: 'pre_departure', action: 'edit' },
    { resource: 'enrollment', action: 'view' },
    // Phase 10 — "Application/Document Specialist chỉ xem partner documents theo scope"
    // (view-only, and only the two resources it actually touches: enough Partner context
    // to make sense of a PartnerDocument, plus the documents themselves). Zero on
    // PartnerProgram/PartnerStudentLink/CommissionRule/CommissionTransaction — those are
    // commercial/relationship-management calls, not paperwork processing.
    { resource: 'partner', action: 'view' },
    { resource: 'partner_documents', action: 'view' },
    { resource: 'reports', action: 'view' },
  ],
  // OWN_LEAD scope (docs/security/RBAC_MATRIX.md) — this is Sales/Marketing's core
  // domain (SRS section 3: "Lead, nguồn lead, campaign, referral"). Still deliberately NO
  // students:edit/cases grant — SRS: "Không passport, tài chính, visa, tài liệu nhạy cảm",
  // and FieldPolicyService.redactStudent still strips Student.budget from this role
  // regardless of the view grant below.
  SALES_MARKETING: [
    { resource: 'leads', action: 'view' },
    { resource: 'leads', action: 'create' },
    { resource: 'leads', action: 'edit' },
    { resource: 'leads', action: 'assign' },
    { resource: 'leads', action: 'convert' },
    // `students:view` added per the client's own permission matrix (sheet03
    // Phan_quyen_module row "Student Profile": Sale/Marketing = "Hạn chế") — confirmed via
    // live RBAC re-audit that this cell was actually zero, not restricted. View-only,
    // matching the matrix's "Hạn chế," not "Có"; sensitive fields (budget) still redacted.
    { resource: 'students', action: 'view' },
    // Phase 08 — "Sales/Marketing không mặc nhiên được xem application/visa-sensitive
    // data": zero grant on UniversityChoice/Application/Offer/ScholarshipApplication
    // (all Student/Case-scoped transaction data). `admission_master:view` only — the
    // University/Program catalog is public reference information (a university's own
    // published tuition/admissions page), useful when describing programs to a
    // prospective Lead, and carries no student-linked sensitivity.
    { resource: 'admission_master', action: 'view' },
    // Phase 09 — "Sales/Marketing không mặc định được xem visa/identity/finance
    // evidence": zero grant on Visa/pre-departure/Enrollment (all sensitive Student/Case
    // transaction data). `visa_checklist_templates:view` only — checklist titles like
    // "Passport copy" are non-sensitive catalog data, same reasoning as
    // `admission_master:view` above.
    { resource: 'visa_checklist_templates', action: 'view' },
    // Phase 10 — deliberately ZERO grant. No instruction line grants Sales/Marketing any
    // Partner CRM visibility, and the phase's own security section repeatedly cautions
    // against default access to commission-adjacent data — kept conservative, same
    // reasoning as its zero grant on Contract/Payment. See docs/ASSUMPTIONS.md ASM-43.
    { resource: 'reports', action: 'view' },
  ],
  // SRS section 3 "HCTH: Hợp đồng, phụ lục, payment, công nợ, thanh lý" — this IS Admin/
  // Finance's entire domain (CONTRACT_ROLE_SCOPE = GLOBAL, unlike its NONE scope on
  // Student/Case). Full day-to-day contract processing and full payment execution
  // (create installment/record/refund/waive), but deliberately NO `approve`/`amend` —
  // final approval and material term changes are an ED/Department-Manager decision, not
  // an execution one (mirrors "Không tự suy diễn requirement" — SRS doesn't say HCTH
  // approves its own contracts).
  ADMIN_FINANCE: [
    // Client Acceptance Remediation DEC-06 (GAP-007, REQ-CASE-014, 2026-08-26) — HCTH is
    // the standard executing actor of the unified Closure/Liquidation workflow ("HCTH:
    // Hợp đồng... công nợ, thanh lý" already named it as owner; the client's fresh decision
    // now also makes it the sole standard executor of Đóng hồ sơ). A NEW, narrow
    // `case-closure` permission, not a broadened `cases:*` grant (which stays NONE-scoped
    // for this role) — see docs/requirements/CLOSURE_LIQUIDATION_DESIGN.md "Implementation
    // Assumption #3" for why. `ClosureService` does its own record-level authorization
    // (any Case, since Closure genuinely is this role's whole domain), not
    // `ScopePolicyService.assertCaseAccessible`.
    { resource: 'case-closure', action: 'view' },
    { resource: 'case-closure', action: 'execute' },
    // `students:view` and `visa:view` added per the client's own permission matrix (sheet03
    // Phan_quyen_module rows "Student Profile" and "Visa": HCTH = "Hạn chế" on both) —
    // confirmed via live RBAC re-audit that both cells were actually zero, not restricted.
    // View-only, matching the matrix's "Hạn chế," not "Có"; FieldPolicyService.redactStudent
    // still strips Student.budget from this role regardless of the view grant.
    { resource: 'students', action: 'view' },
    { resource: 'visa', action: 'view' },
    { resource: 'contracts', action: 'view' },
    { resource: 'contracts', action: 'create' },
    { resource: 'contracts', action: 'edit' },
    { resource: 'contracts', action: 'send' },
    { resource: 'contracts', action: 'sign' },
    { resource: 'contracts', action: 'export' },
    { resource: 'payments', action: 'view' },
    { resource: 'payments', action: 'create' },
    { resource: 'payments', action: 'record' },
    { resource: 'payments', action: 'refund' },
    { resource: 'payments', action: 'waive' },
    { resource: 'payments', action: 'export' },
    // Phase 10 — "Finance/Admin phải có quyền commission/settlement phù hợp": full
    // view/create/edit on CommissionRule + CommissionTransaction (settlement IS its job,
    // mirrors its full Contract/Payment execution grant above). View-only on
    // Partner/PartnerProgram/PartnerDocument/PartnerStudentLink — it needs read context
    // for finance work but relationship management is not its domain.
    { resource: 'partner', action: 'view' },
    { resource: 'partner_programs', action: 'view' },
    { resource: 'partner_documents', action: 'view' },
    { resource: 'partner_student_links', action: 'view' },
    { resource: 'commission_rules', action: 'view' },
    { resource: 'commission_rules', action: 'create' },
    { resource: 'commission_rules', action: 'edit' },
    { resource: 'commission_transactions', action: 'view' },
    { resource: 'commission_transactions', action: 'create' },
    { resource: 'commission_transactions', action: 'edit' },
    { resource: 'reports', action: 'view' },
  ],
  // OWN_STUDENT scope. No `edit` yet — see docs/ASSUMPTIONS.md ASM-09 (self-service field-
  // level editing rules are Phase 07/11 portal work, not this phase's). Contract/Payment
  // view-only, own records only (CONTRACT_ROLE_SCOPE = OWN_STUDENT) — a student/parent can
  // see what they owe and what they've paid, never mutate it.
  STUDENT_PARENT: [
    { resource: 'students', action: 'view' },
    { resource: 'cases', action: 'view' },
    { resource: 'contracts', action: 'view' },
    { resource: 'payments', action: 'view' },
    // Phase 07 — view-only, own case (a family transparently sees its own gap analysis/
    // roadmap/profile evidence/writing drafts — the counseling service's own value
    // proposition). No assessment/roadmap/profile-evidence/writing `create`/`edit` —
    // self-service editing of THOSE stays staff-only even after Phase 11 (only
    // milestone-evidence/task-output/application-document upload are the concrete
    // self-service capabilities 11-portal/01_STUDENT_PARENT_PORTAL.md actually names).
    { resource: 'assessments', action: 'view' },
    { resource: 'roadmaps', action: 'view' },
    { resource: 'profile_evidence', action: 'view' },
    { resource: 'writing', action: 'view' },
    // `documents:create` added Phase 11 — "Student can: upload allowed docs" /
    // "upload application documents" — was deliberately absent through Phase 07-10
    // (self-service editing deferred as "Phase 11 Portal work," same ASM-09 precedent);
    // now due. `DocumentsService.create` still requires the caller to be the resource's
    // uploader; Portal's own narrow evidence-submission actions additionally verify the
    // uploaded Document belongs to the calling principal before linking it anywhere.
    { resource: 'documents', action: 'view' },
    { resource: 'documents', action: 'create' },
    { resource: 'documents', action: 'download' },
    // Phase 08 — "Student/Parent chỉ được xem dữ liệu của Student được liên kết": view-only
    // across every Admission resource, own student/case only (scope-enforced). No
    // `create`/`edit` — accepting/declining an Offer or confirming scholarship eligibility
    // is staff-mediated in this phase, same self-service-deferred precedent as ASM-09.
    { resource: 'admission_master', action: 'view' },
    { resource: 'university_choices', action: 'view' },
    { resource: 'applications', action: 'view' },
    { resource: 'offers', action: 'view' },
    { resource: 'scholarship_applications', action: 'view' },
    // Phase 09 — "Student/Parent chỉ được truy cập dữ liệu của linked Student": view-only
    // across every Visa resource, own case only. No self-service submit/confirm/withdraw
    // actions in this phase, same ASM-09 precedent.
    { resource: 'visa', action: 'view' },
    { resource: 'visa_checklist_templates', action: 'view' },
    { resource: 'pre_departure', action: 'view' },
    { resource: 'enrollment', action: 'view' },
    // Phase 10 — deliberately ZERO grant. "Student/Parent không được xem commission" —
    // extended to every Partner CRM resource, not just CommissionTransaction itself: none
    // of it is the student's own data, it's the agency's business-development/finance
    // relationship with a partner. See docs/ASSUMPTIONS.md ASM-43.
    // Phase 11 — the entire `/portal/*` self-service surface. See docs/ASSUMPTIONS.md
    // ASM-49.
    { resource: 'portal', action: 'access' },
  ],
  // SRS section 3: "Không mặc định được đọc nội dung hồ sơ nhạy cảm nếu không được cấp
  // business permission" — deliberately NO students/cases grant. Identity/audit admin
  // only.
  SYSTEM_ADMIN: [
    { resource: 'users', action: 'view' },
    { resource: 'users', action: 'suspend' },
    { resource: 'users', action: 'offboard' },
    { resource: 'audit_logs', action: 'view' },
    { resource: 'jobs', action: 'view' },
  ],
};

async function seedRolesAndPermissions(): Promise<Map<RoleCode, string>> {
  console.log('Seeding roles...');
  const roleByCode = new Map<RoleCode, string>();
  for (const r of ROLES) {
    const row = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: { code: r.code, name: r.name, description: r.description },
    });
    roleByCode.set(r.code, row.id);
  }

  console.log('Seeding permission matrix...');
  const permissionIdByKey = new Map<string, string>();
  for (const p of PERMISSIONS) {
    // Compound unique [resource, action, fieldScope] cannot be looked up via a single
    // upsert() `where` when fieldScope is null (Prisma does not accept null inside a
    // compound-unique filter) — find-then-create instead.
    let row = await prisma.permission.findFirst({ where: { resource: p.resource, action: p.action, fieldScope: null } });
    if (!row) {
      row = await prisma.permission.create({ data: { resource: p.resource, action: p.action } });
    }
    permissionIdByKey.set(`${p.resource}:${p.action}`, row.id);
  }

  console.log('Syncing role permissions (grant + prune)...');
  for (const [code, grants] of Object.entries(GRANTS) as [RoleCode, { resource: string; action: string }[]][]) {
    const roleId = roleByCode.get(code)!;
    const grantedPermissionIds = new Set<string>();
    for (const g of grants) {
      const permissionId = permissionIdByKey.get(`${g.resource}:${g.action}`);
      if (!permissionId) throw new Error(`Grant references undeclared permission ${g.resource}:${g.action}`);
      grantedPermissionIds.add(permissionId);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
    // Prune: this seed is the single source of truth for the permission matrix (mirrored
    // in docs/security/RBAC_MATRIX.md) — a role-permission row that used to be granted
    // (e.g. Phase 02's original bootstrap grants to SYSTEM_ADMIN) but is no longer listed
    // in GRANTS above must not silently keep working. An earlier version of this seed was
    // purely additive (upsert-only) and left exactly this kind of stale grant in place —
    // caught by apps/api/test/rbac.e2e-spec.ts asserting SYSTEM_ADMIN cannot read Student
    // data and getting a 404/200 instead of the expected 403.
    await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: { notIn: Array.from(grantedPermissionIds) } },
    });
  }

  return roleByCode;
}

/// Phase 14 fix — this ran unconditionally (even when NODE_ENV=production) with a fixed,
/// committed-in-source password ('ChangeMe!123'), unlike every other credential in this
/// project (which are either NODE_ENV-gated dev fixtures or operator-supplied secrets).
/// A fresh production deployment's first seed run would otherwise create a publicly-known-
/// password SYSTEM_ADMIN account — a real, live production blocker, not a cosmetic one.
/// In production this now REQUIRES `BOOTSTRAP_ADMIN_PASSWORD` to be set (fails closed,
/// never falls back to the known default) and skips re-seeding the password on subsequent
/// runs (`update: {}` already did this — the account exists once, changing this env var
/// later does not silently reset a since-changed password).
async function seedBootstrapAdmin(roleByCode: Map<RoleCode, string>): Promise<void> {
  console.log('Seeding bootstrap System Admin user...');
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (isProduction && !bootstrapPassword) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be set when NODE_ENV=production — refusing to seed a System Admin with a known/default password.');
  }
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.local',
      fullName: 'System Bootstrap Admin',
      // Outside production only: a placeholder credential for local/dev bootstrap.
      passwordHash: hashPassword(bootstrapPassword ?? 'ChangeMe!123'),
      roleId: roleByCode.get('SYSTEM_ADMIN')!,
    },
  });
}

interface DemoUserSpec {
  username: string;
  email: string;
  fullName: string;
  role: RoleCode;
}

const DEMO_PASSWORD = 'DemoPass!123';

const DEMO_USERS: DemoUserSpec[] = [
  { username: 'demo.director', email: 'demo.director@example.local', fullName: 'Demo Executive Director', role: 'EXECUTIVE_DIRECTOR' },
  { username: 'demo.manager', email: 'demo.manager@example.local', fullName: 'Demo Department Manager', role: 'DEPARTMENT_MANAGER' },
  { username: 'demo.consultant.a', email: 'demo.consultant.a@example.local', fullName: 'Demo Consultant A (case member)', role: 'CONSULTANT' },
  { username: 'demo.consultant.b', email: 'demo.consultant.b@example.local', fullName: 'Demo Consultant B (not a member)', role: 'CONSULTANT' },
  { username: 'demo.docspecialist', email: 'demo.docspecialist@example.local', fullName: 'Demo Document Specialist', role: 'DOCUMENT_SPECIALIST' },
  { username: 'demo.sales', email: 'demo.sales@example.local', fullName: 'Demo Sales/Marketing (owns fixture lead)', role: 'SALES_MARKETING' },
  { username: 'demo.sales.b', email: 'demo.sales.b@example.local', fullName: 'Demo Sales/Marketing B (owns nothing)', role: 'SALES_MARKETING' },
  { username: 'demo.finance', email: 'demo.finance@example.local', fullName: 'Demo Admin/Finance', role: 'ADMIN_FINANCE' },
  { username: 'demo.student.self', email: 'demo.student.self@example.local', fullName: 'Demo Student (self)', role: 'STUDENT_PARENT' },
  { username: 'demo.parent.linked', email: 'demo.parent.linked@example.local', fullName: 'Demo Parent (linked)', role: 'STUDENT_PARENT' },
  { username: 'demo.parent.unlinked', email: 'demo.parent.unlinked@example.local', fullName: 'Demo Parent (unlinked)', role: 'STUDENT_PARENT' },
  { username: 'demo.parent.revoked', email: 'demo.parent.revoked@example.local', fullName: 'Demo Parent (revoked)', role: 'STUDENT_PARENT' },
];

/// Fixture graph exercised by apps/api/test/rbac.e2e-spec.ts: one Student+Case that
/// `demo.consultant.a` is a member of (CASE_MEMBER ALLOW) and `demo.consultant.b` is not
/// (CASE_MEMBER DENY); `demo.student.self` linked as the Student itself (OWN_STUDENT
/// ALLOW) and `demo.parent.linked` linked as its contact (OWN_STUDENT ALLOW via parent),
/// while `demo.parent.unlinked` has no link anywhere (OWN_STUDENT DENY). A second,
/// unrelated Student with no case exists purely as a DENY target for scoped roles.
async function seedRbacFixtures(roleByCode: Map<RoleCode, string>): Promise<void> {
  console.log('Seeding demo users (non-production only)...');
  const userIdByUsername = new Map<string, string>();
  for (const u of DEMO_USERS) {
    const row = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { username: u.username, email: u.email, fullName: u.fullName, passwordHash: hashPassword(DEMO_PASSWORD), roleId: roleByCode.get(u.role)! },
    });
    userIdByUsername.set(u.username, row.id);
  }

  console.log('Seeding RBAC fixture Student/Case graph...');
  const studentA = await prisma.student.upsert({
    where: { studentCode: 'HS-2026-90001' },
    update: { portalUserId: userIdByUsername.get('demo.student.self') },
    create: {
      studentCode: 'HS-2026-90001',
      fullName: 'RBAC Fixture Student A (in scope for Consultant A)',
      targetCountry: 'US',
      budget: 42000,
      budgetCurrency: 'USD',
      portalUserId: userIdByUsername.get('demo.student.self'),
    },
  });

  // Phase 11 — `portalUserId`'s Phase 03 `@unique` constraint was relaxed to a plain index
  // (`docs/DECISIONS.md` DEC-06), so this upsert now keys on the fixed fixture `id` instead
  // (the same pattern already used for every other Phase 08-10 fixture row) rather than on
  // `portalUserId`. `portalStatus: 'ACTIVE'` is required from Phase 11 onward — without it
  // `ScopePolicyService`'s OWN_STUDENT checks now correctly treat this link as not-yet-
  // active/revoked, matching real "quyền truy cập phải mất ngay theo policy" semantics.
  const linkedParentUserId = userIdByUsername.get('demo.parent.linked')!;
  await prisma.studentContact.upsert({
    where: { id: '00000000-0000-4000-8000-000000001020' },
    update: { studentId: studentA.id, portalUserId: linkedParentUserId, portalStatus: 'ACTIVE' },
    create: {
      id: '00000000-0000-4000-8000-000000001020',
      studentId: studentA.id,
      type: 'PARENT',
      name: 'Demo Linked Parent Contact',
      email: 'demo.parent.linked@example.local',
      portalUserId: linkedParentUserId,
      portalStatus: 'ACTIVE',
    },
  });

  const caseA = await prisma.case.upsert({
    where: { caseCode: 'CASE-2026-90001' },
    update: {},
    create: {
      caseCode: 'CASE-2026-90001',
      studentId: studentA.id,
      ownerId: userIdByUsername.get('demo.consultant.a')!,
      stage: 'CONTRACT_SIGNING',
      status: 'ACTIVE',
    },
  });

  await prisma.caseMember.upsert({
    where: { caseId_userId: { caseId: caseA.id, userId: userIdByUsername.get('demo.consultant.a')! } },
    update: {},
    create: { caseId: caseA.id, userId: userIdByUsername.get('demo.consultant.a')!, role: 'OWNER' },
  });
  // Also a member (as DOCUMENT_SPECIALIST) — lets rbac.e2e-spec.ts demonstrate Budget
  // field-level redaction on a role that can actually reach the record (DOCUMENT_SPECIALIST
  // is CASE_MEMBER-scoped, same as CONSULTANT — see docs/security/RBAC_MATRIX.md).
  await prisma.caseMember.upsert({
    where: { caseId_userId: { caseId: caseA.id, userId: userIdByUsername.get('demo.docspecialist')! } },
    update: {},
    create: { caseId: caseA.id, userId: userIdByUsername.get('demo.docspecialist')!, role: 'COLLABORATOR' },
  });

  await prisma.student.upsert({
    where: { studentCode: 'HS-2026-90002' },
    update: {},
    create: {
      studentCode: 'HS-2026-90002',
      fullName: 'RBAC Fixture Student B (no case, unlinked)',
      targetCountry: 'UK',
      budget: 15000,
      budgetCurrency: 'GBP',
    },
  });

  console.log('Seeding Task fixtures (Phase 06 RBAC scope)...');
  // TASK-2026-90001 is owned by `demo.consultant.a`, caseA's OWNER member — both the
  // "task owner" and "case owner" manage-paths coincide here, so a second task
  // (TASK-2026-90002) owned by `demo.docspecialist`, a mere COLLABORATOR, is the one that
  // actually distinguishes "manage your own task" from "manage as case owner" —
  // `demo.docspecialist` can manage TASK-2026-90002 (owns it) but not TASK-2026-90001 (not
  // its owner, not caseA's OWNER member).
  await prisma.task.upsert({
    where: { taskCode: 'TASK-2026-90001' },
    update: {},
    create: {
      taskCode: 'TASK-2026-90001',
      caseId: caseA.id,
      module: 'counseling',
      taskType: 'intake_review',
      title: 'RBAC Fixture Task A (owned by case owner)',
      ownerId: userIdByUsername.get('demo.consultant.a')!,
      deadline: new Date('2026-09-01T00:00:00Z'),
      status: 'NOT_STARTED',
    },
  });
  await prisma.task.upsert({
    where: { taskCode: 'TASK-2026-90002' },
    update: {},
    create: {
      taskCode: 'TASK-2026-90002',
      caseId: caseA.id,
      module: 'documents',
      taskType: 'checklist_prep',
      title: 'RBAC Fixture Task B (owned by a mere collaborator)',
      ownerId: userIdByUsername.get('demo.docspecialist')!,
      deadline: new Date('2026-03-01T00:00:00Z'),
      status: 'NOT_STARTED',
    },
  });

  console.log('Seeding Counseling fixtures (Phase 07 RBAC scope)...');
  // Approved directly in seed data (not via AssessmentsService's FSM — fixture data, not
  // a workflow exercise) so ALLOW/DENY + cross-case tests have a real target on caseA.
  const assessmentA = await prisma.assessment.upsert({
    where: { caseId_version: { caseId: caseA.id, version: 1 } },
    update: {},
    create: {
      caseId: caseA.id,
      version: 1,
      status: 'APPROVED',
      approvedById: userIdByUsername.get('demo.director'),
      approvedAt: new Date('2026-01-05T00:00:00Z'),
    },
  });
  await prisma.assessmentCriterion.upsert({
    where: { assessmentId_area: { assessmentId: assessmentA.id, area: 'Academic' } },
    update: {},
    create: { assessmentId: assessmentA.id, area: 'Academic', currentScore: 7.5, targetScore: 9, gap: 1.5, priority: 'HIGH', recommendation: 'Improve GPA through Grade 12.' },
  });

  await prisma.academicRecord.upsert({
    where: { id: '00000000-0000-4000-8000-00000000a001' },
    update: {},
    create: { id: '00000000-0000-4000-8000-00000000a001', caseId: caseA.id, school: 'RBAC Fixture High School', period: 'Grade 11, 2025-2026', gpa: 8.5, gradingScale: '10' },
  });
  await prisma.testRecord.upsert({
    where: { caseId_testType_attemptNumber: { caseId: caseA.id, testType: 'IELTS', attemptNumber: 1 } },
    update: {},
    create: { caseId: caseA.id, testType: 'IELTS', attemptNumber: 1, score: 6.5, target: 7.5 },
  });
  await prisma.competition.upsert({
    where: { id: '00000000-0000-4000-8000-00000000c001' },
    update: {},
    create: { id: '00000000-0000-4000-8000-00000000c001', caseId: caseA.id, competitionCode: 'COMP-2026-90001', eventName: 'RBAC Fixture Olympiad', year: 2025, result: 'Finalist' },
  });
  await prisma.researchProject.upsert({
    where: { id: '00000000-0000-4000-8000-00000000d001' },
    update: {},
    create: { id: '00000000-0000-4000-8000-00000000d001', caseId: caseA.id, researchCode: 'RES-2026-90001', title: 'RBAC Fixture Research Project', mentor: 'Dr. Fixture' },
  });
  await prisma.activity.upsert({
    where: { id: '00000000-0000-4000-8000-00000000e001' },
    update: {},
    create: { id: '00000000-0000-4000-8000-00000000e001', caseId: caseA.id, organization: 'RBAC Fixture Volunteer Club', role: 'Member', hours: 40 },
  });

  const writingArtifactA = await prisma.writingArtifact.upsert({
    where: { id: '00000000-0000-4000-8000-00000000f001' },
    update: {},
    create: { id: '00000000-0000-4000-8000-00000000f001', caseId: caseA.id, type: 'Essay', title: 'RBAC Fixture Essay', ownerId: userIdByUsername.get('demo.consultant.a')! },
  });
  await prisma.writingVersion.upsert({
    where: { artifactId_versionNumber: { artifactId: writingArtifactA.id, versionNumber: 1 } },
    update: {},
    create: { artifactId: writingArtifactA.id, versionNumber: 1, createdById: userIdByUsername.get('demo.consultant.a')!, content: 'Fixture essay draft content.' },
  });

  await prisma.letterOfRecommendation.upsert({
    where: { id: '00000000-0000-4000-8000-00000000b001' },
    update: {},
    create: { id: '00000000-0000-4000-8000-00000000b001', caseId: caseA.id, recommenderName: 'RBAC Fixture Teacher', relationship: 'Homeroom teacher', internalNotes: 'Staff-only fixture note.' },
  });

  console.log('Seeding Admission fixtures (Phase 08 RBAC scope)...');
  const universityA = await prisma.university.upsert({
    where: { universityCode: 'UNI-2026-90001' },
    update: {},
    create: { universityCode: 'UNI-2026-90001', officialName: 'RBAC Fixture University', countryCode: 'US', city: 'Boston', status: 'ACTIVE', source: 'seed fixture' },
  });
  const programA = await prisma.program.upsert({
    where: { programCode: 'PRG-2026-90001' },
    update: {},
    create: {
      programCode: 'PRG-2026-90001',
      universityId: universityA.id,
      degreeLevel: 'Bachelor',
      major: 'Computer Science',
      intake: 'Fall 2026',
      tuition: 45000,
      tuitionCurrency: 'USD',
      status: 'ACTIVE',
    },
  });
  const scholarshipMasterA = await prisma.scholarshipMaster.upsert({
    where: { scholarshipCode: 'SCHM-2026-90001' },
    update: {},
    create: {
      scholarshipCode: 'SCHM-2026-90001',
      provider: 'RBAC Fixture University',
      name: 'Fixture Merit Scholarship',
      universityId: universityA.id,
      programId: programA.id,
      amount: 10000,
      amountCurrency: 'USD',
      coverageType: 'Partial tuition',
      status: 'ACTIVE',
    },
  });

  await prisma.universityChoice.upsert({
    where: { studentId_programId: { studentId: studentA.id, programId: programA.id } },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000001004', studentId: studentA.id, caseId: caseA.id, programId: programA.id, tier: 'MATCH', rationale: 'Strong CS program, in-budget.' },
  });

  const applicationA = await prisma.application.upsert({
    where: { applicationCode: 'APP-2026-90001' },
    update: {},
    create: {
      applicationCode: 'APP-2026-90001',
      studentId: studentA.id,
      caseId: caseA.id,
      programId: programA.id,
      intendedIntake: 'Fall 2026',
      status: 'SUBMITTED',
      submittedAt: new Date('2026-02-01T00:00:00Z'),
      submissionChannel: 'university_portal',
    },
  });
  await prisma.applicationChecklist.upsert({
    where: { id: '00000000-0000-4000-8000-000000001006' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000001006', applicationId: applicationA.id, title: 'Transcript', required: true, status: 'DONE', completedAt: new Date('2026-01-25T00:00:00Z') },
  });
  await prisma.offer.upsert({
    where: { id: '00000000-0000-4000-8000-000000001007' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001007',
      applicationId: applicationA.id,
      offerType: 'Unconditional',
      offerDate: new Date('2026-03-01T00:00:00Z'),
      acceptanceDeadline: new Date('2026-05-01T00:00:00Z'),
      status: 'RECEIVED',
    },
  });

  await prisma.scholarshipApplication.upsert({
    where: { scholarshipApplicationCode: 'SCH-2026-90001' },
    update: {},
    create: {
      scholarshipApplicationCode: 'SCH-2026-90001',
      studentId: studentA.id,
      caseId: caseA.id,
      scholarshipMasterId: scholarshipMasterA.id,
      applicationId: applicationA.id,
      status: 'UNDER_REVIEW',
      eligibilityConfirmed: true,
      internalNotes: 'Staff-only scholarship strategy note.',
    },
  });

  console.log('Seeding Visa fixtures (Phase 09 RBAC scope)...');
  // A second Offer fixture (ACCEPTED) — the shared `offerA` (...1007) is RECEIVED and
  // already exercised by Phase 08's own tests; Enrollment requires an ACCEPTED target, so
  // this is a new row rather than mutating an already-PASSed fixture.
  const offerB = await prisma.offer.upsert({
    where: { id: '00000000-0000-4000-8000-000000001008' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001008',
      applicationId: applicationA.id,
      offerType: 'Unconditional',
      offerDate: new Date('2026-03-05T00:00:00Z'),
      status: 'ACCEPTED',
      respondedAt: new Date('2026-03-10T00:00:00Z'),
    },
  });

  await prisma.visaChecklistTemplate.upsert({
    where: { countryCode_visaType_title: { countryCode: 'US', visaType: 'F-1', title: 'Passport copy' } },
    update: {},
    create: { countryCode: 'US', visaType: 'F-1', title: 'Passport copy', required: true, sortOrder: 1 },
  });

  const visaA = await prisma.visa.upsert({
    where: { id: '00000000-0000-4000-8000-000000001009' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001009',
      visaCode: 'VISA-2026-90001',
      studentId: studentA.id,
      caseId: caseA.id,
      offerId: offerB.id,
      countryCode: 'US',
      visaType: 'F-1',
      status: 'SUBMITTED',
      submittedAt: new Date('2026-04-01T00:00:00Z'),
      internalNotes: 'Staff-only visa strategy note.',
    },
  });
  await prisma.visaChecklistItem.upsert({
    where: { id: '00000000-0000-4000-8000-000000001010' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000001010', entityType: 'Visa', entityId: visaA.id, title: 'Passport copy', required: true, status: 'DONE', completedAt: new Date('2026-03-28T00:00:00Z') },
  });
  await prisma.visaChecklistItem.upsert({
    where: { id: '00000000-0000-4000-8000-000000001011' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000001011', entityType: 'PreDeparture', entityId: caseA.id, title: 'Confirm flight booking', category: 'flight', required: true, status: 'PENDING' },
  });

  await prisma.enrollment.upsert({
    where: { id: '00000000-0000-4000-8000-000000001012' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001012',
      studentId: studentA.id,
      caseId: caseA.id,
      offerId: offerB.id,
      universityId: universityA.id,
      programId: programA.id,
      status: 'CONFIRMED',
      confirmationDate: new Date('2026-04-15T00:00:00Z'),
      internalNotes: 'Staff-only enrollment note.',
    },
  });

  console.log('Seeding Contract/Payment fixtures (Phase 05 RBAC scope)...');
  // Signed directly in seed data (not via ContractsService's FSM — this is fixture data,
  // not a workflow exercise) so ALLOW/DENY tests have a real target: `demo.finance` /
  // `demo.director` / `demo.manager` (GLOBAL ALLOW), `demo.student.self` /
  // `demo.parent.linked` (OWN_STUDENT ALLOW via studentA), `demo.consultant.a` (NONE DENY
  // despite being caseA's OWNER member — proves Contract/Payment scope is genuinely
  // separate from Case scope, not derived from it), `demo.parent.unlinked` (OWN_STUDENT
  // DENY — no link at all).
  const contractA = await prisma.contract.upsert({
    where: { contractCode: 'HD-2026-90001' },
    update: { studentId: studentA.id },
    create: {
      contractCode: 'HD-2026-90001',
      studentId: studentA.id,
      servicePackage: 'Full-service US undergraduate',
      value: 8000,
      currency: 'USD',
      status: 'SIGNED',
      version: 1,
      approvalThreshold: 5000,
      submittedAt: new Date('2026-01-05T00:00:00Z'),
      approvedById: userIdByUsername.get('demo.director'),
      approvedAt: new Date('2026-01-06T00:00:00Z'),
      sentAt: new Date('2026-01-07T00:00:00Z'),
      signedAt: new Date('2026-01-08T00:00:00Z'),
      signedDocumentId: 'seed-fixture-signed-doc-90001',
    },
  });

  await prisma.case.update({ where: { id: caseA.id }, data: { contractId: contractA.id } });

  await prisma.payment.upsert({
    where: { contractId_installmentNo: { contractId: contractA.id, installmentNo: 1 } },
    update: {},
    create: {
      paymentCode: 'PAY-2026-90001',
      contractId: contractA.id,
      installmentNo: 1,
      amount: 4000,
      currency: 'USD',
      dueDate: new Date('2026-02-01T00:00:00Z'),
      paidAmount: 4000,
      paidDate: new Date('2026-01-30T00:00:00Z'),
      method: 'bank_transfer',
      reference: 'SEED-FIXTURE-REF-90001',
      status: 'PAID',
    },
  });

  // Deliberately past-due and still PENDING — exercises `PaymentsService.isOverdue` /
  // the lazy OVERDUE-status sweep without relying on test-run-time date math in the seed.
  await prisma.payment.upsert({
    where: { contractId_installmentNo: { contractId: contractA.id, installmentNo: 2 } },
    update: {},
    create: {
      paymentCode: 'PAY-2026-90002',
      contractId: contractA.id,
      installmentNo: 2,
      amount: 4000,
      currency: 'USD',
      dueDate: new Date('2026-03-01T00:00:00Z'),
      status: 'PENDING',
    },
  });

  console.log('Seeding Partner/Commission fixtures (Phase 10 RBAC scope)...');
  // Placed after Contract/Payment so commissionRuleA/commissionTransactionA can reference
  // the real contractA (SIGNED, value 8000 USD) as a CONTRACT_VALUE-basis source —
  // "dùng existing Payment/Contract source of truth", never a duplicated amount.
  const partnerA = await prisma.partner.upsert({
    where: { id: '00000000-0000-4000-8000-000000001013' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001013',
      partnerCode: 'PT-US-90001',
      name: 'RBAC Fixture Partner',
      type: 'AGENCY',
      countryCode: 'US',
      contactName: 'Fixture Contact',
      contactEmail: 'partner.fixture@example.local',
      internalNotes: 'Staff-only partner relationship note.',
    },
  });

  const partnerProgramA = await prisma.partnerProgram.upsert({
    where: { id: '00000000-0000-4000-8000-000000001014' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001014',
      partnerProgramCode: 'PP-US-90001-01',
      partnerId: partnerA.id,
      programId: programA.id,
      name: 'Fixture Partner Program',
      degreeLevel: "Bachelor's",
      major: 'Computer Science',
    },
  });

  const partnerDocumentFile = await prisma.document.upsert({
    where: { id: '00000000-0000-4000-8000-000000001015' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001015',
      documentCode: 'DOC-2026-90002',
      ownerEntity: 'Partner',
      ownerId: partnerA.id,
      documentType: 'MOU',
      title: 'Fixture Partner MOU',
      fileReference: 'seed-fixture-partner-mou-90001',
      status: 'FINAL',
      uploadedById: userIdByUsername.get('demo.director')!,
    },
  });
  await prisma.partnerDocument.upsert({
    where: { id: '00000000-0000-4000-8000-000000001016' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001016',
      partnerId: partnerA.id,
      type: 'MOU',
      version: 1,
      status: 'ACTIVE',
      effectiveDate: new Date('2026-01-01T00:00:00Z'),
      expiryDate: new Date('2027-01-01T00:00:00Z'),
      documentId: partnerDocumentFile.id,
    },
  });

  await prisma.partnerStudentLink.upsert({
    where: { id: '00000000-0000-4000-8000-000000001017' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001017',
      partnerId: partnerA.id,
      studentId: studentA.id,
      caseId: caseA.id,
      linkType: 'Referral',
      status: 'ACTIVE',
      effectiveDate: new Date('2026-01-01T00:00:00Z'),
      notes: 'Fixture referral link.',
      createdById: userIdByUsername.get('demo.director'),
    },
  });

  const commissionRuleA = await prisma.commissionRule.upsert({
    where: { id: '00000000-0000-4000-8000-000000001018' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001018',
      partnerId: partnerA.id,
      partnerProgramId: partnerProgramA.id,
      basis: 'CONTRACT_VALUE',
      percentageRate: 0.1,
      currency: 'USD',
      priority: 1,
      effectiveDate: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.commissionTransaction.upsert({
    where: { id: '00000000-0000-4000-8000-000000001019' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001019',
      partnerId: partnerA.id,
      commissionRuleId: commissionRuleA.id,
      studentId: studentA.id,
      caseId: caseA.id,
      sourceType: 'Contract',
      sourceId: contractA.id,
      basis: 'CONTRACT_VALUE',
      currency: 'USD',
      status: 'PENDING',
    },
  });

  console.log('Seeding Portal fixtures (Phase 11 RBAC scope)...');
  // A third Task, `visibleToStudent: true` — TASK-2026-90001/90002 (above) stay
  // staff-internal (the default), so Portal's own "only explicitly shared tasks" filter
  // has both a genuine ALLOW and a genuine DENY target on the SAME case.
  await prisma.task.upsert({
    where: { taskCode: 'TASK-2026-90003' },
    update: {},
    create: {
      taskCode: 'TASK-2026-90003',
      caseId: caseA.id,
      module: 'documents',
      taskType: 'student_action',
      title: 'RBAC Fixture Task C (shared with student)',
      ownerId: userIdByUsername.get('demo.consultant.a')!,
      deadline: new Date('2026-09-15T00:00:00Z'),
      status: 'NOT_STARTED',
      visibleToStudent: true,
    },
  });

  // An INVITED-but-not-yet-accepted contact (with a live ParentInvitation) — an ALLOW
  // target for the accept-invitation flow itself, and a DENY target for every OWN_STUDENT
  // scope check (portalStatus is INVITED, not ACTIVE — no access yet).
  const invitedContact = await prisma.studentContact.upsert({
    where: { id: '00000000-0000-4000-8000-000000001021' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001021',
      studentId: studentA.id,
      type: 'PARENT',
      name: 'Demo Invited Parent Contact',
      email: 'demo.parent.invited@example.local',
      portalStatus: 'INVITED',
    },
  });
  await prisma.parentInvitation.upsert({
    where: { id: '00000000-0000-4000-8000-000000001022' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001022',
      studentContactId: invitedContact.id,
      tokenHash: hashToken('seed-fixture-invite-token-90001'),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      invitedById: userIdByUsername.get('demo.director')!,
    },
  });

  // A REVOKED contact — a real DEC-06/ASM-46 DENY target: this parent DID once have
  // portalUserId set (so a naive "portalUserId is not null" check would wrongly still
  // allow them), but `portalStatus = REVOKED` must close it off.
  const revokedParentUserId = userIdByUsername.get('demo.parent.revoked')!;
  await prisma.studentContact.upsert({
    where: { id: '00000000-0000-4000-8000-000000001023' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000001023',
      studentId: studentA.id,
      type: 'PARENT',
      name: 'Demo Revoked Parent Contact',
      email: 'demo.parent.revoked@example.local',
      portalUserId: revokedParentUserId,
      portalStatus: 'REVOKED',
      revokedAt: new Date('2026-06-01T00:00:00Z'),
      revokedById: userIdByUsername.get('demo.director')!,
    },
  });

  console.log('Seeding Lead fixtures (OWN_LEAD scope)...');
  // `demo.sales` owns this lead (OWN_LEAD ALLOW target); `demo.sales.b` owns nothing
  // (OWN_LEAD DENY — see apps/api/test/rbac.e2e-spec.ts). CONTRACTING status so
  // apps/api/test/lead-conversion.e2e-spec.ts can exercise convert() directly without
  // first walking the full status ladder.
  await prisma.lead.upsert({
    where: { leadCode: 'LEAD-2026-90001' },
    update: {},
    create: {
      leadCode: 'LEAD-2026-90001',
      contactName: 'RBAC Fixture Lead (owned by demo.sales)',
      email: 'lead.fixture@example.local',
      phone: '+10000000001',
      countryInterest: 'US',
      ownerId: userIdByUsername.get('demo.sales')!,
      status: 'CONTRACTING',
    },
  });
}

async function main() {
  const roleByCode = await seedRolesAndPermissions();
  await seedBootstrapAdmin(roleByCode);

  if (isProduction) {
    console.log('NODE_ENV=production — skipping demo users and RBAC test fixtures.');
  } else {
    await seedRbacFixtures(roleByCode);
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
