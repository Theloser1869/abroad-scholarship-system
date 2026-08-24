import { apiFetch } from "../api/client";
import type { ConfirmEnrollmentInput, CreateEnrollmentInput, Enrollment, UpdateEnrollmentInput } from "./types";

/// Typed calls against `CaseEnrollmentsController`/`EnrollmentsController`
/// (`apps/api/.../enrollments.controller.ts`). Plain array response, not paginated. Only
/// `confirm`/`withdraw` are real dedicated actions — no generic status endpoint exists at all.

export function listEnrollmentsForCase(caseId: string): Promise<Enrollment[]> {
  return apiFetch<Enrollment[]>(`/cases/${caseId}/enrollments`);
}

export function getEnrollment(id: string): Promise<Enrollment> {
  return apiFetch<Enrollment>(`/enrollments/${id}`);
}

/// `409 INVALID_ENROLLMENT_TARGET` if the Offer isn't ACCEPTED — surfaced verbatim, never
/// pre-filtered by an invented client-side offer-validity rule.
export function createEnrollment(caseId: string, input: CreateEnrollmentInput): Promise<Enrollment> {
  return apiFetch<Enrollment>(`/cases/${caseId}/enrollments`, { method: "POST", body: input });
}

/// `409 ENROLLMENT_WITHDRAWN` once withdrawn.
export function updateEnrollment(id: string, input: UpdateEnrollmentInput): Promise<Enrollment> {
  return apiFetch<Enrollment>(`/enrollments/${id}`, { method: "PATCH", body: input });
}

/// PLANNED → CONFIRMED. `409 CONFIRMED_ENROLLMENT_EXISTS { existingEnrollmentId }` if
/// another CONFIRMED enrollment already exists for this Case.
export function confirmEnrollment(id: string, input: ConfirmEnrollmentInput): Promise<Enrollment> {
  return apiFetch<Enrollment>(`/enrollments/${id}/confirm`, { method: "POST", body: input });
}

/// {PLANNED, CONFIRMED} → WITHDRAWN.
export function withdrawEnrollment(id: string): Promise<Enrollment> {
  return apiFetch<Enrollment>(`/enrollments/${id}/withdraw`, { method: "POST" });
}
