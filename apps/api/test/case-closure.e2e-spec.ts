import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { createTestUser } from './helpers/create-test-user';
import { issueTestSession } from './helpers/issue-session';

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014, 2026-08-26) — the
/// unified Closure/Liquidation workflow (`ClosureService`, `/cases/:id/closure/*`,
/// `/portal/students/:id/closure/*`). DEC-07's individual checklist preconditions (debt,
/// tasks, visa, enrollment, pre-departure) are already covered end-to-end in
/// `pre-departure-enrollment-closure.e2e-spec.ts`; this file covers what that one doesn't:
/// DEC-06 role gating (standard HCTH path vs. audited ED/DM override vs. CONSULTANT
/// request-only), DEC-07's Visa NOT_APPLICABLE handling and the Document Handover
/// precondition itself, and DEC-08's two-party liquidation confirmation + immutability.
describe('Unified Closure/Liquidation workflow (e2e) — DEC-06/07/08', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let managerToken: string;
  let financeToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let salesToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    ({ token: directorToken } = await issueTestSession(prisma, 'demo.director'));
    ({ token: managerToken } = await issueTestSession(prisma, 'demo.manager'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: consultantAToken, userId: consultantAId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
  });

  const consultantCaseIds: string[] = [];

  afterAll(async () => {
    if (consultantCaseIds.length > 0) {
      await prisma.caseMember.deleteMany({ where: { userId: consultantAId, caseId: { in: consultantCaseIds } } });
    }
    await app.close();
  });

  async function createCaseForConsultant(): Promise<{ studentId: string; caseId: string }> {
    const { studentId, caseId } = await createStudentWithCase(app, salesToken);
    const res = await request(app.getHttpServer())
      .post(`/cases/${caseId}/members`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ userId: consultantAId, role: 'OWNER' });
    expect(res.status).toBe(201);
    consultantCaseIds.push(caseId);
    return { studentId, caseId };
  }

  /// No HTTP endpoint links `Student.portalUserId` (only StudentContact/parent-invite has
  /// one) — matches how the seeded `demo.student.self` fixture is itself wired, set
  /// directly at seed time, not through a runtime API.
  async function linkStudentPortalUser(studentId: string): Promise<{ token: string; userId: string }> {
    const user = await createTestUser(prisma, 'STUDENT_PARENT', 'irrelevant-test-password-1!');
    await prisma.student.update({ where: { id: studentId }, data: { portalUserId: user.id } });
    const { token } = await issueTestSession(prisma, user.username);
    return { token, userId: user.id };
  }

  async function confirmHandover(caseId: string, token: string, overrideReason?: string) {
    return request(app.getHttpServer())
      .post(`/cases/${caseId}/closure/handover`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientName: 'Gia đình học sinh', ...(overrideReason ? { overrideReason } : {}) });
  }

  async function closeCase(caseId: string, token: string, closureReason: string, overrideReason?: string) {
    return request(app.getHttpServer())
      .post(`/cases/${caseId}/closure/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closureReason, ...(overrideReason ? { overrideReason } : {}) });
  }

  // ---------------------------------------------------------------------------
  // DEC-06 — role gating: standard (HCTH) vs. audited exception (ED/DM) vs. request-only
  // (CONSULTANT)
  // ---------------------------------------------------------------------------

  describe('DEC-06 — closure owner / exception role gating', () => {
    it('HCTH (ADMIN_FINANCE) closes via the standard path — no overrideReason needed', async () => {
      const { caseId } = await createCaseForConsultant();
      await confirmHandover(caseId, financeToken);
      const res = await closeCase(caseId, financeToken, 'Đã hoàn tất toàn bộ dịch vụ.');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CLOSED');
    });

    it('CONSULTANT is denied the close/handover/liquidation actions entirely (403 — no case-closure:execute grant)', async () => {
      const { caseId } = await createCaseForConsultant();
      const handoverRes = await confirmHandover(caseId, consultantAToken);
      expect(handoverRes.status).toBe(403);
      const closeRes = await closeCase(caseId, consultantAToken, 'attempt');
      expect(closeRes.status).toBe(403);
    });

    it('a role with no case-closure grant at all (Sales/Marketing) is denied (403)', async () => {
      const { caseId } = await createCaseForConsultant();
      const res = await closeCase(caseId, salesToken, 'attempt');
      expect(res.status).toBe(403);
    });

    it('EXECUTIVE_DIRECTOR cannot use the standard path — 409 OVERRIDE_REASON_REQUIRED without one', async () => {
      const { caseId } = await createCaseForConsultant();
      await confirmHandover(caseId, directorToken, 'GĐĐH xử lý thay HCTH trong test này.');
      const res = await closeCase(caseId, directorToken, 'Đã hoàn tất.');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERRIDE_REASON_REQUIRED');
    });

    it('EXECUTIVE_DIRECTOR closes via the audited override once overrideReason is supplied, and OVERRIDE_USED is recorded on the audit row', async () => {
      const { caseId } = await createCaseForConsultant();
      const reason = 'HCTH nghỉ phép đột xuất, GĐĐH xử lý thay.';
      await confirmHandover(caseId, directorToken, reason);
      const res = await closeCase(caseId, directorToken, 'Đã hoàn tất.', reason);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CLOSED');

      const row = await prisma.auditLog.findFirst({ where: { action: 'ARCHIVE', objectType: 'Closure', objectId: caseId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
      expect((row?.metadata as Record<string, unknown> | null)?.overrideUsed).toBe(true);
      expect((row?.metadata as Record<string, unknown> | null)?.event).toBe('OVERRIDE_USED');
    });

    it('DEPARTMENT_MANAGER can likewise only use the audited override, never the standard path', async () => {
      const { caseId } = await createCaseForConsultant();
      const reason = 'HCTH bận, Trưởng phòng xử lý thay.';
      await confirmHandover(caseId, managerToken, reason);
      const denied = await closeCase(caseId, managerToken, 'Đã hoàn tất.');
      expect(denied.status).toBe(409);
      expect(denied.body.error.code).toBe('OVERRIDE_REASON_REQUIRED');

      const allowed = await closeCase(caseId, managerToken, 'Đã hoàn tất.', reason);
      expect(allowed.status).toBe(201);
    });
  });

  // ---------------------------------------------------------------------------
  // DEC-06 — advisory "request closure" (never a hard gate)
  // ---------------------------------------------------------------------------

  describe('DEC-06 — request closure (advisory only, Implementation Assumption #1)', () => {
    it('the case-owner CONSULTANT can request closure; it is recorded but never blocks or changes Case status', async () => {
      const { caseId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/request`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ reason: 'Đã hoàn tất mọi công việc, đề nghị HCTH đóng hồ sơ.' });
      expect(res.status).toBe(201);

      const caseRow = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
      expect(caseRow.status).not.toBe('CLOSED');

      const timeline = await request(app.getHttpServer()).get(`/cases/${caseId}/timeline`).set('Authorization', `Bearer ${directorToken}`);
      const note = timeline.body.find((e: { body?: string }) => typeof e.body === 'string' && e.body.includes('[Đề nghị đóng hồ sơ]'));
      expect(note).toBeDefined();
    });

    it('HCTH can still close a case that was never requested at all — the request is advisory, not a precondition', async () => {
      const { caseId } = await createCaseForConsultant();
      await confirmHandover(caseId, financeToken);
      const res = await closeCase(caseId, financeToken, 'Không có đề nghị trước, HCTH vẫn đóng được.');
      expect(res.status).toBe(201);
    });
  });

  // ---------------------------------------------------------------------------
  // DEC-07 — Visa NOT_APPLICABLE (the only checklist item allowed a third state) and the
  // Document Handover precondition itself
  // ---------------------------------------------------------------------------

  describe('DEC-07 — checklist visibility', () => {
    it('GET checklist reports VISA as NOT_APPLICABLE (not FAIL) when the case has zero Visa rows, and it does not block closure', async () => {
      const { caseId } = await createCaseForConsultant();
      const statusRes = await request(app.getHttpServer()).get(`/cases/${caseId}/closure`).set('Authorization', `Bearer ${financeToken}`);
      expect(statusRes.status).toBe(200);
      const visaItem = statusRes.body.checklist.find((i: { key: string }) => i.key === 'VISA');
      expect(visaItem.status).toBe('NOT_APPLICABLE');

      await confirmHandover(caseId, financeToken);
      const closeRes = await closeCase(caseId, financeToken, 'Không có visa liên quan.');
      expect(closeRes.status).toBe(201);
    });

    it('the CONSULTANT case-owner can view the checklist (case-closure:view + case-owner) even though they cannot execute it', async () => {
      const { caseId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer()).get(`/cases/${caseId}/closure`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.readyToClose).toBe(false);
      expect(res.body.checklist.find((i: { key: string }) => i.key === 'DOCUMENT_HANDOVER').status).toBe('FAIL');
    });
  });

  // ---------------------------------------------------------------------------
  // DEC-08 — two-party liquidation confirmation, immutable once complete
  // ---------------------------------------------------------------------------

  describe('DEC-08 — two-party liquidation confirmation', () => {
    async function closedCase(): Promise<{ studentId: string; caseId: string }> {
      const { studentId, caseId } = await createCaseForConsultant();
      await confirmHandover(caseId, financeToken);
      const res = await closeCase(caseId, financeToken, 'Đã hoàn tất, sẵn sàng thanh lý.');
      expect(res.status).toBe(201);
      return { studentId, caseId };
    }

    it('rejects a liquidation confirmation before the case is CLOSED (409 CASE_NOT_CLOSED)', async () => {
      const { caseId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/liquidation/confirm-company`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CASE_NOT_CLOSED');
    });

    it('company-side confirmation alone leaves status PENDING; the student/parent side does not auto-confirm', async () => {
      const { caseId } = await closedCase();
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/liquidation/confirm-company`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({});
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.companyConfirmedAt).toBeTruthy();
      expect(res.body.studentParentConfirmedAt).toBeNull();
    });

    it('both sides confirming independently (company via staff, student via portal) finalizes to LIQUIDATED with two distinct actor/timestamp pairs', async () => {
      const { studentId, caseId } = await closedCase();
      const { token: studentToken, userId: studentUserId } = await linkStudentPortalUser(studentId);

      const companyRes = await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/liquidation/confirm-company`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({});
      expect(companyRes.body.status).toBe('PENDING');

      const studentRes = await request(app.getHttpServer())
        .post(`/portal/students/${studentId}/closure/liquidation/confirm`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(studentRes.status).toBe(201);
      expect(studentRes.body.status).toBe('LIQUIDATED');
      expect(studentRes.body.companyConfirmedById).not.toBe(studentRes.body.studentParentConfirmedById);
      expect(studentRes.body.studentParentConfirmedById).toBe(studentUserId);
      expect(studentRes.body.liquidatedAt).toBeTruthy();
    });

    it('is immutable once LIQUIDATED — a further confirmation attempt from either side is rejected (409 ALREADY_LIQUIDATED)', async () => {
      const { studentId, caseId } = await closedCase();
      const { token: studentToken } = await linkStudentPortalUser(studentId);
      await request(app.getHttpServer()).post(`/cases/${caseId}/closure/liquidation/confirm-company`).set('Authorization', `Bearer ${financeToken}`).send({});
      await request(app.getHttpServer()).post(`/portal/students/${studentId}/closure/liquidation/confirm`).set('Authorization', `Bearer ${studentToken}`).send({});

      const again = await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/liquidation/confirm-company`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({});
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('ALREADY_LIQUIDATED');
    });

    it('an unrelated Student/Parent portal account cannot confirm liquidation on a case that is not theirs (404, existing ScopePolicyService authorization)', async () => {
      const { caseId } = await closedCase();
      const unrelatedUser = await createTestUser(prisma, 'STUDENT_PARENT', 'irrelevant-test-password-2!');
      const { token: unrelatedToken } = await issueTestSession(prisma, unrelatedUser.username);

      // Wrong studentId entirely (not linked to this unrelated user at all).
      const { studentId: someOtherStudentId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer())
        .post(`/portal/students/${someOtherStudentId}/closure/liquidation/confirm`)
        .set('Authorization', `Bearer ${unrelatedToken}`)
        .send({});
      expect(res.status).toBe(404);

      const stillPending = await prisma.liquidationConfirmation.findUnique({ where: { caseId } });
      expect(stillPending).toBeNull();
    });

    it('portal read (GET) redacts handover notes but exposes checklist/handover/liquidation status', async () => {
      const { studentId, caseId } = await closedCase();
      await prisma.closureHandoverRecord.update({ where: { caseId }, data: { notes: 'Internal staff note — should never reach the portal.' } });
      const { token: studentToken } = await linkStudentPortalUser(studentId);

      const res = await request(app.getHttpServer()).get(`/portal/students/${studentId}/closure`).set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.caseStatus).toBe('CLOSED');
      expect(res.body.handover.status).toBe('COMPLETED');
      expect(res.body.handover.notes).toBeNull();
    });
  });
});
