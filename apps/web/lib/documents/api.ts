import { apiFetch, apiUpload } from "../api/client";
import type {
  DocumentRecord,
  DocumentSummary,
  ShareDocumentInput,
  UpdateDocumentInput,
  UploadDocumentInput,
  UploadDocumentResult,
} from "./types";

/// Typed calls against `apps/api/src/modules/documents/documents/documents.controller.ts`.
/// F04 only needed the two read-side calls (evidence/writing links); F07 adds the full
/// upload/edit/share/archive/version surface. No `list`/`search` call exists here — the
/// backend has no bare `GET /documents` route (docs/frontend/FRONTEND_ROUTES.md).

export function getDocument(id: string): Promise<DocumentSummary & DocumentRecord> {
  return apiFetch<DocumentSummary & DocumentRecord>(`/documents/${id}`);
}

/// Download flow step 1 — returns a short-lived, backend-relative `downloadUrl`
/// (`/documents/download/:token`). Never treat this as a permanent link; resolve it with
/// `resolveApiUrl` and navigate immediately (docs/frontend/FRONTEND_API_MAP.md §2 "Documents").
export function requestDocumentDownload(id: string): Promise<{ downloadUrl: string }> {
  return apiFetch<{ downloadUrl: string }>(`/documents/${id}/download`);
}

/// Multipart upload — mirrors `UploadDocumentDto` fields as form fields plus the file itself
/// under the `file` key (`FileInterceptor('file', ...)`). Client-side MIME/extension/size
/// checks happen in the calling form for UX only; the backend re-validates authoritatively
/// (magic bytes included) regardless (F07 instruction §8).
export function uploadDocument(input: UploadDocumentInput, file: File): Promise<UploadDocumentResult> {
  const formData = new FormData();
  formData.append("ownerEntity", input.ownerEntity);
  formData.append("ownerId", input.ownerId);
  formData.append("documentType", input.documentType);
  formData.append("title", input.title);
  formData.append("file", file);
  return apiUpload<UploadDocumentResult>("/documents", formData);
}

/// `409 DOCUMENT_ARCHIVED` if the target is already archived.
export function updateDocument(id: string, input: UpdateDocumentInput): Promise<DocumentRecord> {
  return apiFetch<DocumentRecord>(`/documents/${id}`, { method: "PATCH", body: input });
}

/// Additive-only grant (VIEW/DOWNLOAD) — see `ShareDocumentInput`'s doc comment for why there
/// is no corresponding "list grants"/"revoke" call.
export function shareDocument(id: string, input: ShareDocumentInput): Promise<{ shared: true }> {
  return apiFetch<{ shared: true }>(`/documents/${id}/share`, { method: "POST", body: input });
}

export function archiveDocument(id: string): Promise<DocumentRecord> {
  return apiFetch<DocumentRecord>(`/documents/${id}/archive`, { method: "POST" });
}

/// Always creates a brand-new Document row chained via `previousVersionId` — never an
/// in-place content swap ("Final/submitted/legal files require versioning... không
/// overwrite"). `409 DOCUMENT_ARCHIVED` if the current version is already archived.
export function createDocumentVersion(id: string, file: File): Promise<UploadDocumentResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<UploadDocumentResult>(`/documents/${id}/versions`, formData);
}
