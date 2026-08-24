/// Mirrors `database/schema.prisma` `CommissionRule`. Config data (never a fact that
/// happened — that's `CommissionTransaction`), deliberately separate from
/// `Payment`/`Contract.value`/`ScholarshipApplication.awardAmount` (SRS 6.17 "Commission
/// phải tách khỏi student payment" — no shared FK/column with any of those three, ever).
/// `percentageRate` is a fraction (0.10 = 10%), required unless `basis === 'FIXED'`;
/// `fixedAmount` required only when `basis === 'FIXED'` — the backend cross-validates this,
/// the frontend form mirrors it as a UX nicety but never substitutes for the real check
/// (F06 instruction §21: "Không tính rule match ở frontend"). `partnerProgramId` null means
/// a partner-wide rule; set means scoped to one PartnerProgram. Rule-matching/precedence
/// logic is 100% backend-internal (`CommissionRulesService.selectRuleFor`) — never exposed
/// via any endpoint, never previewed/computed client-side.

export type CommissionBasis = "CONTRACT_VALUE" | "PAYMENT_COLLECTED" | "FIXED";
export const COMMISSION_BASES: CommissionBasis[] = ["CONTRACT_VALUE", "PAYMENT_COLLECTED", "FIXED"];

export type MasterDataStatus = "ACTIVE" | "INACTIVE";

export interface CommissionRule {
  id: string;
  partnerId: string;
  partnerProgramId: string | null;
  basis: CommissionBasis;
  percentageRate: string | null;
  fixedAmount: string | null;
  currency: string;
  conditions: string | null;
  priority: number;
  effectiveDate: string | null;
  expiryDate: string | null;
  status: MasterDataStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionRuleListParams {
  page?: number;
  limit?: number;
  partnerProgramId?: string;
  basis?: CommissionBasis;
  status?: MasterDataStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateCommissionRuleDto` exactly.
export interface CreateCommissionRuleInput {
  partnerProgramId?: string;
  basis: CommissionBasis;
  percentageRate?: number;
  fixedAmount?: number;
  currency: string;
  conditions?: string;
  priority?: number;
  effectiveDate?: string;
  expiryDate?: string;
}

export type UpdateCommissionRuleInput = Partial<CreateCommissionRuleInput>;
