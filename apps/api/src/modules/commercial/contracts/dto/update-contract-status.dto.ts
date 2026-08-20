import { IsIn } from 'class-validator';

/// DRAFT/REVIEW/APPROVED/SENT/SIGNED are deliberately excluded — each has its own
/// dedicated endpoint with its own preconditions (submit/approve/reject/send/sign). This
/// generic transition only covers the simple forward moves after signing.
const MANUAL_CONTRACT_STATUSES = ['ACTIVE', 'COMPLETED', 'LIQUIDATED', 'ARCHIVED'] as const;

export class UpdateContractStatusDto {
  @IsIn(MANUAL_CONTRACT_STATUSES)
  status!: (typeof MANUAL_CONTRACT_STATUSES)[number];
}
