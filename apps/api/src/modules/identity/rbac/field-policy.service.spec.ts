import { Contract, Payment, Student } from '@prisma/client';
import { FieldPolicyService } from './field-policy.service';

const BASE_STUDENT = {
  id: 's1',
  studentCode: 'HS-2026-00001',
  fullName: 'Test Student',
  dateOfBirth: null,
  email: null,
  phone: null,
  targetCountry: null,
  targetMajor: null,
  targetIntake: null,
  budget: 50000 as never,
  budgetCurrency: 'USD',
  archivedAt: null,
  portalUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Student;

const BASE_CONTRACT = {
  id: 'c1',
  contractCode: 'HD-2026-00001',
  studentId: 's1',
  templateId: null,
  mergeFieldValues: null,
  servicePackage: null,
  value: 5000 as never,
  currency: 'USD',
  status: 'DRAFT',
  version: 1,
  approvalThreshold: 3000 as never,
  submittedAt: null,
  signedAt: null,
  signedDocumentId: null,
  approvedById: null,
  approvedAt: null,
  sentAt: null,
  activatedAt: null,
  completedAt: null,
  liquidatedAt: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Contract;

const BASE_PAYMENT = {
  id: 'p1',
  paymentCode: 'PAY-2026-00001',
  contractId: 'c1',
  installmentNo: 1,
  amount: 1000 as never,
  currency: 'USD',
  dueDate: new Date(),
  paidAmount: 500 as never,
  paidDate: null,
  method: null,
  reference: null,
  status: 'PARTIALLY_PAID',
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

describe('FieldPolicyService', () => {
  const service = new FieldPolicyService();

  it.each(['EXECUTIVE_DIRECTOR', 'DEPARTMENT_MANAGER', 'CONSULTANT', 'ADMIN_FINANCE', 'STUDENT_PARENT'])(
    'keeps budget visible for %s',
    (role) => {
      const result = service.redactStudent(BASE_STUDENT, role);
      expect(result.budget).not.toBeNull();
    },
  );

  it.each(['DOCUMENT_SPECIALIST', 'SALES_MARKETING', 'SYSTEM_ADMIN'])('redacts budget for %s', (role) => {
    const result = service.redactStudent(BASE_STUDENT, role);
    expect(result.budget).toBeNull();
    expect(result.budgetCurrency).toBeNull();
  });

  it('does not mutate the original record', () => {
    service.redactStudent(BASE_STUDENT, 'SALES_MARKETING');
    expect(BASE_STUDENT.budget).not.toBeNull();
  });

  describe('canViewComment', () => {
    it('hides internal comments from STUDENT_PARENT', () => {
      expect(service.canViewComment('STUDENT_PARENT', { visibility: 'internal' })).toBe(false);
    });
    it('shows internal comments to internal roles', () => {
      expect(service.canViewComment('CONSULTANT', { visibility: 'internal' })).toBe(true);
    });
    it('shows shared comments to everyone, including STUDENT_PARENT', () => {
      expect(service.canViewComment('STUDENT_PARENT', { visibility: 'shared' })).toBe(true);
    });
  });

  describe('redactContract', () => {
    it.each(['EXECUTIVE_DIRECTOR', 'DEPARTMENT_MANAGER', 'ADMIN_FINANCE', 'STUDENT_PARENT'])(
      'keeps value/currency visible for %s',
      (role) => {
        const result = service.redactContract(BASE_CONTRACT, role);
        expect(result.value).not.toBeNull();
        expect(result.currency).not.toBeNull();
      },
    );

    it.each(['CONSULTANT', 'DOCUMENT_SPECIALIST', 'SALES_MARKETING', 'SYSTEM_ADMIN'])('redacts value/currency/approvalThreshold for %s', (role) => {
      const result = service.redactContract(BASE_CONTRACT, role);
      expect(result.value).toBeNull();
      expect(result.currency).toBeNull();
      expect(result.approvalThreshold).toBeNull();
      // Non-financial fields (status, servicePackage, ids) are unaffected.
      expect(result.status).toBe('DRAFT');
      expect(result.contractCode).toBe('HD-2026-00001');
    });

    it('does not mutate the original record', () => {
      service.redactContract(BASE_CONTRACT, 'CONSULTANT');
      expect(BASE_CONTRACT.value).not.toBeNull();
    });
  });

  describe('redactPayment', () => {
    it.each(['EXECUTIVE_DIRECTOR', 'DEPARTMENT_MANAGER', 'ADMIN_FINANCE', 'STUDENT_PARENT'])(
      'keeps amount/paidAmount visible for %s',
      (role) => {
        const result = service.redactPayment(BASE_PAYMENT, role);
        expect(result.amount).not.toBeNull();
        expect(result.paidAmount).not.toBeNull();
      },
    );

    it.each(['CONSULTANT', 'DOCUMENT_SPECIALIST', 'SALES_MARKETING', 'SYSTEM_ADMIN'])(
      'redacts amount/currency/paidAmount/refundedAmount for %s',
      (role) => {
        const result = service.redactPayment(BASE_PAYMENT, role);
        expect(result.amount).toBeNull();
        expect(result.currency).toBeNull();
        expect(result.paidAmount).toBeNull();
        expect(result.refundedAmount).toBeNull();
        expect(result.status).toBe('PARTIALLY_PAID');
      },
    );

    it('does not mutate the original record', () => {
      service.redactPayment(BASE_PAYMENT, 'SALES_MARKETING');
      expect(BASE_PAYMENT.amount).not.toBeNull();
    });
  });
});
