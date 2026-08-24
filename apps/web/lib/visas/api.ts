import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type {
  CreateVisaChecklistItemInput,
  CreateVisaInput,
  RecordInterviewInput,
  RecordVisaResultInput,
  ScheduleAppointmentInput,
  SubmitVisaInput,
  UpdateVisaChecklistItemInput,
  UpdateVisaInput,
  Visa,
  VisaChecklistItem,
  VisaListParams,
} from "./types";

/// Typed calls against `CaseVisasController`/`VisasController`/`VisaChecklistItemsController`
/// (`apps/api/.../visas.controller.ts`, `visa-checklist.controller.ts`). SUBMITTED/
/// APPOINTMENT/INTERVIEW/GRANTED/REFUSED are each reachable only through their own dedicated,
/// data-carrying action — never the generic status PATCH (F06 instruction §8).

export function listVisasForCase(caseId: string, params: VisaListParams): Promise<PaginatedResponse<Visa>> {
  return apiFetch<PaginatedResponse<Visa>>(`/cases/${caseId}/visas`, { query: params });
}

export function getVisa(id: string): Promise<Visa> {
  return apiFetch<Visa>(`/visas/${id}`);
}

/// `409 ACTIVE_VISA_EXISTS { existingVisaId }` — at most one non-terminal Visa per Case,
/// surfaced verbatim, never pre-checked with a separate lookup first.
export function createVisa(caseId: string, input: CreateVisaInput): Promise<Visa> {
  return apiFetch<Visa>(`/cases/${caseId}/visas`, { method: "POST", body: input });
}

/// `409 VISA_CLOSED` once terminal (GRANTED/REFUSED/WITHDRAWN).
export function updateVisa(id: string, input: UpdateVisaInput): Promise<Visa> {
  return apiFetch<Visa>(`/visas/${id}`, { method: "PATCH", body: input });
}

/// Only NOT_STARTED/PREPARING/READY/WITHDRAWN — `409 INVALID_VISA_STATUS_TRANSITION
/// { allowedTransitions }` for anything the backend's FSM rejects. Targeting READY also
/// re-checks the mandatory-checklist gate server-side (`409 CHECKLIST_INCOMPLETE`).
export function updateVisaStatus(id: string, status: string): Promise<Visa> {
  return apiFetch<Visa>(`/visas/${id}/status`, { method: "PATCH", body: { status } });
}

/// READY → SUBMITTED, re-verifying the same checklist gate.
export function submitVisa(id: string, input: SubmitVisaInput): Promise<Visa> {
  return apiFetch<Visa>(`/visas/${id}/submit`, { method: "POST", body: input });
}

/// SUBMITTED → APPOINTMENT.
export function scheduleVisaAppointment(id: string, input: ScheduleAppointmentInput): Promise<Visa> {
  return apiFetch<Visa>(`/visas/${id}/appointment`, { method: "POST", body: input });
}

/// APPOINTMENT → INTERVIEW.
export function recordVisaInterview(id: string, input: RecordInterviewInput): Promise<Visa> {
  return apiFetch<Visa>(`/visas/${id}/interview`, { method: "POST", body: input });
}

/// {SUBMITTED, APPOINTMENT, INTERVIEW} → {GRANTED, REFUSED}.
export function recordVisaResult(id: string, input: RecordVisaResultInput): Promise<Visa> {
  return apiFetch<Visa>(`/visas/${id}/result`, { method: "POST", body: input });
}

export function listVisaChecklist(visaId: string): Promise<VisaChecklistItem[]> {
  return apiFetch<VisaChecklistItem[]>(`/visas/${visaId}/checklist`);
}

export function createVisaChecklistItem(visaId: string, input: CreateVisaChecklistItemInput): Promise<VisaChecklistItem> {
  return apiFetch<VisaChecklistItem>(`/visas/${visaId}/checklist`, { method: "POST", body: input });
}

export function updateVisaChecklistItem(id: string, input: UpdateVisaChecklistItemInput): Promise<VisaChecklistItem> {
  return apiFetch<VisaChecklistItem>(`/visa-checklist-items/${id}`, { method: "PATCH", body: input });
}
