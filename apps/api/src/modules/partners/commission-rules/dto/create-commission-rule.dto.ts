import { CommissionBasis } from '@prisma/client';
import { IsDateString, IsEnum, IsISO4217CurrencyCode, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/// 10-partners/01_PARTNER_CRM.md CommissionRule field list. `percentageRate` is a
/// fraction (0.10 = 10%), required when basis is CONTRACT_VALUE/PAYMENT_COLLECTED;
/// `fixedAmount` required when basis = FIXED — cross-checked in the service (a decorator
/// can't express "exactly one of these two, depending on a third field" cleanly). Negative
/// rates/amounts are always rejected (no business case named anywhere for one); zero is
/// allowed (a legitimate promotional/no-commission rule) — see docs/ASSUMPTIONS.md ASM-44.
export class CreateCommissionRuleDto {
  @IsOptional()
  @IsUUID()
  partnerProgramId?: string;

  @IsEnum(CommissionBasis)
  basis!: CommissionBasis;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentageRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
