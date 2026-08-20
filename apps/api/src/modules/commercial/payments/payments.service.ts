import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Payment, PaymentStatus, Prisma } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { NotificationsService } from '../../notifications/notifications/notifications.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { WaivePaymentDto } from './dto/waive-payment.dto';

const SORTABLE_FIELDS = ['dueDate', 'installmentNo', 'amount', 'status'] as const;

export interface PaymentWithComputed extends Payment {
  outstandingAmount: string;
  isOverdue: boolean;
}

/// 05-commercial/02_PAYMENT.md. "Student Payment KHÔNG PHẢI Partner Commission" — nothing
/// in this service ever touches commission math (that's `CommissionTransaction`, Phase
/// 10 — docs/ASSUMPTIONS.md ASM-13).
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
    private readonly scope: ScopePolicyService,
    private readonly notifications: NotificationsService,
  ) {}

  /// "Overdue phải được xác định nhất quán" — the one place this determination happens;
  /// every read path (list filter, computed field) calls this, nothing re-derives it
  /// ad hoc. A payment already resolved (PAID/REFUNDED/WAIVED) is never overdue regardless
  /// of its due date.
  isOverdue(payment: Pick<Payment, 'status' | 'dueDate'>): boolean {
    return (payment.status === 'PENDING' || payment.status === 'PARTIALLY_PAID' || payment.status === 'OVERDUE') && payment.dueDate < new Date();
  }

  outstandingAmount(payment: Pick<Payment, 'amount' | 'paidAmount' | 'refundedAmount'>): Prisma.Decimal {
    const netPaid = Number(payment.paidAmount) - Number(payment.refundedAmount);
    const outstanding = Number(payment.amount) - netPaid;
    return new Prisma.Decimal(Math.max(outstanding, 0).toFixed(2));
  }

  withComputed(payment: Payment): PaymentWithComputed {
    return { ...payment, outstandingAmount: this.outstandingAmount(payment).toString(), isOverdue: this.isOverdue(payment) };
  }

  /// Phase 14 fix (Final Architect Review) — nothing previously stopped creating a new
  /// installment or recording a new payment against a Contract already LIQUIDATED/
  /// ARCHIVED ("financial activity on a closed-out record"). Deliberately NOT applied to
  /// refund()/waive() — see the comments on each, those remain legitimate corrective
  /// actions post-closure.
  private readonly TERMINAL_CONTRACT_STATUSES = ['LIQUIDATED', 'ARCHIVED'] as const;

  private assertContractOpenForFinancialActivity(status: string): void {
    if ((this.TERMINAL_CONTRACT_STATUSES as readonly string[]).includes(status)) {
      throw new ConflictException({
        code: 'CONTRACT_CLOSED',
        message: `This contract is ${status} — no new payment activity can be created against it.`,
      });
    }
  }

  private async assertPaymentsContractOpen(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId }, select: { status: true } });
    if (contract) this.assertContractOpenForFinancialActivity(contract.status);
  }

  /// `PaymentStatus.OVERDUE` is a real, filterable stored status (unlike `TaskStatus`,
  /// where "overdue" is display-only — see schema.prisma comment on `TaskStatus`), so it
  /// has to actually land in the DB, not just be computed at read time, or `status=OVERDUE`
  /// queries would silently return nothing. This lazily sweeps PENDING/PARTIALLY_PAID rows
  /// whose due date has passed into OVERDUE, scoped to keep the sweep cheap, right before
  /// any read that might filter or report on status.
  private async syncOverdueStatus(where: Prisma.PaymentWhereInput): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { ...where, status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
  }

  async assertContractAccessible(principal: Principal, contractId: string): Promise<void> {
    await this.scope.assertContractAccessible(principal, contractId);
  }

  async listForContract(principal: Principal, contractId: string, query: PaymentQueryDto): Promise<PaginatedResult<PaymentWithComputed>> {
    await this.scope.assertContractAccessible(principal, contractId);
    await this.syncOverdueStatus({ contractId });
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'installmentNo', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.PaymentWhereInput = {
      contractId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, totalItems] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.payment.count({ where }),
    ]);
    let data = rows.map((r) => this.withComputed(r));
    if (query.overdue !== undefined) {
      data = data.filter((p) => p.isOverdue === query.overdue);
    }
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(principal: Principal, id: string): Promise<PaymentWithComputed> {
    await this.scope.assertPaymentAccessible(principal, id);
    await this.syncOverdueStatus({ id });
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: `Payment ${id} not found.` });
    return this.withComputed(payment);
  }

  /// Payment schedule entries only make sense once a Contract's terms are final — allowed
  /// once SIGNED or later (mirrors `ContractsService.createAmendment`'s "signed at least
  /// once" gate).
  async createInstallment(contractId: string, dto: CreatePaymentDto): Promise<Payment> {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${contractId} not found.` });
    if (!contract.signedAt) {
      throw new ConflictException({ code: 'CONTRACT_NOT_YET_SIGNED', message: 'Payment schedule can only be created for a signed contract.' });
    }
    this.assertContractOpenForFinancialActivity(contract.status);
    // Phase 14 fix (Final Architect Review) — an installment could previously be created in
    // a different currency than its own Contract; no other part of the codebase treats
    // that as intentional (CommissionTransactionsService.calculate() enforces the
    // equivalent rule-vs-source currency match elsewhere), so this was an inconsistency,
    // not a deliberate "multi-currency-per-contract" stance.
    const currency = dto.currency.toUpperCase();
    if (currency !== contract.currency) {
      throw new ConflictException({
        code: 'CURRENCY_MISMATCH',
        message: `Installment currency (${currency}) must match the Contract's currency (${contract.currency}).`,
      });
    }

    const existing = await this.prisma.payment.findUnique({ where: { contractId_installmentNo: { contractId, installmentNo: dto.installmentNo } } });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_INSTALLMENT',
        message: `Installment ${dto.installmentNo} already exists for this contract.`,
        existingPaymentId: existing.id,
      });
    }

    const paymentCode = await this.idGenerator.nextYearlyCode('PAY');
    return this.prisma.payment.create({
      data: {
        paymentCode,
        contractId,
        installmentNo: dto.installmentNo,
        amount: dto.amount,
        currency,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  /// 05-commercial rules #1–#6. Idempotency-Key (via `@Idempotent()` on the controller
  /// route) covers "retried request creates a duplicate transaction"; `reference`
  /// uniqueness (DB `@unique` + this friendly pre-check) covers "the SAME external bank
  /// reference used twice" — two independent, complementary safeguards, not the same
  /// check twice.
  async recordPayment(id: string, dto: RecordPaymentDto): Promise<PaymentWithComputed> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: `Payment ${id} not found.` });
    if (payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'WAIVED') {
      throw new ConflictException({ code: 'PAYMENT_ALREADY_RESOLVED', message: `Payment is already ${payment.status} — cannot record more against it.` });
    }
    await this.assertPaymentsContractOpen(payment.contractId);

    if (dto.reference) {
      const duplicate = await this.prisma.payment.findUnique({ where: { reference: dto.reference } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({ code: 'DUPLICATE_PAYMENT_REFERENCE', message: `Reference "${dto.reference}" is already recorded on another payment.` });
      }
    }

    const newPaidAmount = Number(payment.paidAmount) + dto.amount;
    if (newPaidAmount > Number(payment.amount) && !dto.allowOverpayment) {
      throw new ConflictException({
        code: 'OVERPAYMENT_NOT_ALLOWED',
        message: `Recording ${dto.amount} would exceed the installment amount (${payment.amount}). Pass allowOverpayment: true to confirm this is intentional.`,
        outstandingBeforePayment: this.outstandingAmount(payment).toString(),
      });
    }

    // "Không tính Paid khi số tiền thực nhận chưa đủ, trừ khi policy cho phép" — PAID
    // only once the full amount (or more, with explicit allowOverpayment) is in.
    const newStatus: PaymentStatus = newPaidAmount >= Number(payment.amount) ? 'PAID' : 'PARTIALLY_PAID';

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        paidDate: dto.paidDate ? new Date(dto.paidDate) : new Date(),
        method: dto.method,
        reference: dto.reference,
        status: newStatus,
      },
    });
    return this.withComputed(updated);
  }

  /// 05-commercial rule #7 "Refund phải có liên kết tới payment gốc" — recorded ON the
  /// original Payment row (the strongest possible link: identity, not a join) — see
  /// docs/ASSUMPTIONS.md ASM-14. Cannot refund more than the net amount actually paid so
  /// far; supports partial refund (status only flips to REFUNDED once the full net-paid
  /// amount has been given back).
  async refund(principal: Principal, id: string, dto: RefundPaymentDto): Promise<PaymentWithComputed> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: `Payment ${id} not found.` });
    // Deliberately no contract-terminal-state guard here (unlike createInstallment/
    // recordPayment below) — refunding money already collected remains a legitimate
    // corrective action even after a Contract reaches LIQUIDATED/ARCHIVED (e.g. an early
    // termination settlement); only NEW financial obligations against an already-closed-out
    // contract are blocked. See docs/FINAL_ARCHITECT_REVIEW.md.

    const netPaid = Number(payment.paidAmount) - Number(payment.refundedAmount);
    if (dto.amount > netPaid) {
      throw new ConflictException({
        code: 'REFUND_EXCEEDS_NET_PAID',
        message: `Cannot refund ${dto.amount} — only ${netPaid} has been net-paid on this payment.`,
        netPaid,
      });
    }

    const newRefundedAmount = Number(payment.refundedAmount) + dto.amount;
    const fullyRefunded = newRefundedAmount >= Number(payment.paidAmount);

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        refundedAmount: newRefundedAmount,
        refundedAt: new Date(),
        refundedById: principal.userId,
        refundReason: dto.reason,
        ...(fullyRefunded ? { status: 'REFUNDED' } : {}),
      },
    });
    return this.withComputed(updated);
  }

  /// 05-commercial rule #8 "Waived phải có reason và audit" — reason is mandatory
  /// (DTO-level) and the action itself is `@Audit`-decorated at the controller. Only
  /// applies to a payment not already resolved.
  async waive(principal: Principal, id: string, dto: WaivePaymentDto): Promise<PaymentWithComputed> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: `Payment ${id} not found.` });
    if (payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'WAIVED') {
      throw new ConflictException({ code: 'PAYMENT_ALREADY_RESOLVED', message: `Payment is already ${payment.status} — cannot waive it.` });
    }
    // Deliberately no contract-terminal-state guard here — same reasoning as refund() above;
    // waiving a still-outstanding balance is itself part of how a Contract legitimately
    // reaches a resolved/closed state, not an action that only makes sense before it.

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: 'WAIVED', waivedAt: new Date(), waivedById: principal.userId, waivedReason: dto.reason },
    });
    return this.withComputed(updated);
  }

  async export(principal: Principal): Promise<{ rows: PaymentWithComputed[]; rowCount: number }> {
    const contractWhere = this.scope.contractListFilter(principal);
    await this.syncOverdueStatus({ contract: contractWhere });
    const rows = await this.prisma.payment.findMany({ where: { contract: contractWhere }, orderBy: { dueDate: 'desc' } });
    return { rows: rows.map((r) => this.withComputed(r)), rowCount: rows.length };
  }

  /// Phase 09 Closure integration — `docs/architecture/DOMAIN_MAP.md` domain 7's own
  /// stated expose-point ("DebtStatusService dùng bởi visa/case-management để chặn Closure
  /// khi còn công nợ"). Existence check, not a second outstanding-amount calculation —
  /// PENDING/PARTIALLY_PAID/OVERDUE are exactly the "not yet resolved" statuses `isOverdue`
  /// already treats as unsettled; PAID/REFUNDED/WAIVED are resolved and never block. A Case
  /// with no linked Contract at all has nothing to owe.
  async hasOutstandingDebtForCase(caseId: string): Promise<boolean> {
    const caseRecord = await this.prisma.case.findUnique({ where: { id: caseId }, select: { contractId: true } });
    if (!caseRecord?.contractId) return false;
    await this.syncOverdueStatus({ contractId: caseRecord.contractId });
    const count = await this.prisma.payment.count({
      where: { contractId: caseRecord.contractId, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
    });
    return count > 0;
  }

  /// 06-operations/02_NOTIFICATION.md "payment overdue," cadence "Overdue daily." No
  /// scheduler exists in this repo yet (docs/ASSUMPTIONS.md ASM-18) — callable domain
  /// logic, manually triggered via `POST /payments/reminders/run` in the meantime, same
  /// treatment as `TasksService.generateOverdueReminders`. Recipients = every ACTIVE user
  /// holding `payments:record` (ADMIN_FINANCE) — resolved from the permission grant, not a
  /// hard-coded role. Payload excludes `amount`/`currency` (financial fields,
  /// `FieldPolicyService.redactPayment`'s own field set) — same "reference by id, not by
  /// value" rule already applied to the Contract-approval-request notification.
  async generateOverdueReminders(): Promise<number> {
    await this.syncOverdueStatus({});
    const overduePayments = await this.prisma.payment.findMany({ where: { status: 'OVERDUE' } });
    const recipients = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', role: { rolePermissions: { some: { permission: { resource: 'payments', action: 'record' } } } } },
    });
    const today = new Date().toISOString().slice(0, 10);

    let sent = 0;
    for (const payment of overduePayments) {
      for (const recipient of recipients) {
        await this.notifications.notifyBothChannels(
          recipient.id,
          'PAYMENT_OVERDUE_REMINDER',
          { paymentId: payment.id, paymentCode: payment.paymentCode, contractId: payment.contractId, installmentNo: payment.installmentNo, dueDate: payment.dueDate },
          `payment-overdue:${payment.id}:${recipient.id}:${today}`,
        );
        sent += 1;
      }
    }
    return sent;
  }
}
