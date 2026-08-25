import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type {
  Contract,
  ContractAmendment,
  ContractListParams,
  ContractTemplate,
  CreateAmendmentInput,
  CreateContractInput,
  SendContractResult,
  UpdateContractInput,
} from "./types";

/// Typed calls against `apps/api/src/modules/commercial/contracts/contracts.controller.ts` —
/// every status-sensitive action is its own dedicated route, never a bare `PATCH /contracts/
/// :id` for anything beyond DRAFT-only field edits (F04 instruction §8).

export function listContracts(params: ContractListParams): Promise<PaginatedResponse<Contract>> {
  return apiFetch<PaginatedResponse<Contract>>("/contracts", { query: params });
}

export function getContract(id: string): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}`);
}

export function createContract(input: CreateContractInput): Promise<Contract> {
  return apiFetch<Contract>("/contracts", { method: "POST", body: input });
}

/// DRAFT-only server-side — `409 INVALID_CONTRACT_STATE` otherwise.
export function updateContract(id: string, input: UpdateContractInput): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}`, { method: "PATCH", body: input });
}

export function submitContract(id: string): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}/submit`, { method: "POST" });
}

/// `409 APPROVAL_THRESHOLD_EXCEEDED` if `value >= approvalThreshold` and the caller isn't
/// EXECUTIVE_DIRECTOR — never pre-checked client-side, surfaced verbatim.
export function approveContract(id: string, reason?: string): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}/approve`, { method: "POST", body: { reason } });
}

export function rejectContract(id: string, reason: string): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}/reject`, { method: "POST", body: { reason } });
}

/// Returns a one-time review token — shown exactly once, never persisted/re-fetchable.
export function sendContract(id: string): Promise<SendContractResult> {
  return apiFetch<SendContractResult>(`/contracts/${id}/send`, { method: "POST" });
}

export function signContract(id: string, signedDocumentId: string): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}/sign`, { method: "POST", body: { signedDocumentId } });
}

/// Only the 4 linear post-sign moves (`MANUAL_CONTRACT_STATUSES`) — `409
/// INVALID_STATUS_TRANSITION` for anything else, FSM-validated server-side. `reason` is
/// required (non-empty) server-side only when `status === "LIQUIDATED"` (Client Acceptance
/// Remediation GAP-007) — ignored for every other target status.
export function updateContractStatus(id: string, status: string, reason?: string): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}/status`, { method: "PATCH", body: { status, reason } });
}

export function listContractAmendments(id: string): Promise<ContractAmendment[]> {
  return apiFetch<ContractAmendment[]>(`/contracts/${id}/amendments`);
}

/// Only path to change terms after signing — `409 CONTRACT_NOT_YET_SIGNED` /
/// `409 NO_MATERIAL_CHANGE` handled by the caller, never pre-validated here.
export function createContractAmendment(id: string, input: CreateAmendmentInput): Promise<ContractAmendment> {
  return apiFetch<ContractAmendment>(`/contracts/${id}/amendments`, { method: "POST", body: input });
}

export function listContractTemplates(): Promise<ContractTemplate[]> {
  return apiFetch<ContractTemplate[]>("/contract-templates");
}
