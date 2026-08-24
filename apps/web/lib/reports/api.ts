import { apiFetch } from "../api/client";
import type { ExecutiveDashboard, ExportCasesResponse, ManagerDashboard, MyDashboard } from "./types";

/// Typed calls against `apps/api/src/modules/reporting/reports/reports.controller.ts`. Every
/// route requires `reports:view` (export additionally requires `reports:export`) — enforced
/// server-side regardless of what the frontend gates (F07 instruction §21: "Backend is
/// source of truth").

export function getExecutiveDashboard(): Promise<ExecutiveDashboard> {
  return apiFetch<ExecutiveDashboard>("/reports/executive");
}

export function getManagerDashboard(): Promise<ManagerDashboard> {
  return apiFetch<ManagerDashboard>("/reports/manager");
}

export function getMyDashboard(): Promise<MyDashboard> {
  return apiFetch<MyDashboard>("/reports/me");
}

/// `reason` is required server-side (`ExportReportQueryDto`, 3-500 chars) and is audited
/// (`@Audit('EXPORT')`) — never optional here either. Synchronous: the response IS the data,
/// there is no separate "check export status" call.
export function exportCases(reason: string): Promise<ExportCasesResponse> {
  return apiFetch<ExportCasesResponse>("/reports/cases/export", { query: { reason } });
}
