import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreatePartnerInput, Partner, PartnerListParams, UpdatePartnerInput } from "./types";

/// Typed calls against `PartnersController` (`apps/api/.../partners.controller.ts`).

export function listPartners(params: PartnerListParams): Promise<PaginatedResponse<Partner>> {
  return apiFetch<PaginatedResponse<Partner>>("/partners", { query: params });
}

export function getPartner(id: string): Promise<Partner> {
  return apiFetch<Partner>(`/partners/${id}`);
}

/// `409 DUPLICATE_PARTNER { existingPartnerId }` on a case-insensitive (name, countryCode)
/// collision — surfaced verbatim.
export function createPartner(input: CreatePartnerInput): Promise<Partner> {
  return apiFetch<Partner>("/partners", { method: "POST", body: input });
}

export function updatePartner(id: string, input: UpdatePartnerInput): Promise<Partner> {
  return apiFetch<Partner>(`/partners/${id}`, { method: "PATCH", body: input });
}

/// Dedicated action — sets `status: 'INACTIVE'`, never a bare status PATCH from the UI
/// (though `update` technically accepts a `status` field too, matching the backend's own
/// dual-path shape — this action is the one the archive button uses).
export function archivePartner(id: string): Promise<Partner> {
  return apiFetch<Partner>(`/partners/${id}/archive`, { method: "POST" });
}
