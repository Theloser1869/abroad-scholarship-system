/// Centralized query-key factory (F03 instruction §24 — "invalidate đúng query, không
/// invalidate toàn bộ app"). Every domain hook builds its keys from here so a mutation can
/// invalidate exactly the list/detail queries it affects, never a blanket
/// `queryClient.invalidateQueries()` with no key at all.
export const queryKeys = {
  leads: {
    all: ["leads"] as const,
    lists: () => [...queryKeys.leads.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.leads.lists(), params] as const,
    detail: (id: string) => [...queryKeys.leads.all, "detail", id] as const,
    timeline: (id: string) => [...queryKeys.leads.all, "timeline", id] as const,
  },
  students: {
    all: ["students"] as const,
    lists: () => [...queryKeys.students.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.students.lists(), params] as const,
    detail: (id: string) => [...queryKeys.students.all, "detail", id] as const,
    timeline: (id: string) => [...queryKeys.students.all, "timeline", id] as const,
    contacts: (id: string) => [...queryKeys.students.all, "contacts", id] as const,
  },
  cases: {
    all: ["cases"] as const,
    lists: () => [...queryKeys.cases.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.cases.lists(), params] as const,
    detail: (id: string) => [...queryKeys.cases.all, "detail", id] as const,
    timeline: (id: string) => [...queryKeys.cases.all, "timeline", id] as const,
    members: (id: string) => [...queryKeys.cases.all, "members", id] as const,
  },
  /// Client Acceptance Remediation DEC-06/07/08 (GAP-007) — the unified Closure/Liquidation
  /// workflow, `/cases/:id/closure` (see `lib/closure/api.ts`).
  closure: {
    all: ["closure"] as const,
    detail: (caseId: string) => [...queryKeys.closure.all, caseId] as const,
  },
  contracts: {
    all: ["contracts"] as const,
    lists: () => [...queryKeys.contracts.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.contracts.lists(), params] as const,
    detail: (id: string) => [...queryKeys.contracts.all, "detail", id] as const,
    amendments: (id: string) => [...queryKeys.contracts.all, "amendments", id] as const,
  },
  payments: {
    all: ["payments"] as const,
    /// Payments have no bare list — always scoped to a parent Contract
    /// (docs/frontend/FRONTEND_ROUTES.md "Payments" note).
    listForContract: (contractId: string, params: Record<string, unknown>) =>
      [...queryKeys.payments.all, "list", contractId, params] as const,
    detail: (id: string) => [...queryKeys.payments.all, "detail", id] as const,
  },
  assessments: {
    all: ["assessments"] as const,
    listForCase: (caseId: string) => [...queryKeys.assessments.all, "list", caseId] as const,
    detail: (id: string) => [...queryKeys.assessments.all, "detail", id] as const,
  },
  roadmaps: {
    all: ["roadmaps"] as const,
    listForCase: (caseId: string) => [...queryKeys.roadmaps.all, "list", caseId] as const,
    detail: (id: string) => [...queryKeys.roadmaps.all, "detail", id] as const,
    milestones: (roadmapId: string) => [...queryKeys.roadmaps.all, "milestones", roadmapId] as const,
    milestoneDetail: (id: string) => [...queryKeys.roadmaps.all, "milestone-detail", id] as const,
  },
  profileEvidence: {
    all: ["profile-evidence"] as const,
    /// One key namespace per sub-type (academic/test/competition/research/activity), each
    /// still scoped under `profileEvidence` since all five share the one `profile_evidence`
    /// backend permission resource (docs/frontend/FRONTEND_PERMISSION_MAP.md).
    listForCase: (kind: string, caseId: string) => [...queryKeys.profileEvidence.all, kind, "list", caseId] as const,
    detail: (kind: string, id: string) => [...queryKeys.profileEvidence.all, kind, "detail", id] as const,
  },
  writingArtifacts: {
    all: ["writing-artifacts"] as const,
    listForCase: (caseId: string) => [...queryKeys.writingArtifacts.all, "list", caseId] as const,
    detail: (id: string) => [...queryKeys.writingArtifacts.all, "detail", id] as const,
    versionComments: (versionId: string) => [...queryKeys.writingArtifacts.all, "version-comments", versionId] as const,
  },
  universities: {
    all: ["universities"] as const,
    lists: () => [...queryKeys.universities.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.universities.lists(), params] as const,
    detail: (id: string) => [...queryKeys.universities.all, "detail", id] as const,
  },
  programs: {
    all: ["programs"] as const,
    lists: () => [...queryKeys.programs.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.programs.lists(), params] as const,
    detail: (id: string) => [...queryKeys.programs.all, "detail", id] as const,
  },
  scholarshipMasters: {
    all: ["scholarship-masters"] as const,
    lists: () => [...queryKeys.scholarshipMasters.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.scholarshipMasters.lists(), params] as const,
    detail: (id: string) => [...queryKeys.scholarshipMasters.all, "detail", id] as const,
  },
  /// `/students/:studentId/university-choices` — student-scoped, NOT case-scoped (F01's
  /// real route map; the F05 mega-prompt's "Case ID là source of scope" assumption does not
  /// match the live backend, `caseId` is only an optional linkage field on the record).
  universityChoices: {
    all: ["university-choices"] as const,
    listForStudent: (studentId: string) => [...queryKeys.universityChoices.all, "list", studentId] as const,
    detail: (id: string) => [...queryKeys.universityChoices.all, "detail", id] as const,
  },
  applications: {
    all: ["applications"] as const,
    listForCase: (caseId: string, params: Record<string, unknown>) => [...queryKeys.applications.all, "list", caseId, params] as const,
    detail: (id: string) => [...queryKeys.applications.all, "detail", id] as const,
    checklist: (applicationId: string) => [...queryKeys.applications.all, "checklist", applicationId] as const,
  },
  offers: {
    all: ["offers"] as const,
    listForApplication: (applicationId: string) => [...queryKeys.offers.all, "list", applicationId] as const,
    current: (applicationId: string) => [...queryKeys.offers.all, "current", applicationId] as const,
    detail: (id: string) => [...queryKeys.offers.all, "detail", id] as const,
  },
  scholarshipApplications: {
    all: ["scholarship-applications"] as const,
    listForCase: (caseId: string) => [...queryKeys.scholarshipApplications.all, "list", caseId] as const,
    detail: (id: string) => [...queryKeys.scholarshipApplications.all, "detail", id] as const,
  },
  visas: {
    all: ["visas"] as const,
    listForCase: (caseId: string, params: Record<string, unknown>) => [...queryKeys.visas.all, "list", caseId, params] as const,
    detail: (id: string) => [...queryKeys.visas.all, "detail", id] as const,
    checklist: (visaId: string) => [...queryKeys.visas.all, "checklist", visaId] as const,
  },
  visaChecklistTemplates: {
    all: ["visa-checklist-templates"] as const,
    lists: () => [...queryKeys.visaChecklistTemplates.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.visaChecklistTemplates.lists(), params] as const,
    detail: (id: string) => [...queryKeys.visaChecklistTemplates.all, "detail", id] as const,
  },
  /// `entityType: 'PreDeparture'`, `entityId: caseId` — the same `VisaChecklistItem` model
  /// as `visas.checklist`, kept in its own namespace since it's reached via its own
  /// `/cases/:caseId/pre-departure` route (F01's route map), never merged with Visa's cache.
  preDeparture: {
    all: ["pre-departure"] as const,
    listForCase: (caseId: string) => [...queryKeys.preDeparture.all, "list", caseId] as const,
  },
  enrollments: {
    all: ["enrollments"] as const,
    listForCase: (caseId: string) => [...queryKeys.enrollments.all, "list", caseId] as const,
    detail: (id: string) => [...queryKeys.enrollments.all, "detail", id] as const,
  },
  partners: {
    all: ["partners"] as const,
    lists: () => [...queryKeys.partners.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.partners.lists(), params] as const,
    detail: (id: string) => [...queryKeys.partners.all, "detail", id] as const,
  },
  partnerPrograms: {
    all: ["partner-programs"] as const,
    listForPartner: (partnerId: string, params: Record<string, unknown>) => [...queryKeys.partnerPrograms.all, "list", partnerId, params] as const,
    detail: (id: string) => [...queryKeys.partnerPrograms.all, "detail", id] as const,
  },
  partnerDocuments: {
    all: ["partner-documents"] as const,
    listForPartner: (partnerId: string, params: Record<string, unknown>) => [...queryKeys.partnerDocuments.all, "list", partnerId, params] as const,
    detail: (id: string) => [...queryKeys.partnerDocuments.all, "detail", id] as const,
  },
  partnerStudentLinks: {
    all: ["partner-student-links"] as const,
    listForPartner: (partnerId: string, params: Record<string, unknown>) => [...queryKeys.partnerStudentLinks.all, "list-partner", partnerId, params] as const,
    listForStudent: (studentId: string, params: Record<string, unknown>) => [...queryKeys.partnerStudentLinks.all, "list-student", studentId, params] as const,
    detail: (id: string) => [...queryKeys.partnerStudentLinks.all, "detail", id] as const,
  },
  commissionRules: {
    all: ["commission-rules"] as const,
    listForPartner: (partnerId: string, params: Record<string, unknown>) => [...queryKeys.commissionRules.all, "list", partnerId, params] as const,
    detail: (id: string) => [...queryKeys.commissionRules.all, "detail", id] as const,
  },
  commissionTransactions: {
    all: ["commission-transactions"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.commissionTransactions.all, "list", params] as const,
    listForPartner: (partnerId: string, params: Record<string, unknown>) => [...queryKeys.commissionTransactions.all, "list-partner", partnerId, params] as const,
    detail: (id: string) => [...queryKeys.commissionTransactions.all, "detail", id] as const,
  },
  /// No bare list on the backend (`DocumentsController` has no `GET /`) — a Document is
  /// always reached by a known ID, either from an owning record's evidence field or a
  /// manual lookup (docs/frontend/FRONTEND_ROUTES.md "Documents"). Only a `detail` key exists.
  documents: {
    all: ["documents"] as const,
    detail: (id: string) => [...queryKeys.documents.all, "detail", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.notifications.all, "list", params] as const,
    unreadCount: () => [...queryKeys.notifications.all, "unread-count"] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.auditLogs.all, "list", params] as const,
  },
  reports: {
    all: ["reports"] as const,
    executive: () => [...queryKeys.reports.all, "executive"] as const,
    manager: () => [...queryKeys.reports.all, "manager"] as const,
    me: () => [...queryKeys.reports.all, "me"] as const,
  },
  /// F08 instruction §31/§32 — CRITICAL for multi-child parent privacy: every key below
  /// embeds `studentId` right after `"student"`, never `["portal", "roadmap"]`-style. A
  /// parent switching Child A → Child B changes the studentId segment, which TanStack Query
  /// treats as a completely different cache entry — there is structurally no way for Child
  /// B's page to read Child A's stale cached data, and no manual "clear on switch" step is
  /// needed (a differently-keyed query has nothing to clear). `me` (no studentId — resolves
  /// the caller's own accessible student list) is the one exception, by design.
  portal: {
    me: () => ["portal", "me"] as const,
    student: {
      all: (studentId: string) => ["portal", "student", studentId] as const,
      profile: (studentId: string) => [...queryKeys.portal.student.all(studentId), "profile"] as const,
      roadmap: (studentId: string) => [...queryKeys.portal.student.all(studentId), "roadmap"] as const,
      tasks: (studentId: string, params: Record<string, unknown>) =>
        [...queryKeys.portal.student.all(studentId), "tasks", params] as const,
      taskDetail: (studentId: string, taskId: string) =>
        [...queryKeys.portal.student.all(studentId), "tasks", "detail", taskId] as const,
      documents: (studentId: string) => [...queryKeys.portal.student.all(studentId), "documents"] as const,
      applications: (studentId: string, params: Record<string, unknown>) =>
        [...queryKeys.portal.student.all(studentId), "applications", params] as const,
      applicationDetail: (studentId: string, applicationId: string) =>
        [...queryKeys.portal.student.all(studentId), "applications", "detail", applicationId] as const,
      scholarships: (studentId: string) => [...queryKeys.portal.student.all(studentId), "scholarships"] as const,
      scholarshipDetail: (studentId: string, id: string) =>
        [...queryKeys.portal.student.all(studentId), "scholarships", "detail", id] as const,
      visas: (studentId: string, params: Record<string, unknown>) =>
        [...queryKeys.portal.student.all(studentId), "visa", params] as const,
      visaDetail: (studentId: string, visaId: string) =>
        [...queryKeys.portal.student.all(studentId), "visa", "detail", visaId] as const,
      preDeparture: (studentId: string) => [...queryKeys.portal.student.all(studentId), "pre-departure"] as const,
      enrollment: (studentId: string) => [...queryKeys.portal.student.all(studentId), "enrollment"] as const,
      contracts: (studentId: string, params: Record<string, unknown>) =>
        [...queryKeys.portal.student.all(studentId), "contracts", params] as const,
      payments: (studentId: string, contractId: string, params: Record<string, unknown>) =>
        [...queryKeys.portal.student.all(studentId), "contracts", contractId, "payments", params] as const,
      notifications: (studentId: string, params: Record<string, unknown>) =>
        [...queryKeys.portal.student.all(studentId), "notifications", params] as const,
      closure: (studentId: string) => [...queryKeys.portal.student.all(studentId), "closure"] as const,
    },
  },
};
