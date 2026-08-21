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
};
