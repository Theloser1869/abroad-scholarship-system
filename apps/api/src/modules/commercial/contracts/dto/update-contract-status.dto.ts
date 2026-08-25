import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// DRAFT/REVIEW/APPROVED/SENT/SIGNED are deliberately excluded — each has its own
/// dedicated endpoint with its own preconditions (submit/approve/reject/send/sign). This
/// generic transition only covers the simple forward moves after signing.
const MANUAL_CONTRACT_STATUSES = ['ACTIVE', 'COMPLETED', 'LIQUIDATED', 'ARCHIVED'] as const;

export class UpdateContractStatusDto {
  @IsIn(MANUAL_CONTRACT_STATUSES)
  status!: (typeof MANUAL_CONTRACT_STATUSES)[number];

  /// Client Acceptance Remediation GAP-007 — required (non-empty) when `status` is
  /// LIQUIDATED (11_Quan_ly_hop_dong row10 "Tạo biên bản thanh lý"); ignored for every
  /// other target status. Enforced server-side in ContractsService.updateStatus, not here
  /// (conditional-on-another-field requiredness isn't expressible as a class-validator
  /// decorator alone).
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}
