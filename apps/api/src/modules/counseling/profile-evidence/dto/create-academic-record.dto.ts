import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAcademicRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  school!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  period!: string;

  /// Client Acceptance Remediation GAP-004 (REQ-STUDENT-002) — 04_Student_Profile row5
  /// names Grade as its own field, distinct from `period`'s free-text term/year. Optional
  /// here; required-ness enforced stage-aware at Assessment approval (AssessmentsService).
  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @IsOptional()
  @IsNumber()
  gpa?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gradingScale?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
