import { IsIn, IsOptional, IsUUID } from 'class-validator';

const SOURCE_TYPES = ['Contract', 'Payment', 'Visa'] as const;

/// 10-partners/01_PARTNER_CRM.md CommissionTransaction section. `sourceType`/`sourceId`
/// identify the Contract/Payment/Visa row this commission is calculated from
/// (docs/ASSUMPTIONS.md ASM-44); the underlying amount is always read live from that row at
/// `calculate()` time, never duplicated here. `Visa` (Client Acceptance Remediation DEC-09,
/// 2026-08-27) has no monetary field at all — a Visa-sourced transaction's CommissionRule
/// must be FIXED-basis (a flat fee per successful visa); `readSourceAmount` rejects any
/// other basis explicitly rather than misreading an unrelated row.
/// `studentId`/`caseId`/`applicationId` are auto-derived from the source when resolvable;
/// only pass them to override that derivation. `partnerProgramId` and `commissionRuleId`
/// both narrow which CommissionRule this transaction is scored against — see
/// `CommissionRulesService.selectRuleFor`.
export class CreateCommissionTransactionDto {
  @IsIn(SOURCE_TYPES)
  sourceType!: (typeof SOURCE_TYPES)[number];

  @IsUUID()
  sourceId!: string;

  @IsOptional()
  @IsUUID()
  partnerProgramId?: string;

  @IsOptional()
  @IsUUID()
  commissionRuleId?: string;

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
