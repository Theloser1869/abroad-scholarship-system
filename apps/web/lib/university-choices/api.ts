import { apiFetch } from "../api/client";
import type { CreateUniversityChoiceInput, ReviewUniversityChoiceInput, UniversityChoice, UpdateUniversityChoiceInput } from "./types";

/// Typed calls against `StudentUniversityChoicesController`/`UniversityChoicesController`
/// (`apps/api/.../university-choices.controller.ts`). Plain array response, not paginated
/// (confirmed against the live service — `listForStudent` returns `UniversityChoice[]`).

export function listUniversityChoicesForStudent(studentId: string): Promise<UniversityChoice[]> {
  return apiFetch<UniversityChoice[]>(`/students/${studentId}/university-choices`);
}

export function getUniversityChoice(id: string): Promise<UniversityChoice> {
  return apiFetch<UniversityChoice>(`/university-choices/${id}`);
}

/// `409 DUPLICATE_UNIVERSITY_CHOICE { existingUniversityChoiceId }` on a repeated
/// (studentId, programId) pair — surfaced verbatim.
export function createUniversityChoice(studentId: string, input: CreateUniversityChoiceInput): Promise<UniversityChoice> {
  return apiFetch<UniversityChoice>(`/students/${studentId}/university-choices`, { method: "POST", body: input });
}

export function updateUniversityChoice(id: string, input: UpdateUniversityChoiceInput): Promise<UniversityChoice> {
  return apiFetch<UniversityChoice>(`/university-choices/${id}`, { method: "PATCH", body: input });
}

/// Dedicated action — stamps `reviewedById`/`reviewedAt` server-side only, never
/// client-suppliable.
export function reviewUniversityChoice(id: string, input: ReviewUniversityChoiceInput): Promise<UniversityChoice> {
  return apiFetch<UniversityChoice>(`/university-choices/${id}/review`, { method: "POST", body: input });
}
