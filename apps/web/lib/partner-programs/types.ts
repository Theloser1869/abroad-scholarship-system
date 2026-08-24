import type { ProgramUniversitySummary } from "../programs/types";

/// Mirrors `database/schema.prisma` `PartnerProgram` + the Partner/Program-summary embed
/// added in `apps/api/.../partner-programs.service.ts` (docs/DECISIONS.md DEC-12). Always
/// created under an existing Partner — `programId` is an OPTIONAL real FK into the core
/// Admission `Program` master (F05), never a duplicated University/Program row (F06
/// instruction §18: "Không duplicate University/Program master").

export type MasterDataStatus = "ACTIVE" | "INACTIVE";

export interface PartnerProgramPartnerSummary {
  id: string;
  name: string;
  countryCode: string;
}

export interface PartnerProgramProgramSummary {
  id: string;
  degreeLevel: string;
  major: string;
  university: ProgramUniversitySummary;
}

export interface PartnerProgram {
  id: string;
  partnerProgramCode: string;
  partnerId: string;
  partner: PartnerProgramPartnerSummary;
  programId: string | null;
  program: PartnerProgramProgramSummary | null;
  name: string;
  degreeLevel: string | null;
  major: string | null;
  intake: string | null;
  tuition: string | null;
  tuitionCurrency: string | null;
  scholarshipInfo: string | null;
  admissionsRule: string | null;
  status: MasterDataStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerProgramListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  status?: MasterDataStatus;
  programId?: string;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreatePartnerProgramDto` exactly.
export interface CreatePartnerProgramInput {
  name: string;
  programId?: string;
  degreeLevel?: string;
  major?: string;
  intake?: string;
  tuition?: number;
  tuitionCurrency?: string;
  scholarshipInfo?: string;
  admissionsRule?: string;
}

export interface UpdatePartnerProgramInput extends Partial<CreatePartnerProgramInput> {
  status?: MasterDataStatus;
}

/// `409 DUPLICATE_PARTNER_PROGRAM` on `(partnerId, name, degreeLevel, major, intake)`.
export interface DuplicatePartnerProgramError {
  code: "DUPLICATE_PARTNER_PROGRAM";
  message: string;
  existingPartnerProgramId: string;
}
