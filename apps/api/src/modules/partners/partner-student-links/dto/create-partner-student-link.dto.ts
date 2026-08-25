import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// 10-partners/01_PARTNER_CRM.md Partner<->Student/Case section — a junction row, never a
/// duplicate Student/Case/Application/Partner. `linkType` is free text (Referral/Agent/
/// Sponsor/...), configurable, never a hard-coded enum.
export class CreatePartnerStudentLinkDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  /// Client Acceptance Remediation GAP-006 (REQ-PARTNER-008) — 16_Contract_Partner_Link.
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  scholarshipApplicationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  linkType!: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
