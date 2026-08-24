import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreateScholarshipMasterInput, ScholarshipMaster, ScholarshipMasterListParams, UpdateScholarshipMasterInput } from "./types";

/// Typed calls against `ScholarshipMastersController` (`apps/api/.../master-data.controller.ts`).

export function listScholarshipMasters(params: ScholarshipMasterListParams): Promise<PaginatedResponse<ScholarshipMaster>> {
  return apiFetch<PaginatedResponse<ScholarshipMaster>>("/scholarship-masters", { query: params });
}

export function getScholarshipMaster(id: string): Promise<ScholarshipMaster> {
  return apiFetch<ScholarshipMaster>(`/scholarship-masters/${id}`);
}

/// `409 DUPLICATE_SCHOLARSHIP_MASTER { existingScholarshipMasterId }` on a (provider, name,
/// universityId, programId) collision — surfaced verbatim.
export function createScholarshipMaster(input: CreateScholarshipMasterInput): Promise<ScholarshipMaster> {
  return apiFetch<ScholarshipMaster>("/scholarship-masters", { method: "POST", body: input });
}

export function updateScholarshipMaster(id: string, input: UpdateScholarshipMasterInput): Promise<ScholarshipMaster> {
  return apiFetch<ScholarshipMaster>(`/scholarship-masters/${id}`, { method: "PATCH", body: input });
}

export function verifyScholarshipMaster(id: string): Promise<ScholarshipMaster> {
  return apiFetch<ScholarshipMaster>(`/scholarship-masters/${id}/verify`, { method: "POST" });
}
