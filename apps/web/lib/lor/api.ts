import { apiFetch } from "../api/client";
import type { CreateLorInput, LetterOfRecommendation, UpdateLorInput } from "./types";

/// Typed calls against `apps/api/src/modules/counseling/writing/lor.controller.ts`.

export function listLorForCase(caseId: string): Promise<LetterOfRecommendation[]> {
  return apiFetch<LetterOfRecommendation[]>(`/cases/${caseId}/letters-of-recommendation`);
}

export function createLor(caseId: string, input: CreateLorInput): Promise<LetterOfRecommendation> {
  return apiFetch<LetterOfRecommendation>(`/cases/${caseId}/letters-of-recommendation`, { method: "POST", body: input });
}

export function updateLor(id: string, input: UpdateLorInput): Promise<LetterOfRecommendation> {
  return apiFetch<LetterOfRecommendation>(`/letters-of-recommendation/${id}`, { method: "PATCH", body: input });
}
