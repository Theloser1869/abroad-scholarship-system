import { apiFetch } from "../api/client";
import type {
  AwardScholarshipInput,
  ConfirmEligibilityInput,
  CreateScholarshipApplicationInput,
  ScholarshipApplication,
  UpdateScholarshipApplicationInput,
} from "./types";

/// Typed calls against `CaseScholarshipApplicationsController`/`ScholarshipApplicationsController`
/// (`apps/api/.../scholarship-applications.controller.ts`). Plain array response, not
/// paginated. Every status-sensitive action is its own dedicated route — AWARDED/REJECTED
/// reachable only via `award`/`reject`, never the generic status PATCH.

export function listScholarshipApplicationsForCase(caseId: string): Promise<ScholarshipApplication[]> {
  return apiFetch<ScholarshipApplication[]>(`/cases/${caseId}/scholarship-applications`);
}

export function getScholarshipApplication(id: string): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/scholarship-applications/${id}`);
}

export function createScholarshipApplication(caseId: string, input: CreateScholarshipApplicationInput): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/cases/${caseId}/scholarship-applications`, { method: "POST", body: input });
}

/// `409 SCHOLARSHIP_APPLICATION_CLOSED` if status is AWARDED/REJECTED/WITHDRAWN.
export function updateScholarshipApplication(id: string, input: UpdateScholarshipApplicationInput): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/scholarship-applications/${id}`, { method: "PATCH", body: input });
}

/// Eligibility gate — represented as two plain fields on the entity itself (`eligibilityConfirmed`/
/// `eligibilityNotes`), never a separate eligibility-check endpoint (F05 instruction §22).
export function confirmScholarshipEligibility(id: string, input: ConfirmEligibilityInput): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/scholarship-applications/${id}/confirm-eligibility`, { method: "POST", body: input });
}

/// Every status except AWARDED/REJECTED. `409 ELIGIBILITY_NOT_CONFIRMED` if attempting
/// SUBMITTED before eligibility is confirmed — surfaced verbatim, never pre-checked.
export function updateScholarshipApplicationStatus(id: string, status: string): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/scholarship-applications/${id}/status`, { method: "PATCH", body: { status } });
}

/// SCHOLARSHIP RESULT — reachable only from UNDER_REVIEW/INTERVIEW
/// (`409 INVALID_SCHOLARSHIP_APPLICATION_STATE` otherwise). Never creates a Contract/Payment
/// record — deliberately kept separate (F05 instruction §23).
export function awardScholarship(id: string, input: AwardScholarshipInput): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/scholarship-applications/${id}/award`, { method: "POST", body: input });
}

export function rejectScholarshipApplication(id: string): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/scholarship-applications/${id}/reject`, { method: "POST" });
}
