import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CommissionRule, CommissionRuleListParams, CreateCommissionRuleInput, UpdateCommissionRuleInput } from "./types";

/// Typed calls against `CommissionRulesNestedController`/`CommissionRulesController`.

export function listCommissionRules(partnerId: string, params: CommissionRuleListParams): Promise<PaginatedResponse<CommissionRule>> {
  return apiFetch<PaginatedResponse<CommissionRule>>(`/partners/${partnerId}/commission-rules`, { query: params });
}

export function getCommissionRule(id: string): Promise<CommissionRule> {
  return apiFetch<CommissionRule>(`/commission-rules/${id}`);
}

/// The backend cross-validates `basis` against `percentageRate`/`fixedAmount`
/// (`400 FIXED_AMOUNT_REQUIRED`/`PERCENTAGE_RATE_REQUIRED`/etc.) — never pre-validated
/// beyond basic UX guidance client-side.
export function createCommissionRule(partnerId: string, input: CreateCommissionRuleInput): Promise<CommissionRule> {
  return apiFetch<CommissionRule>(`/partners/${partnerId}/commission-rules`, { method: "POST", body: input });
}

export function updateCommissionRule(id: string, input: UpdateCommissionRuleInput): Promise<CommissionRule> {
  return apiFetch<CommissionRule>(`/commission-rules/${id}`, { method: "PATCH", body: input });
}

export function activateCommissionRule(id: string): Promise<CommissionRule> {
  return apiFetch<CommissionRule>(`/commission-rules/${id}/activate`, { method: "POST" });
}

export function deactivateCommissionRule(id: string): Promise<CommissionRule> {
  return apiFetch<CommissionRule>(`/commission-rules/${id}/deactivate`, { method: "POST" });
}
