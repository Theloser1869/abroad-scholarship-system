import { IsOptional, IsUUID } from 'class-validator';

/// Allowed only while the transaction is still PENDING — corrects which
/// Student/Case/Application this commission is tied to, never the money itself.
export class UpdateCommissionTransactionLinkageDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;
}
