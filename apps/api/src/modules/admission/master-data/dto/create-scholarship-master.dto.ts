import { IsDateString, IsIn, IsISO4217CurrencyCode, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MaxLength, MinLength } from 'class-validator';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

/// 08-admission/01_MASTER_DATA.md ScholarshipMaster field list — a master definition,
/// never created per-student (see ScholarshipApplication for the per-student transaction).
/// `universityId`/`programId` both optional — a scholarship ties to a specific Program OR
/// to a University generally; at least a business-level convention, not DB-enforced.
export class CreateScholarshipMasterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  provider!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsUUID()
  universityId?: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsString()
  eligibility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  coverageType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  amountCurrency?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  requiredDocuments?: string;

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;
}
