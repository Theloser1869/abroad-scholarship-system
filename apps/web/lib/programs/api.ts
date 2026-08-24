import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreateProgramInput, Program, ProgramListParams, UpdateProgramInput } from "./types";

/// Typed calls against `ProgramsController` (`apps/api/.../master-data.controller.ts`).

export function listPrograms(params: ProgramListParams): Promise<PaginatedResponse<Program>> {
  return apiFetch<PaginatedResponse<Program>>("/programs", { query: params });
}

export function getProgram(id: string): Promise<Program> {
  return apiFetch<Program>(`/programs/${id}`);
}

/// `409 DUPLICATE_PROGRAM { existingProgramId }` on a (university, degreeLevel, major,
/// intake) collision, and `404 UNIVERSITY_NOT_FOUND` if `universityId` doesn't exist —
/// surfaced verbatim.
export function createProgram(input: CreateProgramInput): Promise<Program> {
  return apiFetch<Program>("/programs", { method: "POST", body: input });
}

export function updateProgram(id: string, input: UpdateProgramInput): Promise<Program> {
  return apiFetch<Program>(`/programs/${id}`, { method: "PATCH", body: input });
}

export function verifyProgram(id: string): Promise<Program> {
  return apiFetch<Program>(`/programs/${id}/verify`, { method: "POST" });
}
