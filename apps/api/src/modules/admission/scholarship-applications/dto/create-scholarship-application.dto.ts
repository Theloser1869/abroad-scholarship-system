import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/// 08-admission/03_OFFER_SCHOLARSHIP.md ScholarshipApplication field list. `studentId`/
/// `caseId` come from the route (`/cases/:caseId/scholarship-applications`), derived from
/// the Case, never separately client-supplied. `applicationId` optional — a scholarship
/// can be pursued independently of any specific university Application.
export class CreateScholarshipApplicationDto {
  @IsUUID()
  scholarshipMasterId!: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsUUID()
  essayArtifactId?: string;
}
