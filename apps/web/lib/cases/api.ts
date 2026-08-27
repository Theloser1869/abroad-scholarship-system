import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { TimelineEntry } from "../timeline/types";
import type { AddCaseMemberInput, Case, CaseListParams, CaseMember, UpdateCaseStageInput } from "./types";

/// Typed calls against `apps/api/src/modules/case-management/cases/cases.controller.ts` — no
/// bare `PATCH /cases/:id` exists; every mutation is a dedicated route (F03 instruction §16:
/// "Backend Case FSM là authority; không được có PATCH status chung chung").

export function listCases(params: CaseListParams): Promise<PaginatedResponse<Case>> {
  return apiFetch<PaginatedResponse<Case>>("/cases", { query: params });
}

export function getCase(id: string): Promise<Case> {
  return apiFetch<Case>(`/cases/${id}`);
}

export function updateCaseStage(id: string, input: UpdateCaseStageInput): Promise<Case> {
  return apiFetch<Case>(`/cases/${id}/stage`, { method: "PATCH", body: input });
}

/// FSM-validated server-side (`CASE_TRANSITIONS`) — CLOSED is excluded, reachable only via
/// `closeCase`. Never pre-validates the transition client-side.
export function updateCaseStatus(id: string, status: string): Promise<Case> {
  return apiFetch<Case>(`/cases/${id}/status`, { method: "PATCH", body: { status } });
}

export function listCaseMembers(id: string): Promise<CaseMember[]> {
  return apiFetch<CaseMember[]>(`/cases/${id}/members`);
}

export function addCaseMember(id: string, input: AddCaseMemberInput): Promise<CaseMember> {
  return apiFetch<CaseMember>(`/cases/${id}/members`, { method: "POST", body: input });
}

export function removeCaseMember(id: string, userId: string): Promise<{ removed: boolean }> {
  return apiFetch<{ removed: boolean }>(`/cases/${id}/members/${userId}`, { method: "DELETE" });
}

export function reassignCaseOwner(id: string, userId: string): Promise<Case> {
  return apiFetch<Case>(`/cases/${id}/reassign-owner`, { method: "POST", body: { userId } });
}

export function addCaseNote(id: string, body: string, visibility: "internal" | "shared" = "internal") {
  return apiFetch(`/cases/${id}/notes`, { method: "POST", body: { body, visibility } });
}

export function getCaseTimeline(id: string): Promise<TimelineEntry[]> {
  return apiFetch<TimelineEntry[]>(`/cases/${id}/timeline`);
}
