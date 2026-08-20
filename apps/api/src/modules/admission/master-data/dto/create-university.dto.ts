import { IsIn, IsISO31661Alpha2, IsOptional, IsString, IsUUID, IsUrl, MaxLength, MinLength } from 'class-validator';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

/// 08-admission/01_MASTER_DATA.md University field list. `universityCode` is
/// server-generated (`IdGeneratorService`), never client-supplied — see
/// docs/ASSUMPTIONS.md.
export class CreateUniversityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  officialName!: string;

  @IsISO31661Alpha2()
  countryCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campus?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsUrl()
  admissionsUrl?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;
}
