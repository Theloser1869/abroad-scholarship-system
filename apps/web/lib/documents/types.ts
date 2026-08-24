/// F04 only integrated document *links* (kept below as `DocumentSummary`/`getDocument` — F04
/// instruction §31: "Không xây lại Document subsystem"). F07 owns the full subsystem: upload,
/// detail, versioning, share, archive — mirrors `Document` (`database/schema.prisma`) and
/// `DocumentsController`/`DocumentsService` exactly, no invented fields. There is no bare
/// `GET /documents` list on the backend (docs/frontend/FRONTEND_ROUTES.md "Documents") — every
/// Document is reached by a known id, never browsed from a client-side list.

export interface DocumentSummary {
  id: string;
  documentCode: string;
  title: string;
  originalFilename: string | null;
  mimeType: string | null;
  scanStatus: string;
}

export type DocumentStatus = "DRAFT" | "REVIEW" | "APPROVED" | "FINAL" | "SUBMITTED" | "ARCHIVED";

/// Independent from `DocumentStatus` — malware-scan lifecycle only. Download is blocked
/// unless CLEAN, enforced server-side (`DocumentsService.requestDownload`/`downloadByToken`),
/// never assumed true by the frontend.
export type DocumentScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "ERROR";

export type DocumentAccessPermission = "VIEW" | "DOWNLOAD" | "EDIT" | "SHARE";

/// `sizeBytes` is a Prisma `BigInt` column — serializes as a JSON string
/// (`apps/api/src/common/json-bigint.polyfill.ts`), never a `number`, so it is typed `string`
/// here too (same "Decimal-as-string" precedent as F04's Money fields). `previousVersionId`
/// is the only version-chain field the API returns — there is no `nextVersionId` scalar (only
/// a reverse Prisma relation, never selected), so version history can only be walked
/// *backward* from a known/current version, never forward from an old one — a real,
/// documented backend limitation (ASM, see docs/frontend/phase-status/PHASE_F07.md).
export interface DocumentRecord {
  id: string;
  documentCode: string;
  ownerEntity: string;
  ownerId: string;
  documentType: string;
  title: string;
  version: number;
  fileReference: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  checksumSha256: string | null;
  status: DocumentStatus;
  scanStatus: DocumentScanStatus;
  uploadedById: string;
  uploadedAt: string;
  retentionUntil: string | null;
  legalHold: boolean;
  archivedAt: string | null;
  previousVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/// Mirrors `UploadDocumentDto` exactly — the file itself is sent as multipart, not part of
/// this JSON-shaped input (see `uploadDocument` in `./api.ts`).
export interface UploadDocumentInput {
  ownerEntity: string;
  ownerId: string;
  documentType: string;
  title: string;
}

/// `duplicateOfId` is informational only, never blocking (`DocumentsService.upload`'s own
/// comment) — a second upload with the same owner+checksum still succeeds as a new row.
export interface UploadDocumentResult extends DocumentRecord {
  duplicateOfId: string | null;
}

/// Metadata-only — mirrors `UpdateDocumentDto`. There is no way to replace file content
/// through this input; that is always `createDocumentVersion` (`POST /documents/:id/versions`).
export interface UpdateDocumentInput {
  title?: string;
  documentType?: string;
}

/// Mirrors `ShareDocumentDto` — additive only. The backend has no "list grants" or "revoke
/// grant" endpoint for a Document (confirmed against `DocumentsController`), so a Share
/// dialog can only grant new access, never enumerate or revoke existing grants — a real,
/// documented backend limitation, not a frontend omission.
export interface ShareDocumentInput {
  principalId: string;
  permissions: ("VIEW" | "DOWNLOAD")[];
}
