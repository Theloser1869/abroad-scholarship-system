import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreatePartnerDocumentInput, PartnerDocument, PartnerDocumentListParams, UpdatePartnerDocumentInput } from "./types";

/// Typed calls against `PartnerDocumentsNestedController`/`PartnerDocumentsController`.
/// Never uploads a file itself — `documentId` must reference an already-uploaded Document
/// (F04/F07's existing subsystem), same pattern as every evidence field in this app.

export function listPartnerDocuments(partnerId: string, params: PartnerDocumentListParams): Promise<PaginatedResponse<PartnerDocument>> {
  return apiFetch<PaginatedResponse<PartnerDocument>>(`/partners/${partnerId}/documents`, { query: params });
}

export function getPartnerDocument(id: string): Promise<PartnerDocument> {
  return apiFetch<PartnerDocument>(`/partner-documents/${id}`);
}

export function createPartnerDocument(partnerId: string, input: CreatePartnerDocumentInput): Promise<PartnerDocument> {
  return apiFetch<PartnerDocument>(`/partners/${partnerId}/documents`, { method: "POST", body: input });
}

/// `409 PARTNER_DOCUMENT_NOT_EDITABLE` once no longer DRAFT.
export function updatePartnerDocument(id: string, input: UpdatePartnerDocumentInput): Promise<PartnerDocument> {
  return apiFetch<PartnerDocument>(`/partner-documents/${id}`, { method: "PATCH", body: input });
}

/// DRAFT → ACTIVE — atomically supersedes the prior ACTIVE row for the same (partner, type).
export function activatePartnerDocument(id: string): Promise<PartnerDocument> {
  return apiFetch<PartnerDocument>(`/partner-documents/${id}/activate`, { method: "POST" });
}

export function archivePartnerDocument(id: string): Promise<PartnerDocument> {
  return apiFetch<PartnerDocument>(`/partner-documents/${id}/archive`, { method: "POST" });
}
