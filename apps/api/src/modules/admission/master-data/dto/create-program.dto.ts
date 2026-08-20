import { IsIn, IsISO4217CurrencyCode, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from 'class-validator';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

/// 08-admission/01_MASTER_DATA.md Program field list. Must reference an existing
/// University by ID — never a duplicated university name string.
export class CreateProgramDto {
  @IsUUID()
  universityId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  degreeLevel!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  major!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intake?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tuition?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  tuitionCurrency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  applicationFee?: number;

  @IsOptional()
  @IsString()
  eligibility?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;
}
