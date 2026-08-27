import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAcademicRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  school!: string;

  /// Client Acceptance Remediation DEC-05(b) (2026-08-27) — when set, `school` above is
  /// resolved server-side from this row's own name (never trusted from the client), so a
  /// value is still required here for the "school not yet in the Master list" free-text case.
  @IsOptional()
  @IsUUID()
  schoolMasterId?: string;

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
