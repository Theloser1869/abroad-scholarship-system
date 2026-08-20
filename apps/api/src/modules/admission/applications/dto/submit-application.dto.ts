import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/// 08-admission/02_APPLICATION.md submission record — set once, together, on the
/// READY_FOR_REVIEW → SUBMITTED transition.
export class SubmitApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  submissionChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  submissionReference?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
