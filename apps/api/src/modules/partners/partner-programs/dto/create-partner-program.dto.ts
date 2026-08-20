import { IsISO4217CurrencyCode, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from 'class-validator';

/// 10-partners/01_PARTNER_CRM.md PartnerProgram field list. `partnerProgramCode` is
/// server-generated. `programId` is an OPTIONAL link to an existing Admission-domain
/// `Program` master row (never a duplicated University/Program row) — see the schema
/// comment on `PartnerProgram.programId` / docs/ASSUMPTIONS.md ASM-41.
export class CreatePartnerProgramDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  degreeLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  major?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intake?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tuition?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  tuitionCurrency?: string;

  @IsOptional()
  @IsString()
  scholarshipInfo?: string;

  @IsOptional()
  @IsString()
  admissionsRule?: string;
}
