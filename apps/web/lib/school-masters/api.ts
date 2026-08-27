import { apiFetch } from "../api/client";
import type { CreateSchoolMasterInput, SchoolMaster } from "./types";

/// Typed calls against `SchoolMastersController` (`apps/api/.../profile-evidence/`).

export function listSchoolMasters(search?: string): Promise<SchoolMaster[]> {
  return apiFetch<SchoolMaster[]>("/school-masters", { query: search ? { search } : undefined });
}

/// `409 DUPLICATE_SCHOOL_MASTER { existingSchoolMasterId }` on a case-insensitive name
/// collision, surfaced verbatim.
export function createSchoolMaster(input: CreateSchoolMasterInput): Promise<SchoolMaster> {
  return apiFetch<SchoolMaster>("/school-masters", { method: "POST", body: input });
}
