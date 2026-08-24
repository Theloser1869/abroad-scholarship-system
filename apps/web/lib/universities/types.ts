/// Mirrors `database/schema.prisma` `University` + `apps/api/.../master-data/dto/*`. GLOBAL
/// master data (F05 instruction §7/§25) — no per-record scope, gated purely by the
/// `admission_master` permission resource. Every field here is one the backend actually
/// returns (verified against `universities.service.ts` directly) — no redaction exists for
/// this entity (confirmed: no `redactUniversity*` anywhere in `field-policy.service.ts`).

export type MasterDataStatus = "ACTIVE" | "INACTIVE";
export type ExternalSyncStatus = "NOT_SYNCED" | "SYNCED" | "MANUAL_OVERRIDE";

export interface University {
  id: string;
  universityCode: string;
  officialName: string;
  countryCode: string;
  city: string | null;
  campus: string | null;
  website: string | null;
  admissionsUrl: string | null;
  status: MasterDataStatus;
  ownerId: string | null;
  source: string | null;
  sourceUrl: string | null;
  externalId: string | null;
  retrievedAt: string | null;
  syncStatus: ExternalSyncStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UniversityListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  countryCode?: string;
  status?: MasterDataStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateUniversityDto` exactly — `universityCode` is server-generated, never
/// client-supplied.
export interface CreateUniversityInput {
  officialName: string;
  countryCode: string;
  city?: string;
  campus?: string;
  website?: string;
  admissionsUrl?: string;
  status?: MasterDataStatus;
  ownerId?: string;
  source?: string;
}

export type UpdateUniversityInput = Partial<CreateUniversityInput>;

/// `409 DUPLICATE_UNIVERSITY` shape — a single existing-record ID, never a candidates array
/// (confirmed directly against `UniversitiesService.assertNoDuplicate`; some planning
/// documents assume a multi-candidate picker, the real backend does not support one).
export interface DuplicateUniversityError {
  code: "DUPLICATE_UNIVERSITY";
  message: string;
  existingUniversityId: string;
}
