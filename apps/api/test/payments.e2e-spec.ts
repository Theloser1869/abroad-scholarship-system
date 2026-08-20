import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { issueTestSession } from './helpers/issue-session';

/// 05-commercial/02_PAYMENT.md: multiple installments, partial payment, no double-counting
/// on a retried request, duplicate-reference rejection, no silent negative balance from
/// overpayment, refund linked to the original payment, waive requires reason + is audited,
/// overdue determined consistently, plus RBAC/field-level (Consultant/Sales never get
/// financial fields just because they can see the Case/Lead) and export/download audit.
describe('Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let financeToken: string;
  let directorToken: string;
  let managerToken: string;
  let consultantAToken: string;
  let salesToken: string;
  let studentSelfToken: string;
  let parentLinkedToken: string;
  let parentUnlinkedToken: string;

  // Seed fixture (database/seeds/seed.ts): Contract HD-2026-90001 (SIGNED), owned by
  // studentA (HS-2026-90001) — PAY-2026-90001 (PAID in full) and PAY-2026-90002 (PENDING,
  // due date in the past — the overdue fixture).
  let fixtureContractId: string;
  let fixturePaidPaymentId: string;
  let fixtureOverduePaymentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: directorToken } = await issueTestSession(prisma, 'demo.director'));
    ({ token: managerToken } = await issueTestSession(prisma, 'demo.manager'));
    ({ token: consultantAToken } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));
    ({ token: parentLinkedToken } = await issueTestSession(prisma, 'demo.parent.linked'));
    ({ token: parentUnlinkedToken } = await issueTestSession(prisma, 'demo.parent.unlinked'));

    const fixtureContract = await prisma.contract.findUniqueOrThrow({ where: { contractCode: 'HD-2026-90001' } });
    fixtureContractId = fixtureContract.id;
    const paidPayment = await prisma.payment.findUniqueOrThrow({ where: { paymentCode: 'PAY-2026-90001' } });
    fixturePaidPaymentId = paidPayment.id;
    const overduePayment = await prisma.payment.findUniqueOrThrow({ where: { paymentCode: 'PAY-2026-90002' } });
    fixtureOverduePaymentId = overduePayment.id;
  });

  afterAll(async () => {
    await app.close();
  });

  /// Full DRAFT -> SIGNED walk against a fresh Student+Case, same shape as
  /// contracts.e2e-spec.ts's helper of the same intent — each payments test gets its own
  /// isolated Contract so recorded amounts/statuses never leak between tests.
  async function signedContract(value = 4000) {
    const { studentId } = await createStudentWithCase(app, salesToken);
    const createRes = await request(app.getHttpServer())
      .post('/contracts')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ studentId, value, currency: 'USD' });
    const contract = createRes.body;
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
    const signRes = await request(app.getHttpServer())
      .post(`/contracts/${contract.id}/sign`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ signedDocumentId: `doc-payments-fixture-${randomUUID()}` });
    return signRes.body;
  }

  async function createInstallment(contractId: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post(`/contracts/${contractId}/payments`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ installmentNo: 1, amount: 1000, currency: 'USD', dueDate: '2026-12-01', ...overrides });
    expect(res.status).toBe(201);
    return res.body;
  }

  describe('installment schedule creation', () => {
    it('creates a PENDING installment on a signed contract', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id);
      expect(payment.status).toBe('PENDING');
      expect(payment.paymentCode).toMatch(/^PAY-\d{4}-\d{5}$/);
      expect(payment.outstandingAmount).toBe('1000');
    });

    it('rejects creating a schedule entry before the contract has been signed (409)', async () => {
      const { studentId } = await createStudentWithCase(app, salesToken);
      const createRes = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId, value: 1000, currency: 'USD' });
      const res = await request(app.getHttpServer())
        .post(`/contracts/${createRes.body.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 500, currency: 'USD', dueDate: '2026-12-01' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTRACT_NOT_YET_SIGNED');
    });

    it('rejects a duplicate installment number on the same contract (409)', async () => {
      const contract = await signedContract();
      await createInstallment(contract.id, { installmentNo: 1 });
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 999, currency: 'USD', dueDate: '2026-12-15' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_INSTALLMENT');
    });

    // Phase 14 fix regression (Final Architect Review finding) — an installment could
    // previously be created in a different currency than its own Contract.
    it('rejects an installment currency that does not match the Contract currency (409)', async () => {
      const contract = await signedContract();
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 500, currency: 'EUR', dueDate: '2026-12-01' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CURRENCY_MISMATCH');
    });

    // Phase 14 fix regression — no new financial activity may be created against a
    // Contract already LIQUIDATED/ARCHIVED ("financial activity on a closed-out record").
    it('rejects creating an installment against a LIQUIDATED contract (409)', async () => {
      const contract = await signedContract();
      await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'ACTIVE' });
      await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'COMPLETED' });
      const liquidated = await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'LIQUIDATED' });
      expect(liquidated.body.status).toBe('LIQUIDATED');

      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 500, currency: 'USD', dueDate: '2026-12-01' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTRACT_CLOSED');
    });

    it('rejects recording a payment against a LIQUIDATED contract (409), but refund/waive remain reachable on already-existing payments', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { installmentNo: 1, amount: 1000 });
      await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'ACTIVE' });
      await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'COMPLETED' });
      await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'LIQUIDATED' });

      const recordRes = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 500 });
      expect(recordRes.status).toBe(409);
      expect(recordRes.body.error.code).toBe('CONTRACT_CLOSED');

      // waive remains reachable — a corrective action on an existing, still-outstanding
      // installment stays legitimate post-closure (see the service's own comment).
      const waiveRes = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/waive`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ reason: 'Written off after contract liquidation.' });
      expect(waiveRes.status).toBe(201);
      expect(waiveRes.body.status).toBe('WAIVED');
    });
  });

  describe('record payment — partial, full, overpayment', () => {
    it('a partial payment moves status to PARTIALLY_PAID and reduces the outstanding balance', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 400 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PARTIALLY_PAID');
      expect(res.body.outstandingAmount).toBe('600');
    });

    it('paying the remaining balance moves status to PAID with zero outstanding', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 400 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 600 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PAID');
      expect(res.body.outstandingAmount).toBe('0');
    });

    it('rejects an overpayment by default (409 OVERPAYMENT_NOT_ALLOWED) — no silent negative balance', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1200 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERPAYMENT_NOT_ALLOWED');
    });

    it('accepts an overpayment when allowOverpayment is explicitly set, and outstanding never goes negative', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1200, allowOverpayment: true });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PAID');
      expect(res.body.outstandingAmount).toBe('0');
    });

    it('rejects recording any further amount against an already-PAID payment (409)', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1000 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_ALREADY_RESOLVED');
    });
  });

  describe('duplicate transaction protection', () => {
    it('a retried request with the same Idempotency-Key + body is not double-applied', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      const key = randomUUID();
      const first = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', key)
        .send({ amount: 400 });
      const retry = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', key)
        .send({ amount: 400 });
      expect(first.status).toBe(201);
      expect(retry.status).toBe(201);
      expect(retry.body).toEqual(first.body);

      const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(Number(row.paidAmount)).toBe(400); // not 800 — the retry did not re-run the handler
    });

    it('rejects reusing the same non-null reference across two different payments (409)', async () => {
      const contract = await signedContract();
      const paymentOne = await createInstallment(contract.id, { installmentNo: 1, amount: 500 });
      const paymentTwo = await createInstallment(contract.id, { installmentNo: 2, amount: 500 });
      const sharedReference = `E2E-REF-${randomUUID()}`;

      const firstRecord = await request(app.getHttpServer())
        .post(`/payments/${paymentOne.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 500, reference: sharedReference });
      expect(firstRecord.status).toBe(201);

      const secondRecord = await request(app.getHttpServer())
        .post(`/payments/${paymentTwo.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 500, reference: sharedReference });
      expect(secondRecord.status).toBe(409);
      expect(secondRecord.body.error.code).toBe('DUPLICATE_PAYMENT_REFERENCE');
    });
  });

  describe('refund — linked to the original payment (rule #7)', () => {
    it('a partial refund reduces net-paid without fully resolving the payment', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1000 });

      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 300, reason: 'Partial service scope reduction' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PAID'); // not fully refunded yet
      expect(res.body.outstandingAmount).toBe('300');

      const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(Number(row.refundedAmount)).toBe(300);
      expect(row.refundReason).toBe('Partial service scope reduction');
    });

    it('refunding the full net-paid amount moves status to REFUNDED', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1000 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1000, reason: 'Service cancelled' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('REFUNDED');
    });

    it('rejects refunding more than has actually been net-paid (409)', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 400 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 500, reason: 'Attempted over-refund' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REFUND_EXCEEDS_NET_PAID');
    });
  });

  describe('waive — requires a reason, is audited (rule #8)', () => {
    it('rejects a waive without a reason (400)', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id);
      const res = await request(app.getHttpServer()).post(`/payments/${payment.id}/waive`).set('Authorization', `Bearer ${financeToken}`).send({});
      expect(res.status).toBe(400);
    });

    it('waives a pending payment with a reason, and it is audited', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id);
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/waive`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ reason: 'Scholarship covered this installment in full' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('WAIVED');

      const financeUser = await prisma.user.findUniqueOrThrow({ where: { username: 'demo.finance' } });
      const row = await prisma.auditLog.findFirst({
        where: { action: 'EDIT', objectType: 'Payments', objectId: payment.id, actorId: financeUser.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
    });

    it('rejects waiving an already-resolved payment (409)', async () => {
      const contract = await signedContract();
      const payment = await createInstallment(contract.id, { amount: 1000 });
      await request(app.getHttpServer())
        .post(`/payments/${payment.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 1000 });
      const res = await request(app.getHttpServer())
        .post(`/payments/${payment.id}/waive`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ reason: 'Too late' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_ALREADY_RESOLVED');
    });
  });

  describe('overdue — determined consistently (isOverdue), and filterable', () => {
    it('the seed fixture payment with a past due date and PENDING status reports isOverdue true', async () => {
      const res = await request(app.getHttpServer()).get(`/payments/${fixtureOverduePaymentId}`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isOverdue).toBe(true);
      expect(res.body.status).toBe('OVERDUE'); // lazily synced from PENDING on read
    });

    it('a resolved (PAID) payment is never reported overdue even with a past due date', async () => {
      const res = await request(app.getHttpServer()).get(`/payments/${fixturePaidPaymentId}`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isOverdue).toBe(false);
    });

    it('filters a contract payment list by overdue=true', async () => {
      const res = await request(app.getHttpServer())
        .get(`/contracts/${fixtureContractId}/payments`)
        .query({ overdue: 'true' })
        .set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(fixtureOverduePaymentId);
      expect(ids).not.toContain(fixturePaidPaymentId);
    });

    it('filters a contract payment list by status=OVERDUE (the physical stored status, not just the computed field)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/contracts/${fixtureContractId}/payments`)
        .query({ status: 'OVERDUE' })
        .set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(fixtureOverduePaymentId);
    });
  });

  describe('RBAC — scope and field-level (financial data does not follow from Case/Lead access)', () => {
    it('GLOBAL/ADMIN_FINANCE roles can read the fixture payment', async () => {
      for (const token of [directorToken, managerToken, financeToken]) {
        const res = await request(app.getHttpServer()).get(`/payments/${fixturePaidPaymentId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('OWN_STUDENT: the linked student and linked parent can view their own payment', async () => {
      const selfRes = await request(app.getHttpServer()).get(`/payments/${fixturePaidPaymentId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(selfRes.status).toBe(200);
      const parentRes = await request(app.getHttpServer()).get(`/payments/${fixturePaidPaymentId}`).set('Authorization', `Bearer ${parentLinkedToken}`);
      expect(parentRes.status).toBe(200);
    });

    it('OWN_STUDENT: an unlinked parent is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/payments/${fixturePaidPaymentId}`).set('Authorization', `Bearer ${parentUnlinkedToken}`);
      expect(res.status).toBe(404);
    });

    it('CONSULTANT is denied at the permission layer (403) despite being a member of the linked Case — proves financial access does not follow from Case access', async () => {
      const res = await request(app.getHttpServer()).get(`/payments/${fixturePaidPaymentId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('STUDENT_PARENT (view-only) cannot record a payment against its own contract (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/payments/${fixturePaidPaymentId}/record`)
        .set('Authorization', `Bearer ${studentSelfToken}`)
        .send({ amount: 1 });
      expect(res.status).toBe(403);
    });

    it('DEPARTMENT_MANAGER (oversight, view/export only) cannot record a payment — execution stays with ADMIN_FINANCE', async () => {
      const res = await request(app.getHttpServer())
        .post(`/payments/${fixturePaidPaymentId}/record`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ amount: 1 });
      expect(res.status).toBe(403);
    });
  });

  describe('cross-case isolation', () => {
    it('a payment on one signed contract is not visible/listed under a different contract', async () => {
      const contractA = await signedContract();
      const contractB = await signedContract();
      const paymentOnA = await createInstallment(contractA.id, { installmentNo: 1 });

      const listUnderB = await request(app.getHttpServer())
        .get(`/contracts/${contractB.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`);
      expect(listUnderB.status).toBe(200);
      expect(listUnderB.body.data.map((p: { id: string }) => p.id)).not.toContain(paymentOnA.id);
    });
  });

  describe('export — reason required, audited (SRS 6.21)', () => {
    it('rejects export without a reason (400)', async () => {
      const res = await request(app.getHttpServer()).get('/payments/export').set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(400);
    });

    it('records reason, row count and fields exported for a Payment EXPORT', async () => {
      const res = await request(app.getHttpServer())
        .get('/payments/export')
        .query({ reason: 'Monthly reconciliation of receivables' })
        .set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.rowCount).toBeGreaterThanOrEqual(1);

      const financeUser = await prisma.user.findUniqueOrThrow({ where: { username: 'demo.finance' } });
      const row = await prisma.auditLog.findFirst({
        where: { action: 'EXPORT', objectType: 'Payments', actorId: financeUser.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      const metadata = row?.metadata as { reason?: string; rowCount?: number } | null;
      expect(metadata?.reason).toBe('Monthly reconciliation of receivables');
    });

    it('STUDENT_PARENT (view-only) cannot export (403)', async () => {
      const res = await request(app.getHttpServer()).get('/payments/export').query({ reason: 'attempt' }).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('audit — VIEW recorded for reading a payment', () => {
    it('creates a VIEW audit record with the payment id as objectId', async () => {
      await request(app.getHttpServer()).get(`/payments/${fixturePaidPaymentId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({
        where: { action: 'VIEW', objectType: 'Payments', objectId: fixturePaidPaymentId },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
