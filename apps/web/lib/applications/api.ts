import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type {
  Application,
  ApplicationChecklistItem,
  ApplicationDetail,
  ApplicationListParams,
  CreateApplicationInput,
  CreateChecklistItemInput,
  SubmitApplicationInput,
  UpdateApplicationInput,
  UpdateChecklistItemInput,
} from "./types";

/// Typed calls against `CaseApplicationsController`/`ApplicationsController`/
/// `ApplicationChecklistItemsController`/`ChecklistItemsController`
/// (`apps/api/.../applications.controller.ts`). SUBMITTED/OFFER are reachable only through
/// their own dedicated paths, never the generic status PATCH (F05 instruction §15).

export function listApplicationsForCase(caseId: string, params: ApplicationListParams): Promise<PaginatedResponse<Application>> {
  return apiFetch<PaginatedResponse<Application>>(`/cases/${caseId}/applications`, { query: params });
}

export function getApplication(id: string): Promise<ApplicationDetail> {
  return apiFetch<ApplicationDetail>(`/applications/${id}`);
}

/// `409 ACTIVE_APPLICATION_EXISTS { existingApplicationId }` on a (studentId, programId,
/// intendedIntake) collision among non-terminal statuses — surfaced verbatim, never
/// pre-checked with a separate lookup request first (F05 instruction §15).
export function createApplication(caseId: string, input: CreateApplicationInput): Promise<Application> {
  return apiFetch<Application>(`/cases/${caseId}/applications`, { method: "POST", body: input });
}

/// `409 APPLICATION_WITHDRAWN` if already withdrawn.
export function updateApplication(id: string, input: UpdateApplicationInput): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}`, { method: "PATCH", body: input });
}

/// READY_FOR_REVIEW → SUBMITTED only. `409 CHECKLIST_INCOMPLETE` if any required item isn't
/// DONE/WAIVED — the backend is the sole gate, never pre-computed from the loaded checklist
/// (F05 instruction §16).
export function submitApplication(id: string, input: SubmitApplicationInput): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}/submit`, { method: "POST", body: input });
}

/// Every status except SUBMITTED/OFFER. `409 INVALID_APPLICATION_STATUS_TRANSITION
/// { allowedTransitions }` for anything the backend's FSM rejects.
export function updateApplicationStatus(id: string, status: string, reason?: string): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}/status`, { method: "PATCH", body: { status, reason } });
}

export function listChecklistItems(applicationId: string): Promise<ApplicationChecklistItem[]> {
  return apiFetch<ApplicationChecklistItem[]>(`/applications/${applicationId}/checklist`);
}

export function createChecklistItem(applicationId: string, input: CreateChecklistItemInput): Promise<ApplicationChecklistItem> {
  return apiFetch<ApplicationChecklistItem>(`/applications/${applicationId}/checklist`, { method: "POST", body: input });
}

export function updateChecklistItem(id: string, input: UpdateChecklistItemInput): Promise<ApplicationChecklistItem> {
  return apiFetch<ApplicationChecklistItem>(`/checklist-items/${id}`, { method: "PATCH", body: input });
}
