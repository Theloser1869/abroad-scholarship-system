import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionRule, CommissionTransaction, CommissionTransactionStatus, Partner, Prisma, Student } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult } from '../../../common/dto/list-query.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CommissionRulesService } from '../commission-rules/commission-rules.service';
import { CancelCommissionTransactionDto } from './dto/cancel-commission-transaction.dto';
import { CommissionTransactionQueryDto } from './dto/commission-transaction-query.dto';
import { CreateCommissionTransactionDto } from './dto/create-commission-transaction.dto';
import { PayCommissionTransactionDto } from './dto/pay-commission-transaction.dto';

const TERMINAL_STATUSES: CommissionTransactionStatus[] = ['PAID', 'CANCELLED'];

/// DEC-12 — mirrors DEC-09/DEC-10/DEC-11's `STUDENT_SUMMARY_SELECT` pattern exactly.
/// CommissionTransaction list/detail is core F06 UX ("Hiển thị: partner, student/case/
/// application reference") and only carried bare FKs before this. `studentId` is nullable
/// on this entity, so the embed is nullable-safe (Prisma returns `null` when the FK is
/// unset, never throws).
const PARTNER_SUMMARY_SELECT = { select: { id: true, name: true, countryCode: true } } as const;
const STUDENT_SUMMARY_SELECT = { select: { id: true, studentCode: true, fullName: true } } as const;

export type CommissionTransactionWithRelations = CommissionTransaction & {
  partner: Pick<Partner, 'id' | 'name' | 'countryCode'>;
  student: Pick<Student, 'id' | 'studentCode' | 'fullName'> | null;
};

/// 10-partners/01_PARTNER_CRM.md CommissionTransaction section. Statuses taken verbatim
/// from the orchestration prompt's own example list — PENDING -> ELIGIBLE -> CALCULATED ->
/// APPROVED -> PAYABLE -> PAID, CANCELLED reachable from any non-terminal state. Every
/// forward transition is its own dedicated action; the client never supplies a bare
/// status. `basis`/`currency` are snapshotted from the matched CommissionRule at CREATE
/// time (which rule applies is decided once); `basisAmount`/`rate`/`calculatedAmount` are
/// snapshotted at CALCULATE time (the actual money is read live from the source then) — see
/// docs/ASSUMPTIONS.md ASM-44/ASM-45. PAID and CANCELLED are both terminal: no
/// adjustment/reversal mechanism exists (not named in 10-partners/01_PARTNER_CRM.md).
@Injectable()
export class CommissionTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: CommissionRulesService,
  ) {}

  async list(query: CommissionTransactionQueryDto): Promise<PaginatedResult<CommissionTransactionWithRelations>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.CommissionTransactionWhereInput = {
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.commissionTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { partner: PARTNER_SUMMARY_SELECT, student: STUDENT_SUMMARY_SELECT },
      }),
      this.prisma.commissionTransaction.count({ where }),
    ]);
    return new PaginatedResult(data as CommissionTransactionWithRelations[], new PageMeta(page, limit, totalItems));
  }

  async listForPartner(partnerId: string, query: CommissionTransactionQueryDto): Promise<PaginatedResult<CommissionTransactionWithRelations>> {
    await this.assertPartnerExists(partnerId);
    return this.list({ ...query, partnerId });
  }

  async getById(id: string): Promise<CommissionTransactionWithRelations> {
    return this.findOrThrow(id);
  }

  /// Resolves + snapshots the matched CommissionRule (explicit `commissionRuleId` or
  /// deterministic auto-selection via `CommissionRulesService.selectRuleFor`), derives
  /// student/case/application from the source when not explicitly given, and rejects a
  /// repeat, non-cancelled transaction for the same (sourceType, sourceId, rule) — the
  /// idempotency boundary for "duplicate calculation / repeated event."
  async create(partnerId: string, dto: CreateCommissionTransactionDto): Promise<CommissionTransaction> {
    await this.assertPartnerExists(partnerId);
    const source = await this.resolveSource(dto.sourceType, dto.sourceId);

    // Phase 14 fix — `getOwnRuleOrThrow` below already confirms the CommissionRule belongs
    // to `partnerId`, but nothing previously confirmed the SOURCE (the actual
    // Student/Case this transaction attributes money to) is genuinely this partner's
    // business — an authorized finance/ED/DM actor could otherwise attribute commission to
    // Partner A for a source with no real relationship to Partner A at all (or one
    // belonging to a different Partner B), a real financial-attribution integrity gap.
    // "Commission tách khỏi student payment" still holds — this checks partner
    // *attribution*, not payment amount.
    const effectiveStudentId = dto.studentId ?? source.studentId;
    if (effectiveStudentId) {
      const link = await this.prisma.partnerStudentLink.findFirst({
        where: { partnerId, studentId: effectiveStudentId, status: 'ACTIVE' },
      });
      if (!link) {
        throw new ConflictException({
          code: 'PARTNER_STUDENT_LINK_REQUIRED',
          message: 'This partner has no active PartnerStudentLink to the source student — commission cannot be attributed to an unlinked partner.',
        });
      }
    }

    const rule = dto.commissionRuleId
      ? await this.getOwnRuleOrThrow(partnerId, dto.commissionRuleId)
      : await this.rules.selectRuleFor(partnerId, dto.partnerProgramId, new Date());
    if (!rule) {
      throw new NotFoundException({ code: 'COMMISSION_RULE_NOT_FOUND', message: 'No active commission rule matches this partner/program.' });
    }

    const duplicate = await this.prisma.commissionTransaction.findFirst({
      where: { sourceType: dto.sourceType, sourceId: dto.sourceId, commissionRuleId: rule.id, status: { notIn: ['CANCELLED'] } },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'DUPLICATE_COMMISSION_TRANSACTION',
        message: 'A commission transaction already exists for this source and rule.',
        existingTransactionId: duplicate.id,
      });
    }

    return this.prisma.commissionTransaction.create({
      data: {
        partnerId,
        commissionRuleId: rule.id,
        studentId: dto.studentId ?? source.studentId ?? undefined,
        caseId: dto.caseId ?? source.caseId ?? undefined,
        contractId: source.contractId,
        applicationId: dto.applicationId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        basis: rule.basis,
        currency: rule.currency,
      },
    });
  }

  async updateLinkage(id: string, data: { studentId?: string; caseId?: string; applicationId?: string }): Promise<CommissionTransaction> {
    const transaction = await this.findOrThrow(id);
    if (transaction.status !== 'PENDING') {
      throw new ConflictException({ code: 'COMMISSION_TRANSACTION_NOT_EDITABLE', message: 'Linkage can only be corrected while PENDING.' });
    }
    return this.prisma.commissionTransaction.update({ where: { id }, data });
  }

  /// PENDING -> ELIGIBLE. A manual staff/finance confirmation that the underlying event
  /// genuinely qualifies — same "confirm-eligibility before proceeding" precedent as
  /// `ScholarshipApplicationsService.confirmEligibility` (Phase 08); no further precondition
  /// is invented here beyond that manual call, since 10-partners/01_PARTNER_CRM.md names no
  /// concrete eligibility rule to check automatically.
  async confirmEligibility(id: string): Promise<CommissionTransaction> {
    await this.requireStatus(id, ['PENDING']);
    return this.prisma.commissionTransaction.update({ where: { id }, data: { status: 'ELIGIBLE' } });
  }

  /// ELIGIBLE -> CALCULATED. Reads the live source amount (never a duplicate outstanding/
  /// paid calculation — "Payment source of truth"), re-fetches the CommissionRule fresh
  /// (a correction to the rule's rate between create and calculate is honored), and
  /// computes the final amount using `Prisma.Decimal` arithmetic throughout (never a
  /// JS-float `Number()` round-trip) — deterministic, backend-only, never client-supplied.
  /// Safe to call twice while still ELIGIBLE: a pure recompute, not an accumulation.
  async calculate(id: string): Promise<CommissionTransaction> {
    const transaction = await this.requireStatus(id, ['ELIGIBLE']);
    if (!transaction.commissionRuleId) {
      throw new ConflictException({ code: 'COMMISSION_RULE_MISSING', message: 'This transaction has no commission rule to calculate against.' });
    }
    const rule = await this.prisma.commissionRule.findUniqueOrThrow({ where: { id: transaction.commissionRuleId } });

    let basisAmount: Prisma.Decimal | null = null;
    if (rule.basis !== 'FIXED') {
      const { amount, currency } = await this.readSourceAmount(transaction.sourceType, transaction.sourceId);
      if (currency !== rule.currency) {
        throw new ConflictException({
          code: 'CURRENCY_MISMATCH',
          message: `Rule currency (${rule.currency}) does not match the source's currency (${currency}).`,
        });
      }
      basisAmount = amount;
    }

    const calculatedAmount = this.computeAmount(rule, basisAmount);
    return this.prisma.commissionTransaction.update({
      where: { id },
      data: {
        basis: rule.basis,
        basisAmount: basisAmount ?? undefined,
        rate: rule.percentageRate ?? undefined,
        calculatedAmount,
        currency: rule.currency,
        status: 'CALCULATED',
      },
    });
  }

  /// CALCULATED -> APPROVED (manager/ED sign-off).
  async approve(id: string): Promise<CommissionTransaction> {
    await this.requireStatus(id, ['CALCULATED']);
    return this.prisma.commissionTransaction.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  /// APPROVED -> PAYABLE (finance marks ready for settlement).
  async markPayable(id: string): Promise<CommissionTransaction> {
    await this.requireStatus(id, ['APPROVED']);
    return this.prisma.commissionTransaction.update({ where: { id }, data: { status: 'PAYABLE' } });
  }

  /// PAYABLE -> PAID. Terminal — "không sửa trực tiếp nếu đã finalized/paid." No
  /// adjustment/reversal mechanism exists this phase (not named in the SRS) — see
  /// docs/ASSUMPTIONS.md ASM-45 and the corresponding RISK entry in
  /// docs/phase-status/PHASE_10.md.
  async pay(id: string, dto: PayCommissionTransactionDto): Promise<CommissionTransaction> {
    await this.requireStatus(id, ['PAYABLE']);
    return this.prisma.commissionTransaction.update({
      where: { id },
      data: { status: 'PAID', paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(), paymentReference: dto.paymentReference },
    });
  }

  /// Any non-terminal state -> CANCELLED, with a required reason. Also terminal.
  async cancel(id: string, dto: CancelCommissionTransactionDto): Promise<CommissionTransaction> {
    const transaction = await this.findOrThrow(id);
    if (TERMINAL_STATUSES.includes(transaction.status)) {
      throw new ConflictException({ code: 'COMMISSION_TRANSACTION_CLOSED', message: `This transaction is already ${transaction.status}.` });
    }
    return this.prisma.commissionTransaction.update({ where: { id }, data: { status: 'CANCELLED', reason: dto.reason } });
  }

  private computeAmount(rule: CommissionRule, basisAmount: Prisma.Decimal | null): Prisma.Decimal {
    if (rule.basis === 'FIXED') {
      return new Prisma.Decimal(rule.fixedAmount ?? 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }
    if (!basisAmount || !rule.percentageRate) {
      throw new BadRequestException({ code: 'COMMISSION_RULE_INCOMPLETE', message: 'This rule is missing a percentage rate or basis amount.' });
    }
    return basisAmount.times(rule.percentageRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  private async readSourceAmount(sourceType: string, sourceId: string | null): Promise<{ amount: Prisma.Decimal; currency: string }> {
    if (!sourceId) throw new BadRequestException({ code: 'COMMISSION_SOURCE_MISSING', message: 'This transaction has no source to read an amount from.' });
    if (sourceType === 'Contract') {
      const contract = await this.prisma.contract.findUnique({ where: { id: sourceId } });
      if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${sourceId} not found.` });
      return { amount: contract.value, currency: contract.currency };
    }
    const payment = await this.prisma.payment.findUnique({ where: { id: sourceId } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: `Payment ${sourceId} not found.` });
    return { amount: payment.paidAmount, currency: payment.currency };
  }

  /// `contractId` (Client Acceptance Remediation GAP-006) is resolved here regardless of
  /// which base this transaction actually uses — directly for `sourceType==='Contract'`,
  /// one hop via `Payment.contractId` for `sourceType==='Payment'` — so the new
  /// `CommissionTransaction.contractId` FK stays populated either way, giving a single
  /// direct join for "which contract earned this commission" without callers needing to
  /// know which base a given transaction was created against.
  private async resolveSource(sourceType: string, sourceId: string): Promise<{ studentId?: string; caseId?: string; contractId?: string }> {
    if (sourceType === 'Contract') {
      const contract = await this.prisma.contract.findUnique({ where: { id: sourceId } });
      if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${sourceId} not found.` });
      const caseRecord = await this.prisma.case.findFirst({ where: { contractId: sourceId } });
      return { studentId: contract.studentId, caseId: caseRecord?.id, contractId: contract.id };
    }
    const payment = await this.prisma.payment.findUnique({ where: { id: sourceId }, include: { contract: true } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: `Payment ${sourceId} not found.` });
    const caseRecord = await this.prisma.case.findFirst({ where: { contractId: payment.contractId } });
    return { studentId: payment.contract.studentId, caseId: caseRecord?.id, contractId: payment.contractId };
  }

  private async getOwnRuleOrThrow(partnerId: string, ruleId: string): Promise<CommissionRule> {
    const rule = await this.prisma.commissionRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.partnerId !== partnerId) {
      throw new NotFoundException({ code: 'COMMISSION_RULE_NOT_FOUND', message: `Commission rule ${ruleId} not found for this partner.` });
    }
    return rule;
  }

  private async requireStatus(id: string, allowed: CommissionTransactionStatus[]): Promise<CommissionTransaction> {
    const transaction = await this.findOrThrow(id);
    if (!allowed.includes(transaction.status)) {
      throw new ConflictException({
        code: 'INVALID_COMMISSION_TRANSACTION_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the transaction is ${transaction.status}.`,
      });
    }
    return transaction;
  }

  private async assertPartnerExists(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException({ code: 'PARTNER_NOT_FOUND', message: `Partner ${partnerId} not found.` });
  }

  private async findOrThrow(id: string): Promise<CommissionTransactionWithRelations> {
    const transaction = await this.prisma.commissionTransaction.findUnique({
      where: { id },
      include: { partner: PARTNER_SUMMARY_SELECT, student: STUDENT_SUMMARY_SELECT },
    });
    if (!transaction) throw new NotFoundException({ code: 'COMMISSION_TRANSACTION_NOT_FOUND', message: `Commission transaction ${id} not found.` });
    return transaction;
  }
}
