import { Payment } from '@prisma/client';
import { PaymentsService } from './payments.service';

const BASE_PAYMENT = {
  id: 'p1',
  paymentCode: 'PAY-2026-00001',
  contractId: 'c1',
  installmentNo: 1,
  amount: 1000 as never,
  currency: 'USD',
  dueDate: new Date('2026-06-01T00:00:00Z'),
  paidAmount: 0 as never,
  paidDate: null,
  method: null,
  reference: null,
  status: 'PENDING',
  receiptDocumentId: null,
  refundedAmount: 0 as never,
  refundedAt: null,
  refundedById: null,
  refundReason: null,
  waivedAt: null,
  waivedById: null,
  waivedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Payment;

/// `isOverdue`/`outstandingAmount` are the two pure calculations 05-commercial rule
/// "Overdue phải được xác định nhất quán" and rule #6 (no silent negative-balance
/// overpayment) hinge on — every read path in PaymentsService funnels through these two
/// functions rather than re-deriving the numbers inline, so they're tested directly here
/// rather than only indirectly through e2e (mirrors FieldPolicyService/ScopePolicyService
/// unit-test treatment of this codebase's other pure policy logic).
describe('PaymentsService', () => {
  const service = new PaymentsService({} as never, {} as never, {} as never, {} as never);

  describe('isOverdue', () => {
    it('is false for a PENDING payment whose due date is in the future', () => {
      expect(service.isOverdue({ status: 'PENDING', dueDate: new Date(Date.now() + 86_400_000) })).toBe(false);
    });

    it('is true for a PENDING payment whose due date has passed', () => {
      expect(service.isOverdue({ status: 'PENDING', dueDate: new Date(Date.now() - 86_400_000) })).toBe(true);
    });

    it('is true for a PARTIALLY_PAID payment whose due date has passed', () => {
      expect(service.isOverdue({ status: 'PARTIALLY_PAID', dueDate: new Date(Date.now() - 86_400_000) })).toBe(true);
    });

    it('is true for a payment already marked OVERDUE whose due date has passed', () => {
      expect(service.isOverdue({ status: 'OVERDUE', dueDate: new Date(Date.now() - 86_400_000) })).toBe(true);
    });

    it.each(['PAID', 'REFUNDED', 'WAIVED'] as const)('is false for a resolved (%s) payment even if the due date has passed', (status) => {
      expect(service.isOverdue({ status, dueDate: new Date(Date.now() - 86_400_000) })).toBe(false);
    });
  });

  describe('outstandingAmount', () => {
    it('equals the full amount when nothing has been paid', () => {
      expect(service.outstandingAmount({ ...BASE_PAYMENT, amount: 1000 as never, paidAmount: 0 as never, refundedAmount: 0 as never }).toNumber()).toBe(1000);
    });

    it('subtracts partial payment from the amount', () => {
      expect(
        service.outstandingAmount({ ...BASE_PAYMENT, amount: 1000 as never, paidAmount: 400 as never, refundedAmount: 0 as never }).toNumber(),
      ).toBe(600);
    });

    it('is zero (never negative) once fully paid', () => {
      expect(
        service.outstandingAmount({ ...BASE_PAYMENT, amount: 1000 as never, paidAmount: 1000 as never, refundedAmount: 0 as never }).toNumber(),
      ).toBe(0);
    });

    it('is zero, not negative, when an allowed overpayment exceeds the amount', () => {
      expect(
        service.outstandingAmount({ ...BASE_PAYMENT, amount: 1000 as never, paidAmount: 1200 as never, refundedAmount: 0 as never }).toNumber(),
      ).toBe(0);
    });

    it('adds a refund back onto the outstanding balance (net-paid, not gross-paid)', () => {
      expect(
        service.outstandingAmount({ ...BASE_PAYMENT, amount: 1000 as never, paidAmount: 1000 as never, refundedAmount: 300 as never }).toNumber(),
      ).toBe(300);
    });
  });

  describe('withComputed', () => {
    it('attaches outstandingAmount and isOverdue derived from the same two functions', () => {
      const payment = { ...BASE_PAYMENT, amount: 1000 as never, paidAmount: 250 as never, dueDate: new Date(Date.now() - 86_400_000) };
      const result = service.withComputed(payment);
      expect(result.outstandingAmount).toBe('750');
      expect(result.isOverdue).toBe(true);
    });
  });
});
