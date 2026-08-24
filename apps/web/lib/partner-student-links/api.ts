import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreatePartnerStudentLinkInput, PartnerStudentLink, PartnerStudentLinkListParams, UpdatePartnerStudentLinkInput } from "./types";

/// Typed calls against `PartnerStudentLinksNestedController`/`StudentPartnerLinksController`/
/// `PartnerStudentLinksController`. Two independent list contexts (`/partners/:id/
/// student-links` and `/students/:id/partner-links`) reach the exact same underlying rows.

export function listPartnerStudentLinksForPartner(partnerId: string, params: PartnerStudentLinkListParams): Promise<PaginatedResponse<PartnerStudentLink>> {
  return apiFetch<PaginatedResponse<PartnerStudentLink>>(`/partners/${partnerId}/student-links`, { query: params });
}

export function listPartnerStudentLinksForStudent(studentId: string, params: PartnerStudentLinkListParams): Promise<PaginatedResponse<PartnerStudentLink>> {
  return apiFetch<PaginatedResponse<PartnerStudentLink>>(`/students/${studentId}/partner-links`, { query: params });
}

export function getPartnerStudentLink(id: string): Promise<PartnerStudentLink> {
  return apiFetch<PartnerStudentLink>(`/partner-student-links/${id}`);
}

/// `409 DUPLICATE_PARTNER_STUDENT_LINK { existingLinkId }` on a repeat active tuple —
/// surfaced verbatim.
export function createPartnerStudentLink(partnerId: string, input: CreatePartnerStudentLinkInput): Promise<PartnerStudentLink> {
  return apiFetch<PartnerStudentLink>(`/partners/${partnerId}/student-links`, { method: "POST", body: input });
}

/// `409 PARTNER_STUDENT_LINK_ARCHIVED` once archived.
export function updatePartnerStudentLink(id: string, input: UpdatePartnerStudentLinkInput): Promise<PartnerStudentLink> {
  return apiFetch<PartnerStudentLink>(`/partner-student-links/${id}`, { method: "PATCH", body: input });
}

/// No hard-delete (Hard Rule #5) — stamps `endDate`, preserving history.
export function archivePartnerStudentLink(id: string): Promise<PartnerStudentLink> {
  return apiFetch<PartnerStudentLink>(`/partner-student-links/${id}/archive`, { method: "POST" });
}
