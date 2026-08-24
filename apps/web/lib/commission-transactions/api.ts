import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type {
  CancelCommissionTransactionInput,
  CommissionTransaction,
  CommissionTransactionListParams,
  CreateCommissionTransactionInput,
  PayCommissionTransactionInput,
  UpdateCommissionTransactionLinkageInput,
} from "./types";

/// Typed calls against `CommissionTransactionsNestedController`/`CommissionTransactionsController`.
/// Every action is its own dedicated endpoint — never a bare status PATCH (F06 instruction
/// §23). `calculate` performs the authoritative Decimal computation server-side only
/// (F06 instruction §24) — the frontend never derives `calculatedAmount` itself.

export function listCommissionTransactions(params: CommissionTransactionListParams): Promise<PaginatedResponse<CommissionTransaction>> {
  return apiFetch<PaginatedResponse<CommissionTransaction>>("/commission-transactions", { query: params });
}

export function listCommissionTransactionsForPartner(partnerId: string, params: CommissionTransactionListParams): Promise<PaginatedResponse<CommissionTransaction>> {
  return apiFetch<PaginatedResponse<CommissionTransaction>>(`/partners/${partnerId}/commission-transactions`, { query: params });
}

export function getCommissionTransaction(id: string): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}`);
}

/// `409 PARTNER_STUDENT_LINK_REQUIRED` / `404 COMMISSION_RULE_NOT_FOUND` /
/// `409 DUPLICATE_COMMISSION_TRANSACTION { existingTransactionId }` — all surfaced verbatim.
export function createCommissionTransaction(partnerId: string, input: CreateCommissionTransactionInput): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/partners/${partnerId}/commission-transactions`, { method: "POST", body: input });
}

/// Only while PENDING (`409 COMMISSION_TRANSACTION_NOT_EDITABLE` otherwise) — corrects the
/// Student/Case/Application link only, never money/status.
export function updateCommissionTransactionLinkage(id: string, input: UpdateCommissionTransactionLinkageInput): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}`, { method: "PATCH", body: input });
}

export function confirmCommissionEligibility(id: string): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}/confirm-eligibility`, { method: "POST" });
}

/// Backend-only Decimal computation — safe to call twice while still ELIGIBLE (pure
/// recompute), rejected with `409 INVALID_COMMISSION_TRANSACTION_STATE` from any other
/// status. `409 CURRENCY_MISMATCH` if the rule's currency doesn't match the source's.
export function calculateCommissionTransaction(id: string): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}/calculate`, { method: "POST" });
}

export function approveCommissionTransaction(id: string): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}/approve`, { method: "POST" });
}

export function markCommissionTransactionPayable(id: string): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}/mark-payable`, { method: "POST" });
}

export function payCommissionTransaction(id: string, input: PayCommissionTransactionInput): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}/pay`, { method: "POST", body: input });
}

/// Reachable from any non-terminal state, required reason.
export function cancelCommissionTransaction(id: string, input: CancelCommissionTransactionInput): Promise<CommissionTransaction> {
  return apiFetch<CommissionTransaction>(`/commission-transactions/${id}/cancel`, { method: "POST", body: input });
}
