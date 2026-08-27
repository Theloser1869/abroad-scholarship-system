import { Case } from '@prisma/client';
import { ScopeKind } from '../../identity/rbac/scope-policy.service';
import { ClosureService } from './closure.service';

const BASE_CASE: Case = {
  id: 'case-1',
  caseCode: 'CASE-2026-00001',
  studentId: 'student-1',
  contractId: null,
  ownerId: 'owner-1',
  department: null,
  stage: 'CLOSURE',
  status: 'ACTIVE',
  closureReason: null,
  openedAt: new Date(),
  closedAt: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildService() {
  const prismaBase = {
    case: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ ...BASE_CASE, status: 'CLOSED' }) },
    caseMember: { findUnique: jest.fn() },
    contract: { findUnique: jest.fn(), update: jest.fn() },
    closureHandoverRecord: { findUnique: jest.fn(), upsert: jest.fn() },
    liquidationConfirmation: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  };
  // `$transaction` hands the same mocked sub-objects back as `tx` — mutations to
  // e.g. `prisma.contract.update` are visible inside the transaction callback too, since
  // they're the same jest.fn() references either way.
  const prisma = { ...prismaBase, $transaction: jest.fn((cb: (tx: typeof prismaBase) => unknown) => cb(prismaBase)) };
  const scope = { scopeKindFor: jest.fn().mockReturnValue(ScopeKind.NONE) };
  const payments = { hasOutstandingDebtForCase: jest.fn().mockResolvedValue(false) };
  const visaStatus = {
    getClosureStatus: jest.fn().mockResolvedValue('NOT_APPLICABLE'),
    hasUnconfirmedRequiredEnrollment: jest.fn().mockResolvedValue(false),
    hasIncompletePreDepartureChecklist: jest.fn().mockResolvedValue(false),
  };
  const tasks = { countOpenForCase: jest.fn().mockResolvedValue(0) };
  const comments = { create: jest.fn() };

  const service = new ClosureService(prisma as never, scope as never, payments as never, visaStatus as never, tasks as never, comments as never);
  return { service, prisma, scope, payments, visaStatus, tasks, comments };
}

const ADMIN_FINANCE = { userId: 'hcth-1', roleCode: 'ADMIN_FINANCE', sessionId: 's1' };
const EXECUTIVE_DIRECTOR = { userId: 'ed-1', roleCode: 'EXECUTIVE_DIRECTOR', sessionId: 's2' };
const CONSULTANT = { userId: 'consultant-1', roleCode: 'CONSULTANT', sessionId: 's3' };

describe('ClosureService', () => {
  describe('buildStatus (checklist tri-state)', () => {
    it('reports every item PASS and readyToClose=true when nothing is outstanding and handover is COMPLETED', async () => {
      const { service, prisma } = buildService();
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue({ status: 'COMPLETED', handedOverAt: new Date(), recipientName: 'Mẹ học sinh', notes: null });
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);

      const status = await service.getStatusForCase('case-1');

      expect(status.checklist).toEqual([
        { key: 'DEBT', status: 'PASS' },
        { key: 'OPEN_TASKS', status: 'PASS', detail: undefined },
        { key: 'VISA', status: 'NOT_APPLICABLE' },
        { key: 'ENROLLMENT', status: 'PASS' },
        { key: 'PRE_DEPARTURE', status: 'PASS' },
        { key: 'DOCUMENT_HANDOVER', status: 'PASS' },
      ]);
      expect(status.readyToClose).toBe(true);
    });

    it('document handover is FAIL (never auto-NOT_APPLICABLE) when no handover record exists yet', async () => {
      const { service, prisma } = buildService();
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);

      const status = await service.getStatusForCase('case-1');
      const handoverItem = status.checklist.find((i) => i.key === 'DOCUMENT_HANDOVER');
      expect(handoverItem?.status).toBe('FAIL');
      expect(status.readyToClose).toBe(false);
    });

    it('document handover is FAIL while PENDING, even with a row present', async () => {
      const { service, prisma } = buildService();
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue({ status: 'PENDING', handedOverAt: null, recipientName: null, notes: null });
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);

      const status = await service.getStatusForCase('case-1');
      expect(status.checklist.find((i) => i.key === 'DOCUMENT_HANDOVER')?.status).toBe('FAIL');
    });

    it('reports OPEN_TASKS as FAIL with a detail count when tasks remain open', async () => {
      const { service, prisma, tasks } = buildService();
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue({ status: 'COMPLETED' });
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);
      tasks.countOpenForCase.mockResolvedValue(3);

      const status = await service.getStatusForCase('case-1');
      expect(status.checklist.find((i) => i.key === 'OPEN_TASKS')).toEqual({
        key: 'OPEN_TASKS',
        status: 'FAIL',
        detail: '3 task(s) on this case are not Done/Cancelled — resolve them before closing.',
      });
      expect(status.readyToClose).toBe(false);
    });

    it('passes through VISA as NOT_APPLICABLE without failing readiness, unlike every other item', async () => {
      const { service, prisma, visaStatus } = buildService();
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue({ status: 'COMPLETED' });
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);
      visaStatus.getClosureStatus.mockResolvedValue('NOT_APPLICABLE');

      const status = await service.getStatusForCase('case-1');
      expect(status.checklist.find((i) => i.key === 'VISA')?.status).toBe('NOT_APPLICABLE');
      expect(status.readyToClose).toBe(true);
    });

    it('fails readiness when VISA is FAIL (an open visa)', async () => {
      const { service, prisma, visaStatus } = buildService();
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue({ status: 'COMPLETED' });
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);
      visaStatus.getClosureStatus.mockResolvedValue('FAIL');

      const status = await service.getStatusForCase('case-1');
      expect(status.readyToClose).toBe(false);
    });
  });

  describe('authorization (assertClosureAccessible)', () => {
    it('allows a GLOBAL-scope role (EXECUTIVE_DIRECTOR) to view any case', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.GLOBAL);
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);

      await expect(service.getChecklist(EXECUTIVE_DIRECTOR, 'case-1')).resolves.toBeDefined();
    });

    it('allows ADMIN_FINANCE (HCTH) even though its general Case scope is NONE', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.NONE);
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);

      await expect(service.getChecklist(ADMIN_FINANCE, 'case-1')).resolves.toBeDefined();
    });

    it('allows a CONSULTANT who is the case OWNER member to view/request', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.CASE_MEMBER);
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.caseMember.findUnique.mockResolvedValue({ role: 'OWNER', removedAt: null });
      prisma.closureHandoverRecord.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);

      await expect(service.getChecklist(CONSULTANT, 'case-1')).resolves.toBeDefined();

      await service.requestClosure(CONSULTANT, 'case-1', { reason: 'Đã hoàn tất mọi việc.' });
    });

    it('denies a CONSULTANT who is only a COLLABORATOR (not OWNER) on the case', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.CASE_MEMBER);
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.caseMember.findUnique.mockResolvedValue({ role: 'COLLABORATOR', removedAt: null });

      await expect(service.getChecklist(CONSULTANT, 'case-1')).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('requestClosure (advisory only)', () => {
    it('never touches Case.status or the checklist — purely writes an internal Comment', async () => {
      const { service, prisma, scope, comments } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.CASE_MEMBER);
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.caseMember.findUnique.mockResolvedValue({ role: 'OWNER', removedAt: null });

      await service.requestClosure(CONSULTANT, 'case-1', { reason: 'Đã sẵn sàng đóng hồ sơ.' });

      expect(comments.create).toHaveBeenCalledWith('Case', 'case-1', 'consultant-1', '[Đề nghị đóng hồ sơ] Đã sẵn sàng đóng hồ sơ.', 'internal');
      expect(prisma.case.update).not.toHaveBeenCalled();
    });
  });

  describe('close (DEC-06 + DEC-07)', () => {
    function mockAllPass(prisma: ReturnType<typeof buildService>['prisma'], record: Case = BASE_CASE) {
      prisma.case.findUnique.mockResolvedValue(record);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue({ status: 'COMPLETED' });
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);
    }

    it('HCTH can close when every mandatory condition passes (standard path, no overrideReason needed)', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.NONE);
      mockAllPass(prisma);

      const result = await service.close(ADMIN_FINANCE, 'case-1', { closureReason: 'Đã hoàn tất toàn bộ dịch vụ.' });

      expect(result).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rejects EXECUTIVE_DIRECTOR closing without an overrideReason (cannot use the standard path)', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.GLOBAL);
      mockAllPass(prisma);

      await expect(service.close(EXECUTIVE_DIRECTOR, 'case-1', { closureReason: 'Đã hoàn tất.' })).rejects.toMatchObject({
        response: { code: 'OVERRIDE_REASON_REQUIRED' },
      });
    });

    it('allows EXECUTIVE_DIRECTOR to close via the audited override once overrideReason is given — checklist is still fully enforced', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.GLOBAL);
      mockAllPass(prisma);

      const result = await service.close(EXECUTIVE_DIRECTOR, 'case-1', {
        closureReason: 'Đã hoàn tất.',
        overrideReason: 'HCTH nghỉ phép, GĐĐH xử lý thay.',
      });

      expect(result).toBeDefined();
    });

    it('denies CONSULTANT from closing at all (only request is granted at the RBAC layer, but the service also rejects)', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.CASE_MEMBER);
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.caseMember.findUnique.mockResolvedValue({ role: 'OWNER', removedAt: null });

      await expect(service.close(CONSULTANT, 'case-1', { closureReason: 'Xong rồi.' })).rejects.toMatchObject({ status: 403 });
    });

    it('rejects closing when the DEBT precondition fails, even for an override', async () => {
      const { service, prisma, scope, payments } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.GLOBAL);
      mockAllPass(prisma);
      payments.hasOutstandingDebtForCase.mockResolvedValue(true);

      await expect(
        service.close(EXECUTIVE_DIRECTOR, 'case-1', { closureReason: 'x', overrideReason: 'y' }),
      ).rejects.toMatchObject({ response: { code: 'OUTSTANDING_DEBT_REMAINS' } });
    });

    it('rejects closing when DOCUMENT_HANDOVER has not been confirmed, even for an override', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.GLOBAL);
      prisma.case.findUnique.mockResolvedValue(BASE_CASE);
      prisma.closureHandoverRecord.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);

      await expect(
        service.close(EXECUTIVE_DIRECTOR, 'case-1', { closureReason: 'x', overrideReason: 'y' }),
      ).rejects.toMatchObject({ response: { code: 'DOCUMENT_HANDOVER_INCOMPLETE' } });
    });

    it('synchronizes a linked ACTIVE Contract to COMPLETED in the same transaction', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.NONE);
      const linkedCase = { ...BASE_CASE, contractId: 'contract-1' };
      mockAllPass(prisma, linkedCase);
      prisma.contract.findUnique.mockResolvedValue({ id: 'contract-1', status: 'ACTIVE' });
      prisma.case.update = jest.fn().mockResolvedValue({ ...linkedCase, status: 'CLOSED' });

      await service.close(ADMIN_FINANCE, 'case-1', { closureReason: 'Đã hoàn tất.' });

      expect(prisma.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
    });
  });

  describe('liquidation (DEC-08, two-party, immutable)', () => {
    function closedCase(overrides: Partial<Case> = {}): Case {
      return { ...BASE_CASE, status: 'CLOSED', contractId: null, ...overrides };
    }

    it('records the company side but does not liquidate until the student/parent side also confirms', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.NONE);
      prisma.case.findUnique.mockResolvedValue(closedCase());
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.upsert.mockResolvedValue({ status: 'PENDING', companyConfirmedAt: new Date(), studentParentConfirmedAt: null });

      const result = await service.confirmLiquidationCompany(ADMIN_FINANCE, 'case-1', {});

      expect(result.status).toBe('PENDING');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('finalizes to LIQUIDATED (and syncs a COMPLETED Contract) once both sides have confirmed', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.NONE);
      const record = closedCase({ contractId: 'contract-1' });
      prisma.case.findUnique.mockResolvedValue(record);
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.upsert.mockResolvedValue({
        status: 'PENDING',
        companyConfirmedAt: new Date(),
        studentParentConfirmedAt: new Date(),
      });
      prisma.liquidationConfirmation.update.mockResolvedValue({ status: 'LIQUIDATED', liquidatedAt: new Date() });
      prisma.contract.findUnique.mockResolvedValue({ id: 'contract-1', status: 'COMPLETED', closureReason: null });

      const result = await service.confirmLiquidationCompany(ADMIN_FINANCE, 'case-1', {});

      expect(result.status).toBe('LIQUIDATED');
      expect(prisma.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        data: expect.objectContaining({ status: 'LIQUIDATED', liquidatedAt: expect.any(Date) }),
      });
    });

    it('rejects confirming before the case is CLOSED', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.NONE);
      prisma.case.findUnique.mockResolvedValue({ ...BASE_CASE, status: 'ACTIVE' });

      await expect(service.confirmLiquidationCompany(ADMIN_FINANCE, 'case-1', {})).rejects.toMatchObject({
        response: { code: 'CASE_NOT_CLOSED' },
      });
    });

    it('rejects any further confirmation once already LIQUIDATED — immutable', async () => {
      const { service, prisma, scope } = buildService();
      scope.scopeKindFor.mockReturnValue(ScopeKind.NONE);
      prisma.case.findUnique.mockResolvedValue(closedCase());
      prisma.liquidationConfirmation.findUnique.mockResolvedValue({ status: 'LIQUIDATED' });

      await expect(service.confirmLiquidationCompany(ADMIN_FINANCE, 'case-1', {})).rejects.toMatchObject({
        response: { code: 'ALREADY_LIQUIDATED' },
      });
    });

    it('the student/parent side (portal) confirms independently of any staff role check', async () => {
      const { service, prisma } = buildService();
      const record = closedCase();
      prisma.case.findUnique.mockResolvedValue(record);
      prisma.liquidationConfirmation.findUnique.mockResolvedValue(null);
      prisma.liquidationConfirmation.upsert.mockResolvedValue({ status: 'PENDING', companyConfirmedAt: null, studentParentConfirmedAt: new Date() });

      const studentPrincipal = { userId: 'student-user-1', roleCode: 'STUDENT_PARENT', sessionId: 's4' };
      const result = await service.confirmLiquidationStudentParent('case-1', studentPrincipal);

      expect(result.status).toBe('PENDING');
      expect(prisma.liquidationConfirmation.upsert).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        create: { caseId: 'case-1', studentParentConfirmedAt: expect.any(Date), studentParentConfirmedById: 'student-user-1' },
        update: { studentParentConfirmedAt: expect.any(Date), studentParentConfirmedById: 'student-user-1' },
      });
    });
  });
});
