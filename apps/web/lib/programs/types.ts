import type { MasterDataStatus, ExternalSyncStatus } from "../universities/types";

/// Mirrors `database/schema.prisma` `Program` + the University-summary embed added in
/// `apps/api/src/modules/admission/master-data/programs.service.ts` (docs/DECISIONS.md
/// DEC-11 — mirrors DEC-09/DEC-10 exactly). `tuition`/`applicationFee` are Decimal fields —
/// Prisma serializes them as JSON strings, typed `string` here deliberately, never `number`
/// (never used in any frontend calculation — display via `formatMoney` only). Per
/// `docs/ASSUMPTIONS.md`, `applicationFee` shares `tuitionCurrency` — there is no separate
/// `applicationFeeCurrency` field, by design.

export interface ProgramUniversitySummary {
  id: string;
  officialName: string;
  countryCode: string;
}

/// Shared shape for the Program(+University) embed added to Application/UniversityChoice
/// list/detail responses (DEC-11) — reused by `lib/university-choices/types.ts` and
/// `lib/applications/types.ts` rather than each redeclaring an identical shape.
export interface ProgramSummary {
  id: string;
  degreeLevel: string;
  major: string;
  university: ProgramUniversitySummary;
}

export interface Program {
  id: string;
  programCode: string;
  universityId: string;
  university: ProgramUniversitySummary;
  degreeLevel: string;
  major: string;
  intake: string | null;
  durationMonths: number | null;
  tuition: string | null;
  tuitionCurrency: string | null;
  applicationFee: string | null;
  eligibility: string | null;
  requirements: string | null;
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

export interface ProgramListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  universityId?: string;
  degreeLevel?: string;
  status?: MasterDataStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateProgramDto` exactly. `universityId` is a real FK — never a duplicated
/// university-name string (F05 instruction §9).
export interface CreateProgramInput {
  universityId: string;
  degreeLevel: string;
  major: string;
  intake?: string;
  durationMonths?: number;
  tuition?: number;
  tuitionCurrency?: string;
  applicationFee?: number;
  eligibility?: string;
  requirements?: string;
  status?: MasterDataStatus;
  source?: string;
}

export type UpdateProgramInput = Partial<CreateProgramInput>;

/// `409 DUPLICATE_PROGRAM` shape — a single existing-record ID, never a candidates array.
export interface DuplicateProgramError {
  code: "DUPLICATE_PROGRAM";
  message: string;
  existingProgramId: string;
}
