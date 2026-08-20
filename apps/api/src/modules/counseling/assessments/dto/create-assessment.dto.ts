import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// Always creates the NEXT version for the case (v1 if none exists yet). `changeReason`
/// is required only when superseding a previously APPROVED version — validated in
/// `AssessmentsService.create` (DB-state-dependent, not expressible as a DTO decorator).
export class CreateAssessmentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  changeReason?: string;
}
