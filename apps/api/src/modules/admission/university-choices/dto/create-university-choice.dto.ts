import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const TIERS = ['REACH', 'MATCH', 'SAFETY'] as const;

/// 08-admission/01_MASTER_DATA.md UniversityChoice field list. `studentId` comes from the
/// route (`/students/:studentId/university-choices`), never a body field — same
/// derive-from-route precedent as every Case-scoped Phase 07 create DTO.
export class CreateUniversityChoiceDto {
  @IsUUID()
  programId!: string;

  @IsIn(TIERS)
  tier!: (typeof TIERS)[number];

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
