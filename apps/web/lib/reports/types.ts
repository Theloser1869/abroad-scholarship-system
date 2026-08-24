/// Mirrors `ReportsService`'s actual return shapes (`apps/api/src/modules/reporting/reports/
/// reports.service.ts`) exactly — every field here is computed server-side from the real
/// source-of-truth tables at query time; the frontend only formats/displays, never
/// recalculates (F07 instruction §21/§30: "Do not calculate dashboard KPI independently in
/// frontend").

export interface StatusCount {
  status: string;
  count: number;
}

/// Revenue/receivables are grouped BY currency, never summed across currencies (DEC — Phase
/// 14 fix cited directly in `reports.service.ts`: "Payment/Contract carry a per-record
/// currency... summing raw numeric amounts across currencies... produced a meaningless
/// number"). Rendered via the shared `Money` component per row, never added together here.
export interface CurrencyAmount {
  currency: string;
  amount: string;
}

/// EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only (`ReportsService.assertRole`) — both roles see
/// the SAME executive dashboard (no ED-only vs DM-only split on the backend).
export interface ExecutiveDashboard {
  activeCases: number;
  pipeline: StatusCount[];
  revenue: CurrencyAmount[];
  receivables: CurrencyAmount[];
  overduePaymentsCount: number;
  workload: { openTasks: number; overdueTasks: number };
  deadlines: { overdueTasks: number; dueWithin7Days: number };
  applications: StatusCount[];
  scholarships: StatusCount[];
  visas: StatusCount[];
  enrollments: StatusCount[];
  closedOrArchivedCases: number;
}

/// `ownerId` is a raw user id — `ReportsService.managerDashboard` does not join `User` for a
/// display name (only `groupBy`-style aggregation), and this page does not call a second
/// endpoint to resolve one (F07 instruction §26: "If backend returns a redacted/missing
/// field, do not call another endpoint to reconstruct it" — applied here even though the gap
/// is an absent join rather than redaction, same principle). Documented as an ASSUMPTION.
export interface ManagerWorkloadRow {
  ownerId: string;
  openTasks: number;
  overdueTasks: number;
  onTimeCompletionRate: number | null;
  averageQualityScore: number | null;
}

export interface ManagerDashboard {
  workload: ManagerWorkloadRow[];
  upcomingApplicationDeadlines: number;
}

/// Every staff role's own self-scoped summary (`reports:view` is enough — no leadership-only
/// role check on this one).
export interface MyDashboard {
  myOpenCases: number;
  myOpenTasks: number;
  myOverdueTasks: number;
}

/// `GET /reports/cases/export` is fully synchronous (`ReportsService.exportCases` returns
/// directly, no job/queue/status polling exists) — mirrors the exact scalar shape of
/// `prisma.case.findMany` with no `include` (`database/schema.prisma` `Case` model), the same
/// scope-filtered rows the caller could already read one-by-one via `GET /cases`.
export interface ExportedCaseRow {
  id: string;
  caseCode: string;
  studentId: string;
  contractId: string | null;
  ownerId: string;
  department: string | null;
  stage: string;
  status: string;
  closureReason: string | null;
  openedAt: string;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportCasesResponse {
  rows: ExportedCaseRow[];
  rowCount: number;
}
