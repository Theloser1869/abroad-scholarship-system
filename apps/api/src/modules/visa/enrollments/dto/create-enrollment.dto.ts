import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/// 09-visa/02_PRE_DEPARTURE_ENROLLMENT.md. `studentId`/`caseId` come from the route
/// (`/cases/:caseId/enrollments`), derived from the Case. `universityId`/`programId` are
/// derived server-side from `offer.application.programId` — never separately
/// client-supplied, avoiding a possible mismatch with the Offer actually referenced.
export class CreateEnrollmentDto {
  @IsUUID()
  offerId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
