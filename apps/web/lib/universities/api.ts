import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreateUniversityInput, University, UniversityListParams, UpdateUniversityInput } from "./types";

/// Typed calls against `apps/api/src/modules/admission/master-data/master-data.controller.ts`
/// (`UniversitiesController`) — GLOBAL master-data CRUD + a dedicated `verify` action,
/// never a bare status/field PATCH standing in for it (F05 instruction §7/§8).

export function listUniversities(params: UniversityListParams): Promise<PaginatedResponse<University>> {
  return apiFetch<PaginatedResponse<University>>("/universities", { query: params });
}

export function getUniversity(id: string): Promise<University> {
  return apiFetch<University>(`/universities/${id}`);
}

/// `409 DUPLICATE_UNIVERSITY { existingUniversityId }` on a case-insensitive (officialName,
/// countryCode) collision — surfaced verbatim by the caller, never pre-checked client-side.
export function createUniversity(input: CreateUniversityInput): Promise<University> {
  return apiFetch<University>("/universities", { method: "POST", body: input });
}

export function updateUniversity(id: string, input: UpdateUniversityInput): Promise<University> {
  return apiFetch<University>(`/universities/${id}`, { method: "PATCH", body: input });
}

/// Stamps `lastVerifiedAt` only — a dedicated `admission_master:verify` permission, distinct
/// from `edit` (F05 instruction §7: "verify action gọi dedicated endpoint").
export function verifyUniversity(id: string): Promise<University> {
  return apiFetch<University>(`/universities/${id}/verify`, { method: "POST" });
}
