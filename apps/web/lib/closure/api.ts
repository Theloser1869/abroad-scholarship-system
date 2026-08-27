import { apiFetch } from "../api/client";
import type { Case } from "../cases/types";
import type { ClosureStatus, ConfirmHandoverInput, ExecuteClosureInput, RequestClosureInput } from "./types";

/// Typed calls against `apps/api/src/modules/case-management/closure/closure.controller.ts`
/// — the unified Closure/Liquidation workflow (Client Acceptance Remediation DEC-06/07/08,
/// GAP-007) that replaced the old `PATCH /cases/:id/close` and the COMPLETED/LIQUIDATED
/// targets of `PATCH /contracts/:id/status`.

export function getClosureStatus(caseId: string): Promise<ClosureStatus> {
  return apiFetch<ClosureStatus>(`/cases/${caseId}/closure`);
}

export function requestClosure(caseId: string, input: RequestClosureInput): Promise<{ requested: boolean }> {
  return apiFetch<{ requested: boolean }>(`/cases/${caseId}/closure/request`, { method: "POST", body: input });
}

export function confirmHandover(caseId: string, input: ConfirmHandoverInput): Promise<{ confirmed: boolean }> {
  return apiFetch<{ confirmed: boolean }>(`/cases/${caseId}/closure/handover`, { method: "POST", body: input });
}

/// Backend re-validates the full DEC-07 checklist server-side — never pre-checked here; a
/// failing precondition comes back as a specific 409, surfaced verbatim to the caller.
export function executeClosure(caseId: string, input: ExecuteClosureInput): Promise<Case> {
  return apiFetch<Case>(`/cases/${caseId}/closure/close`, { method: "POST", body: input });
}

export function confirmLiquidationCompany(caseId: string, overrideReason?: string) {
  return apiFetch(`/cases/${caseId}/closure/liquidation/confirm-company`, {
    method: "POST",
    body: overrideReason ? { overrideReason } : {},
  });
}
