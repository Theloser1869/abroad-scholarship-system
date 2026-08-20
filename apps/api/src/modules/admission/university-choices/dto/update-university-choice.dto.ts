import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const TIERS = ['REACH', 'MATCH', 'SAFETY'] as const;
const STATUSES = ['PROPOSED', 'SHORTLISTED', 'CONFIRMED', 'REMOVED'] as const;

/// Editable fields only — `programId`/`caseId` are identity-establishing and not
/// re-pointable after creation (propose a new choice instead of re-parenting one).
export class UpdateUniversityChoiceDto {
  @IsOptional()
  @IsIn(TIERS)
  tier?: (typeof TIERS)[number];

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
