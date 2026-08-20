import { NotFoundException } from '@nestjs/common';
import { ScopeKind, ScopePolicyService } from './scope-policy.service';
import { Principal } from '../../../common/context/principal';

function principal(roleCode: string, userId = 'u1'): Principal {
  return { userId, roleCode, sessionId: 's1' };
}

describe('ScopePolicyService', () => {
  const caseMemberFindFirst = jest.fn();
  const studentFindUnique = jest.fn();
  const caseFindUnique = jest.fn();
  const leadFindUnique = jest.fn();
  const contractFindUnique = jest.fn();
  const paymentFindUnique = jest.fn();
  const taskFindUnique = jest.fn();
  const prisma = {
    caseMember: { findFirst: caseMemberFindFirst },
    student: { findUnique: studentFindUnique },
    case: { findUnique: caseFindUnique },
    lead: { findUnique: leadFindUnique },
    contract: { findUnique: contractFindUnique },
    payment: { findUnique: paymentFindUnique },
    task: { findUnique: taskFindUnique },
  };
  const service = new ScopePolicyService(prisma as never);

  beforeEach(() => {
    caseMemberFindFirst.mockReset();
    studentFindUnique.mockReset();
    caseFindUnique.mockReset();
    leadFindUnique.mockReset();
    contractFindUnique.mockReset();
    paymentFindUnique.mockReset();
    taskFindUnique.mockReset();
  });

  describe('scopeKindFor', () => {
    it.each([
      ['EXECUTIVE_DIRECTOR', ScopeKind.GLOBAL],
      ['DEPARTMENT_MANAGER', ScopeKind.GLOBAL],
      ['CONSULTANT', ScopeKind.CASE_MEMBER],
      ['DOCUMENT_SPECIALIST', ScopeKind.CASE_MEMBER],
      ['SALES_MARKETING', ScopeKind.NONE],
      ['ADMIN_FINANCE', ScopeKind.NONE],
      ['STUDENT_PARENT', ScopeKind.OWN_STUDENT],
      ['SYSTEM_ADMIN', ScopeKind.NONE],
    ])('%s -> %s', (role, expected) => {
      expect(service.scopeKindFor(role)).toBe(expected);
    });
  });

  describe('assertStudentAccessible', () => {
    it('allows GLOBAL scope without any DB lookup', async () => {
      await expect(service.assertStudentAccessible(principal('EXECUTIVE_DIRECTOR'), 'student-1')).resolves.toBeUndefined();
      expect(studentFindUnique).not.toHaveBeenCalled();
      expect(caseMemberFindFirst).not.toHaveBeenCalled();
    });

    it('denies NONE scope without any DB lookup (404, not 403)', async () => {
      await expect(service.assertStudentAccessible(principal('SALES_MARKETING'), 'student-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(studentFindUnique).not.toHaveBeenCalled();
    });

    it('allows CASE_MEMBER scope when the caller is a member of a case on that student', async () => {
      caseMemberFindFirst.mockResolvedValue({ caseId: 'c1', userId: 'u1' });
      await expect(service.assertStudentAccessible(principal('CONSULTANT'), 'student-1')).resolves.toBeUndefined();
    });

    it('denies CASE_MEMBER scope when the caller is not a member of any case on that student', async () => {
      caseMemberFindFirst.mockResolvedValue(null);
      await expect(service.assertStudentAccessible(principal('CONSULTANT'), 'student-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows OWN_STUDENT scope for the linked student self', async () => {
      studentFindUnique.mockResolvedValue({ portalUserId: 'u1', contacts: [] });
      await expect(service.assertStudentAccessible(principal('STUDENT_PARENT'), 'student-1')).resolves.toBeUndefined();
    });

    it('allows OWN_STUDENT scope for a linked parent contact', async () => {
      studentFindUnique.mockResolvedValue({ portalUserId: 'someone-else', contacts: [{ portalUserId: 'u1', portalStatus: 'ACTIVE' }] });
      await expect(service.assertStudentAccessible(principal('STUDENT_PARENT'), 'student-1')).resolves.toBeUndefined();
    });

    it('denies OWN_STUDENT scope for an unlinked parent/student account', async () => {
      studentFindUnique.mockResolvedValue({ portalUserId: 'someone-else', contacts: [{ portalUserId: 'yet-another', portalStatus: 'ACTIVE' }] });
      await expect(service.assertStudentAccessible(principal('STUDENT_PARENT'), 'student-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    // Phase 11 (Portal) — DEC-06/ASM-46: a REVOKED parent must lose access even though
    // `portalUserId` is still set (revocation preserves the link for history, never nulls
    // it out) — "quyền truy cập phải mất ngay theo policy."
    it('denies OWN_STUDENT scope for a REVOKED parent contact, even though portalUserId still matches', async () => {
      studentFindUnique.mockResolvedValue({ portalUserId: 'someone-else', contacts: [{ portalUserId: 'u1', portalStatus: 'REVOKED' }] });
      await expect(service.assertStudentAccessible(principal('STUDENT_PARENT'), 'student-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies OWN_STUDENT scope for an INVITED-but-not-yet-accepted parent contact', async () => {
      studentFindUnique.mockResolvedValue({ portalUserId: 'someone-else', contacts: [{ portalUserId: 'u1', portalStatus: 'INVITED' }] });
      await expect(service.assertStudentAccessible(principal('STUDENT_PARENT'), 'student-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies OWN_STUDENT scope when the student record does not exist', async () => {
      studentFindUnique.mockResolvedValue(null);
      await expect(service.assertStudentAccessible(principal('STUDENT_PARENT'), 'nonexistent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('studentListFilter', () => {
    it('returns an empty filter (no restriction) for GLOBAL scope', () => {
      expect(service.studentListFilter(principal('EXECUTIVE_DIRECTOR'))).toEqual({});
    });

    it('returns an impossible-id filter for NONE scope', () => {
      const filter = service.studentListFilter(principal('SALES_MARKETING')) as { id: string };
      expect(filter.id).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('scopes to case membership for CASE_MEMBER scope', () => {
      const filter = service.studentListFilter(principal('CONSULTANT', 'u42'));
      expect(filter).toEqual({ cases: { some: { members: { some: { userId: 'u42' } } } } });
    });

    it('scopes to self+linked-ACTIVE-parent for OWN_STUDENT scope', () => {
      const filter = service.studentListFilter(principal('STUDENT_PARENT', 'u42'));
      expect(filter).toEqual({ OR: [{ portalUserId: 'u42' }, { contacts: { some: { portalUserId: 'u42', portalStatus: 'ACTIVE' } } }] });
    });
  });

  describe('leadScopeKindFor', () => {
    it.each([
      ['EXECUTIVE_DIRECTOR', ScopeKind.GLOBAL],
      ['DEPARTMENT_MANAGER', ScopeKind.GLOBAL],
      ['SALES_MARKETING', ScopeKind.OWN_LEAD],
      ['CONSULTANT', ScopeKind.NONE],
      ['DOCUMENT_SPECIALIST', ScopeKind.NONE],
      ['ADMIN_FINANCE', ScopeKind.NONE],
      ['STUDENT_PARENT', ScopeKind.NONE],
      ['SYSTEM_ADMIN', ScopeKind.NONE],
    ])('%s -> %s', (role, expected) => {
      expect(service.leadScopeKindFor(role)).toBe(expected);
    });

    it('differs from the Student/Case scope for the same role (SALES_MARKETING)', () => {
      expect(service.scopeKindFor('SALES_MARKETING')).toBe(ScopeKind.NONE);
      expect(service.leadScopeKindFor('SALES_MARKETING')).toBe(ScopeKind.OWN_LEAD);
    });
  });

  describe('leadListFilter', () => {
    it('returns an empty filter for GLOBAL scope', () => {
      expect(service.leadListFilter(principal('EXECUTIVE_DIRECTOR'))).toEqual({});
    });

    it('scopes to ownerId for OWN_LEAD scope', () => {
      expect(service.leadListFilter(principal('SALES_MARKETING', 'u42'))).toEqual({ ownerId: 'u42' });
    });

    it('returns an impossible-id filter for NONE scope', () => {
      const filter = service.leadListFilter(principal('CONSULTANT')) as { id: string };
      expect(filter.id).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('assertLeadAccessible', () => {
    it('allows GLOBAL scope without any DB lookup', async () => {
      await expect(service.assertLeadAccessible(principal('EXECUTIVE_DIRECTOR'), 'lead-1')).resolves.toBeUndefined();
      expect(leadFindUnique).not.toHaveBeenCalled();
    });

    it('denies NONE scope without any DB lookup', async () => {
      await expect(service.assertLeadAccessible(principal('CONSULTANT'), 'lead-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(leadFindUnique).not.toHaveBeenCalled();
    });

    it('allows OWN_LEAD scope when the caller owns the lead', async () => {
      leadFindUnique.mockResolvedValue({ ownerId: 'u1' });
      await expect(service.assertLeadAccessible(principal('SALES_MARKETING', 'u1'), 'lead-1')).resolves.toBeUndefined();
    });

    it('denies OWN_LEAD scope when the caller owns a different lead', async () => {
      leadFindUnique.mockResolvedValue({ ownerId: 'someone-else' });
      await expect(service.assertLeadAccessible(principal('SALES_MARKETING', 'u1'), 'lead-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies OWN_LEAD scope when the lead does not exist', async () => {
      leadFindUnique.mockResolvedValue(null);
      await expect(service.assertLeadAccessible(principal('SALES_MARKETING', 'u1'), 'nonexistent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('contractScopeKindFor', () => {
    it.each([
      ['EXECUTIVE_DIRECTOR', ScopeKind.GLOBAL],
      ['DEPARTMENT_MANAGER', ScopeKind.GLOBAL],
      ['ADMIN_FINANCE', ScopeKind.GLOBAL],
      ['STUDENT_PARENT', ScopeKind.OWN_STUDENT],
      ['CONSULTANT', ScopeKind.NONE],
      ['DOCUMENT_SPECIALIST', ScopeKind.NONE],
      ['SALES_MARKETING', ScopeKind.NONE],
      ['SYSTEM_ADMIN', ScopeKind.NONE],
    ])('%s -> %s', (role, expected) => {
      expect(service.contractScopeKindFor(role)).toBe(expected);
    });

    it('CONSULTANT has CASE_MEMBER scope on Case but NONE on Contract — different resource, different scope', () => {
      expect(service.scopeKindFor('CONSULTANT')).toBe(ScopeKind.CASE_MEMBER);
      expect(service.contractScopeKindFor('CONSULTANT')).toBe(ScopeKind.NONE);
    });

    it('SALES_MARKETING has OWN_LEAD scope on Lead but NONE on Contract — owning Leads does not imply Contract access', () => {
      expect(service.leadScopeKindFor('SALES_MARKETING')).toBe(ScopeKind.OWN_LEAD);
      expect(service.contractScopeKindFor('SALES_MARKETING')).toBe(ScopeKind.NONE);
    });
  });

  describe('assertContractAccessible', () => {
    it('allows GLOBAL scope without any DB lookup', async () => {
      await expect(service.assertContractAccessible(principal('ADMIN_FINANCE'), 'contract-1')).resolves.toBeUndefined();
      expect(contractFindUnique).not.toHaveBeenCalled();
    });

    it('denies NONE scope without any DB lookup', async () => {
      await expect(service.assertContractAccessible(principal('CONSULTANT'), 'contract-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(contractFindUnique).not.toHaveBeenCalled();
    });

    it('allows OWN_STUDENT scope for the linked student self', async () => {
      contractFindUnique.mockResolvedValue({ student: { portalUserId: 'u1', contacts: [] } });
      await expect(service.assertContractAccessible(principal('STUDENT_PARENT', 'u1'), 'contract-1')).resolves.toBeUndefined();
    });

    it('denies OWN_STUDENT scope for an unrelated student/parent', async () => {
      contractFindUnique.mockResolvedValue({ student: { portalUserId: 'someone-else', contacts: [] } });
      await expect(service.assertContractAccessible(principal('STUDENT_PARENT', 'u1'), 'contract-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertPaymentAccessible', () => {
    it('allows GLOBAL scope without any DB lookup', async () => {
      await expect(service.assertPaymentAccessible(principal('EXECUTIVE_DIRECTOR'), 'payment-1')).resolves.toBeUndefined();
      expect(paymentFindUnique).not.toHaveBeenCalled();
    });

    it('denies NONE scope without any DB lookup', async () => {
      await expect(service.assertPaymentAccessible(principal('SALES_MARKETING'), 'payment-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentFindUnique).not.toHaveBeenCalled();
    });

    it('resolves OWN_STUDENT scope through the payment -> contract -> student chain', async () => {
      paymentFindUnique.mockResolvedValue({ contract: { student: { portalUserId: 'u1', contacts: [] } } });
      await expect(service.assertPaymentAccessible(principal('STUDENT_PARENT', 'u1'), 'payment-1')).resolves.toBeUndefined();
    });

    it('denies OWN_STUDENT scope for a payment on an unrelated contract', async () => {
      paymentFindUnique.mockResolvedValue({ contract: { student: { portalUserId: 'someone-else', contacts: [] } } });
      await expect(service.assertPaymentAccessible(principal('STUDENT_PARENT', 'u1'), 'payment-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('taskListFilter', () => {
    it('returns an empty filter for GLOBAL scope', () => {
      expect(service.taskListFilter(principal('EXECUTIVE_DIRECTOR'))).toEqual({});
    });

    it('scopes to case membership OR ownership for CASE_MEMBER scope', () => {
      const filter = service.taskListFilter(principal('CONSULTANT', 'u42'));
      expect(filter).toEqual({ OR: [{ case: { members: { some: { userId: 'u42' } } } }, { ownerId: 'u42' }] });
    });

    it('returns an impossible-id filter for NONE scope', () => {
      const filter = service.taskListFilter(principal('SALES_MARKETING')) as { id: string };
      expect(filter.id).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('returns an impossible-id filter for OWN_STUDENT scope — Task is internal staff tooling, STUDENT_PARENT is not a Task viewer (ASM-16)', () => {
      const filter = service.taskListFilter(principal('STUDENT_PARENT')) as { id: string };
      expect(filter.id).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('assertTaskAccessible', () => {
    it('allows GLOBAL scope without any DB lookup', async () => {
      await expect(service.assertTaskAccessible(principal('EXECUTIVE_DIRECTOR'), 'task-1')).resolves.toBeUndefined();
      expect(taskFindUnique).not.toHaveBeenCalled();
    });

    it('denies NONE scope without any DB lookup', async () => {
      await expect(service.assertTaskAccessible(principal('SALES_MARKETING'), 'task-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(taskFindUnique).not.toHaveBeenCalled();
    });

    it('denies OWN_STUDENT scope without any DB lookup (STUDENT_PARENT never reaches a Task)', async () => {
      await expect(service.assertTaskAccessible(principal('STUDENT_PARENT'), 'task-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(taskFindUnique).not.toHaveBeenCalled();
    });

    it('allows CASE_MEMBER scope when the caller owns the task directly, even with no case', async () => {
      taskFindUnique.mockResolvedValue({ ownerId: 'u1', caseId: null });
      await expect(service.assertTaskAccessible(principal('CONSULTANT', 'u1'), 'task-1')).resolves.toBeUndefined();
      expect(caseMemberFindFirst).not.toHaveBeenCalled();
    });

    it('allows CASE_MEMBER scope when the caller is a member of the task\'s case, even if not the owner', async () => {
      taskFindUnique.mockResolvedValue({ ownerId: 'someone-else', caseId: 'case-1' });
      caseMemberFindFirst.mockResolvedValue({ caseId: 'case-1', userId: 'u1' });
      await expect(service.assertTaskAccessible(principal('CONSULTANT', 'u1'), 'task-1')).resolves.toBeUndefined();
    });

    it('denies CASE_MEMBER scope for a case-less task the caller does not own', async () => {
      taskFindUnique.mockResolvedValue({ ownerId: 'someone-else', caseId: null });
      await expect(service.assertTaskAccessible(principal('CONSULTANT', 'u1'), 'task-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(caseMemberFindFirst).not.toHaveBeenCalled();
    });

    it('denies CASE_MEMBER scope when the caller is neither the owner nor a member of the task\'s case', async () => {
      taskFindUnique.mockResolvedValue({ ownerId: 'someone-else', caseId: 'case-1' });
      caseMemberFindFirst.mockResolvedValue(null);
      await expect(service.assertTaskAccessible(principal('CONSULTANT', 'u1'), 'task-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies CASE_MEMBER scope when the task does not exist', async () => {
      taskFindUnique.mockResolvedValue(null);
      await expect(service.assertTaskAccessible(principal('CONSULTANT', 'u1'), 'nonexistent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
