import type { ExternalSyncStatus, MasterDataStatus } from "../universities/types";

/// Mirrors `database/schema.prisma` `ScholarshipMaster`. Master definition only —
/// deliberately separate from `ScholarshipApplication` (`lib/scholarship-applications/`),
/// the per-student transaction (F05 instruction §11/§21: "Không merge entity với
/// Scholarship Master"). `universityId`/`programId` both optional and independent — a
/// scholarship may tie to a specific Program, a University generally, or neither.
/// `amount`/`percentage` are Decimal fields, typed `string`, display-only via `formatMoney`.
/// Per RBAC_MATRIX.md ASM-32, this entity's financial fields are deliberately NOT
/// field-redacted for anyone — public catalog data, unlike Contract.value.

export interface ScholarshipMaster {
  id: string;
  scholarshipCode: string;
  provider: string;
  name: string;
  universityId: string | null;
  programId: string | null;
  eligibility: string | null;
  coverageType: string | null;
  amount: string | null;
  percentage: string | null;
  amountCurrency: string | null;
  deadline: string | null;
  requiredDocuments: string | null;
  conditions: string | null;
  source: string | null;
  sourceUrl: string | null;
  externalId: string | null;
  retrievedAt: string | null;
  syncStatus: ExternalSyncStatus;
  status: MasterDataStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScholarshipMasterListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  universityId?: string;
  programId?: string;
  status?: MasterDataStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateScholarshipMasterDto` exactly.
export interface CreateScholarshipMasterInput {
  provider: string;
  name: string;
  universityId?: string;
  programId?: string;
  eligibility?: string;
  coverageType?: string;
  amount?: number;
  percentage?: number;
  amountCurrency?: string;
  deadline?: string;
  requiredDocuments?: string;
  conditions?: string;
  status?: MasterDataStatus;
  source?: string;
}

export type UpdateScholarshipMasterInput = Partial<CreateScholarshipMasterInput>;

/// `409 DUPLICATE_SCHOLARSHIP_MASTER` shape — a single existing-record ID.
export interface DuplicateScholarshipMasterError {
  code: "DUPLICATE_SCHOLARSHIP_MASTER";
  message: string;
  existingScholarshipMasterId: string;
}
