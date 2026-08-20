import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// 07-profile/01_ASSESSMENT_ROADMAP.md criterion fields. `area` is free text (Academic/
/// English/Test/Research/Competition/Leadership/Community/Awards/Writing are suggested,
/// not enforced — same configurable-field precedent as `Case.stage`), the natural key
/// within one assessment (`@@unique([assessmentId, area])`) — upserting the same area
/// again updates that row rather than creating a duplicate.
export class UpsertCriterionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  area!: string;

  @IsOptional()
  @IsNumber()
  currentScore?: number;

  @IsOptional()
  @IsNumber()
  targetScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendation?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
