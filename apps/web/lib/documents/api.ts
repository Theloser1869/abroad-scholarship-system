import { apiFetch } from "../api/client";
import type { DocumentSummary } from "./types";

/// Typed calls against `apps/api/src/modules/documents/documents/documents.controller.ts` —
/// only the two read-side calls F04's evidence/writing links need. Upload/share/archive stay
/// out of scope (F07 owns the full Document subsystem UI).

export function getDocument(id: string): Promise<DocumentSummary> {
  return apiFetch<DocumentSummary>(`/documents/${id}`);
}

/// Download flow step 1 — returns a short-lived, backend-relative `downloadUrl`
/// (`/documents/download/:token`). Never treat this as a permanent link; resolve it with
/// `resolveApiUrl` and navigate immediately (docs/frontend/FRONTEND_API_MAP.md §2 "Documents").
export function requestDocumentDownload(id: string): Promise<{ downloadUrl: string }> {
  return apiFetch<{ downloadUrl: string }>(`/documents/${id}/download`);
}
