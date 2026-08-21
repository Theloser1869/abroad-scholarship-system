import { apiFetch } from "../api/client";
import type { Assessment, AssessmentCriterion, CreateAssessmentInput, UpsertCriterionInput } from "./types";

/// Typed calls against `apps/api/src/modules/counseling/assessments/assessments.controller.ts`.
/// List is Case-scoped and returns a plain array (no `{data,meta}` — every list in this
/// domain is naturally small, confirmed directly against the controller).

export function listAssessmentsForCase(caseId: string): Promise<Assessment[]> {
  return apiFetch<Assessment[]>(`/cases/${caseId}/assessments`);
}

export function getAssessment(id: string): Promise<Assessment> {
  return apiFetch<Assessment>(`/assessments/${id}`);
}

/// Always creates the NEXT version — `409 OPEN_ASSESSMENT_EXISTS` if the latest is still
/// DRAFT/REVIEW, `409 CHANGE_REASON_REQUIRED` if the latest is APPROVED and no reason given.
export function createAssessment(caseId: string, input: CreateAssessmentInput): Promise<Assessment> {
  return apiFetch<Assessment>(`/cases/${caseId}/assessments`, { method: "POST", body: input });
}

export function submitAssessment(id: string): Promise<Assessment> {
  return apiFetch<Assessment>(`/assessments/${id}/submit`, { method: "POST" });
}

export function approveAssessment(id: string, reason?: string): Promise<Assessment> {
  return apiFetch<Assessment>(`/assessments/${id}/approve`, { method: "POST", body: { reason } });
}

export function rejectAssessment(id: string, reason: string): Promise<Assessment> {
  return apiFetch<Assessment>(`/assessments/${id}/reject`, { method: "POST", body: { reason } });
}

/// Upsert by `area` (travels in the body, not the path) — DRAFT/REVIEW only server-side.
export function upsertCriterion(assessmentId: string, input: UpsertCriterionInput): Promise<AssessmentCriterion> {
  return apiFetch<AssessmentCriterion>(`/assessments/${assessmentId}/criteria`, { method: "POST", body: input });
}
