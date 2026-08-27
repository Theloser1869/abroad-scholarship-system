import { CaseStage } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

/// SRS 6.2 duplicate-detection + merge confirmation flow. First call with no
/// `confirmMatch` — if DuplicateDetectionService finds candidates, the endpoint responds
/// `409 DUPLICATE_STUDENT_CANDIDATES` with the candidate list instead of creating
/// anything; the caller re-submits with an explicit decision.
export class ConvertLeadDto {
  /// Used both for the new-Student record (if created) and as duplicate-match input
  /// (name+DOB — SRS 6.2/04_LEAD.md). Optional on the dry-run call, but required for the
  /// decision to be duplicate-detected on name+DOB at all — omitting it just means that
  /// particular match rule contributes nothing (email/phone matching still applies).
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['MERGE', 'CREATE_NEW'])
  confirmMatch?: 'MERGE' | 'CREATE_NEW';

  @IsOptional()
  @IsUUID()
  mergeIntoStudentId?: string;

  @IsOptional()
  @IsUUID()
  caseOwnerId?: string;

  @IsOptional()
  @IsEnum(CaseStage)
  caseStage?: CaseStage;
}
