/// Mirrors `database/schema.prisma` `Partner`. GLOBAL master data (F06 instruction §17),
/// permission-gated only — same treatment as University/Program (F05). `internalNotes` is
/// `null` when field-redacted for DOCUMENT_SPECIALIST (a different role than every other
/// F04-F06 `internalNotes` redaction, which target STUDENT_PARENT) — confirmed against
/// `FieldPolicyService.redactPartner`.

export type PartnerType = "UNIVERSITY_REPRESENTATIVE" | "AGENCY" | "LANGUAGE_CENTER" | "OTHER";
export const PARTNER_TYPES: PartnerType[] = ["UNIVERSITY_REPRESENTATIVE", "AGENCY", "LANGUAGE_CENTER", "OTHER"];

export type MasterDataStatus = "ACTIVE" | "INACTIVE";

export interface Partner {
  id: string;
  partnerCode: string;
  name: string;
  type: PartnerType;
  countryCode: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  ownerId: string | null;
  /** `null` when field-redacted for DOCUMENT_SPECIALIST, or genuinely unset. */
  internalNotes: string | null;
  status: MasterDataStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  type?: PartnerType;
  countryCode?: string;
  status?: MasterDataStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreatePartnerDto` exactly — `partnerCode` is server-generated.
export interface CreatePartnerInput {
  name: string;
  type: PartnerType;
  countryCode: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  ownerId?: string;
}

export interface UpdatePartnerInput extends Partial<CreatePartnerInput> {
  status?: MasterDataStatus;
  internalNotes?: string;
}

/// `409 DUPLICATE_PARTNER` shape — a single existing-record ID, on a case-insensitive
/// (name, countryCode) collision.
export interface DuplicatePartnerError {
  code: "DUPLICATE_PARTNER";
  message: string;
  existingPartnerId: string;
}
