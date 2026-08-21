import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { TimelineEntry } from "../timeline/types";
import type {
  ConvertLeadInput,
  ConvertLeadResult,
  CreateLeadInput,
  Lead,
  LeadListParams,
  UpdateLeadInput,
} from "./types";

/// Typed calls against `apps/api/src/modules/crm/leads/leads.controller.ts` — every route
/// here is a real, already-implemented backend endpoint (docs/api/API_CONVENTIONS.md §11).

export function listLeads(params: LeadListParams): Promise<PaginatedResponse<Lead>> {
  return apiFetch<PaginatedResponse<Lead>>("/leads", { query: params });
}

export function getLead(id: string): Promise<Lead> {
  return apiFetch<Lead>(`/leads/${id}`);
}

export function createLead(input: CreateLeadInput): Promise<Lead> {
  return apiFetch<Lead>("/leads", { method: "POST", body: input });
}

export function updateLead(id: string, input: UpdateLeadInput): Promise<Lead> {
  return apiFetch<Lead>(`/leads/${id}`, { method: "PATCH", body: input });
}

/// FSM-validated server-side (`LEAD_TRANSITIONS` in `leads.service.ts`) — an illegal
/// transition is `409 INVALID_STATUS_TRANSITION` with `allowedTransitions` in the error
/// body; this function never pre-validates the transition itself (F03 instruction §6:
/// "Không cho frontend tự set status bất kỳ... gọi dedicated backend actions").
export function updateLeadStatus(id: string, status: string): Promise<Lead> {
  return apiFetch<Lead>(`/leads/${id}/status`, { method: "PATCH", body: { status } });
}

export function assignLeadOwner(id: string, ownerId: string): Promise<Lead> {
  return apiFetch<Lead>(`/leads/${id}/assign`, { method: "PATCH", body: { ownerId } });
}

/// May respond `409 DUPLICATE_STUDENT_CANDIDATES` (retry with `confirmMatch`) — the caller
/// (`useConvertLead`'s consumer, the conversion dialog) handles that specific code, never a
/// generic error. Backend resolves duplicate-detection/merge/Student+Case creation entirely
/// — this function never guesses or pre-computes any of it (F03 instruction §9).
export function convertLead(id: string, input: ConvertLeadInput): Promise<ConvertLeadResult> {
  return apiFetch<ConvertLeadResult>(`/leads/${id}/convert`, { method: "POST", body: input });
}

export function addLeadNote(id: string, body: string, visibility: "internal" | "shared" = "internal") {
  return apiFetch(`/leads/${id}/notes`, { method: "POST", body: { body, visibility } });
}

export function getLeadTimeline(id: string): Promise<TimelineEntry[]> {
  return apiFetch<TimelineEntry[]>(`/leads/${id}/timeline`);
}
