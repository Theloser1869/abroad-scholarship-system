/// Mirrors `database/schema.prisma` `PartnerDocument`. **Its own model, not literally
/// Document rows** — carries type/version/status/effective/expiry metadata plus a nullable
/// `documentId` FK into the core Document subsystem (F04's ASM-24 "link a pre-existing
/// Document, never create one here" pattern — `documentId` is actually REQUIRED on create,
/// since a PartnerDocument always wraps an already-uploaded file). DRAFT → ACTIVE
/// (atomically supersedes the prior ACTIVE row for the same partner+type → SUPERSEDED) →
/// EXPIRED (lazy sweep) or ARCHIVED (manual). Editable only while DRAFT — "Không overwrite
/// signed/final partner documents" (F06 instruction §19); a correction after signing is a
/// whole new version row (`@@unique([partnerId, type, version])`, auto-incremented), never
/// an in-place edit.

export type PartnerDocumentType = "MOU" | "AGREEMENT" | "COMMISSION_AGREEMENT" | "RATE_SHEET" | "OTHER";
export const PARTNER_DOCUMENT_TYPES: PartnerDocumentType[] = ["MOU", "AGREEMENT", "COMMISSION_AGREEMENT", "RATE_SHEET", "OTHER"];

export type PartnerDocumentStatus = "DRAFT" | "ACTIVE" | "EXPIRED" | "SUPERSEDED" | "ARCHIVED";

export interface PartnerDocument {
  id: string;
  partnerId: string;
  type: PartnerDocumentType;
  version: number;
  status: PartnerDocumentStatus;
  effectiveDate: string | null;
  expiryDate: string | null;
  documentId: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerDocumentListParams {
  page?: number;
  limit?: number;
  sort?: string;
  type?: PartnerDocumentType;
  status?: PartnerDocumentStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreatePartnerDocumentDto` exactly — `documentId` required (the file must
/// already be uploaded through the existing Document subsystem).
export interface CreatePartnerDocumentInput {
  type: PartnerDocumentType;
  documentId: string;
  effectiveDate?: string;
  expiryDate?: string;
  ownerId?: string;
}

/// Allowed only while DRAFT — `409 PARTNER_DOCUMENT_NOT_EDITABLE` otherwise.
export interface UpdatePartnerDocumentInput {
  effectiveDate?: string;
  expiryDate?: string;
  ownerId?: string;
  documentId?: string;
}
