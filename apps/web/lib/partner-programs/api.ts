import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreatePartnerProgramInput, PartnerProgram, PartnerProgramListParams, UpdatePartnerProgramInput } from "./types";

/// Typed calls against `PartnerProgramsNestedController`/`PartnerProgramsController`.

export function listPartnerPrograms(partnerId: string, params: PartnerProgramListParams): Promise<PaginatedResponse<PartnerProgram>> {
  return apiFetch<PaginatedResponse<PartnerProgram>>(`/partners/${partnerId}/programs`, { query: params });
}

export function getPartnerProgram(id: string): Promise<PartnerProgram> {
  return apiFetch<PartnerProgram>(`/partner-programs/${id}`);
}

/// `409 DUPLICATE_PARTNER_PROGRAM { existingPartnerProgramId }` — surfaced verbatim.
export function createPartnerProgram(partnerId: string, input: CreatePartnerProgramInput): Promise<PartnerProgram> {
  return apiFetch<PartnerProgram>(`/partners/${partnerId}/programs`, { method: "POST", body: input });
}

export function updatePartnerProgram(id: string, input: UpdatePartnerProgramInput): Promise<PartnerProgram> {
  return apiFetch<PartnerProgram>(`/partner-programs/${id}`, { method: "PATCH", body: input });
}

export function archivePartnerProgram(id: string): Promise<PartnerProgram> {
  return apiFetch<PartnerProgram>(`/partner-programs/${id}/archive`, { method: "POST" });
}
