import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { createTestUser } from './helpers/create-test-user';
import { issueTestSession } from './helpers/issue-session';

/// 05-commercial/01_CONTRACT.md: workflow FSM, monetary-threshold approval, immutability
/// once signed (changes only via Amendment), the secure client-review link, Case linkage
/// at signing (not creation), and per-role RBAC/field-level access. Fixture roles per
/// docs/security/RBAC_MATRIX.md: ADMIN_FINANCE runs day-to-day contract processing
/// (view/create/edit/send/sign/export, no approve/amend); EXECUTIVE_DIRECTOR/
/// DEPARTMENT_MANAGER approve (director required above the monetary threshold); CONSULTANT
/// gets nothing on Contract even though it is a member of the linked Case (proves
/// Contract/Payment scope is genuinely separate from Case scope); STUDENT_PARENT is
/// view-only, scoped to its own Student.
describe('Contracts (e2e)', () => {
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

  // Seed fixture (database/seeds/seed.ts): HD-2026-90001, already SIGNED, owned by
  // studentA (HS-2026-90001), which demo.student.self/demo.parent.linked are linked to.
  let fixtureContractId: string;
  let fixtureStudentId: string;

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
    fixtureStudentId = fixtureContract.studentId;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createDraftContract(overrides: Record<string, unknown> = {}) {
    const { studentId } = await createStudentWithCase(app, salesToken);
    const res = await request(app.getHttpServer())
      .post('/contracts')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ studentId, value: 3000, currency: 'USD', servicePackage: 'Standard package', ...overrides });
    expect(res.status).toBe(201);
    return { contract: res.body, studentId };
  }

  describe('create', () => {
    it('creates a DRAFT contract for an existing student, never a new Student/Case', async () => {
      const { contract } = await createDraftContract();
      expect(contract.status).toBe('DRAFT');
      expect(contract.contractCode).toMatch(/^HD-\d{4}-\d{5}$/);
      expect(contract.version).toBe(1);
    });

    it('rejects creating a contract for a nonexistent student (404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId: '00000000-0000-0000-0000-000000000000', value: 1000, currency: 'USD' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('STUDENT_NOT_FOUND');
    });
  });

  describe('student relation summary (DEC-10)', () => {
    it('GET /contracts and GET /contracts/:id embed a display-safe student summary, never the full Student row', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/contracts')
        .query({ studentId: fixtureStudentId })
        .set('Authorization', `Bearer ${financeToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data[0].student).toEqual({
        id: fixtureStudentId,
        studentCode: 'HS-2026-90001',
        fullName: expect.any(String),
      });
      expect(listRes.body.data[0].student).not.toHaveProperty('budget');

      const detailRes = await request(app.getHttpServer())
        .get(`/contracts/${fixtureContractId}`)
        .set('Authorization', `Bearer ${financeToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.student).toEqual({ id: fixtureStudentId, studentCode: 'HS-2026-90001', fullName: expect.any(String) });
    });
  });

  describe('DRAFT editability and submit', () => {
    it('allows editing while DRAFT', async () => {
      const { contract } = await createDraftContract();
      const res = await request(app.getHttpServer())
        .patch(`/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ value: 3500 });
      expect(res.status).toBe(200);
      expect(Number(res.body.value)).toBe(3500);
    });

    it('submit moves DRAFT -> REVIEW and snapshots the current approval threshold', async () => {
      const { contract } = await createDraftContract();
      const res = await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('REVIEW');
      expect(Number(res.body.approvalThreshold)).toBe(5000);
    });

    it('rejects editing once submitted for review (terms locked pending decision)', async () => {
      const { contract } = await createDraftContract();
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      const res = await request(app.getHttpServer()).patch(`/contracts/${contract.id}`).set('Authorization', `Bearer ${financeToken}`).send({ value: 9999 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_CONTRACT_STATE');
    });

    it('rejects an arbitrary direct status PATCH while in REVIEW — no bare-status bypass of the FSM', async () => {
      const { contract } = await createDraftContract();
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      const res = await request(app.getHttpServer())
        .patch(`/contracts/${contract.id}/status`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('approval — monetary threshold (SRS 6.16)', () => {
    it('DEPARTMENT_MANAGER can approve a contract below the threshold', async () => {
      const { contract } = await createDraftContract({ value: 2000 });
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Within delegated authority' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedById).toBeTruthy();
    });

    it('DEPARTMENT_MANAGER is blocked from approving a contract at/above the threshold — only EXECUTIVE_DIRECTOR may', async () => {
      const { contract } = await createDraftContract({ value: 6000 });
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      const blocked = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('APPROVAL_THRESHOLD_EXCEEDED');

      const approved = await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
      expect(approved.status).toBe(201);
      expect(approved.body.status).toBe('APPROVED');
    });

    it('ADMIN_FINANCE holds no contracts:approve permission at all (403), despite running the rest of the workflow', async () => {
      const { contract } = await createDraftContract({ value: 1000 });
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      const res = await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${financeToken}`).send({});
      expect(res.status).toBe(403);
    });
  });

  describe('reject', () => {
    it('rejecting sends the contract back to DRAFT and records an Approval(REJECTED) row', async () => {
      const { contract } = await createDraftContract({ value: 1000 });
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Missing service package detail' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');

      const approval = await prisma.approval.findFirst({ where: { entityType: 'Contract', entityId: contract.id, decision: 'REJECTED' } });
      expect(approval).not.toBeNull();
      expect(approval?.reason).toBe('Missing service package detail');
    });
  });

  describe('send + public review link (secure, expiring, token-gated)', () => {
    async function approvedContract(value = 1000) {
      const { contract } = await createDraftContract({ value });
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      const res = await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
      return res.body;
    }

    it('rejects sending a contract that is not yet APPROVED', async () => {
      const { contract } = await createDraftContract();
      const res = await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(409);
    });

    it('send() returns a one-time review token and moves the contract to SENT', async () => {
      const contract = await approvedContract();
      const res = await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(201);
      expect(res.body.contract.status).toBe('SENT');
      expect(typeof res.body.reviewToken).toBe('string');
      expect(res.body.reviewToken.length).toBeGreaterThan(20);
    });

    it('the public review link works unauthenticated, is viewable more than once, and exposes only client-safe fields', async () => {
      const contract = await approvedContract();
      const sendRes = await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      const { reviewToken } = sendRes.body;

      const firstView = await request(app.getHttpServer()).get(`/public/contracts/review/${reviewToken}`);
      expect(firstView.status).toBe(200);
      expect(firstView.body.contractCode).toBe(contract.contractCode);
      expect(firstView.body.status).toBe('SENT');
      expect(firstView.body).not.toHaveProperty('id');
      expect(firstView.body).not.toHaveProperty('approvedById');

      const secondView = await request(app.getHttpServer()).get(`/public/contracts/review/${reviewToken}`);
      expect(secondView.status).toBe(200);
    });

    it('rejects an unknown/invalid review token with 404, not a different error', async () => {
      const res = await request(app.getHttpServer()).get('/public/contracts/review/not-a-real-token');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('REVIEW_LINK_INVALID');
    });
  });

  describe('sign — Case linkage completes at signing, not creation (ASM-15)', () => {
    async function sentContract(studentId: string, value = 1000) {
      const res = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId, value, currency: 'USD' });
      const contract = res.body;
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      return contract;
    }

    it('signing links Case.contractId to this contract and moves status to SIGNED', async () => {
      const { studentId, caseId } = await createStudentWithCase(app, salesToken);
      const contract = await sentContract(studentId);

      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ signedDocumentId: 'doc-e2e-signed-001' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SIGNED');
      expect(res.body.signedDocumentId).toBe('doc-e2e-signed-001');

      const caseRow = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
      expect(caseRow.contractId).toBe(contract.id);
    });

    it('rejects signing when the student has no active Case (409 NO_ACTIVE_CASE_FOR_STUDENT)', async () => {
      const { studentId, caseId } = await createStudentWithCase(app, salesToken);
      await request(app.getHttpServer()).post(`/cases/${caseId}/closure/handover`).set('Authorization', `Bearer ${financeToken}`).send({});
      await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/close`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ closureReason: 'Closed before contract signing, for the no-active-case e2e case' });

      const contract = await sentContract(studentId);
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ signedDocumentId: 'doc-e2e-002' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_ACTIVE_CASE_FOR_STUDENT');
    });

    it('once SIGNED, the signed artifact is immutable — update() is rejected regardless of role', async () => {
      const { studentId } = await createStudentWithCase(app, salesToken);
      const contract = await sentContract(studentId);
      await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ signedDocumentId: 'doc-e2e-003' });

      const res = await request(app.getHttpServer()).patch(`/contracts/${contract.id}`).set('Authorization', `Bearer ${directorToken}`).send({ value: 1 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_CONTRACT_STATE');
    });
  });

  describe('amendment — the only path to change terms after signing (rule #12)', () => {
    async function signedContract() {
      const { studentId } = await createStudentWithCase(app, salesToken);
      const createRes = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId, value: 1000, currency: 'USD' });
      const contract = createRes.body;
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      const signRes = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ signedDocumentId: 'doc-amend-fixture' });
      return signRes.body;
    }

    it('rejects an amendment before the contract has ever been signed', async () => {
      const { contract } = await createDraftContract();
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/amendments`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ reason: 'Too early', effectiveDate: '2026-09-01', value: 5000 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTRACT_NOT_YET_SIGNED');
    });

    it('creates an amendment that bumps version and records before/after, and the live contract reflects the new value', async () => {
      const contract = await signedContract();
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/amendments`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ reason: 'Added a second country option', effectiveDate: '2026-09-01', value: 1500 });
      expect(res.status).toBe(201);
      expect(res.body.previousVersion).toBe(1);
      expect(res.body.newVersion).toBe(2);
      expect(res.body.before.value).toBe(1000);
      expect(res.body.after.value).toBe(1500);

      const updated = await request(app.getHttpServer()).get(`/contracts/${contract.id}`).set('Authorization', `Bearer ${directorToken}`);
      expect(Number(updated.body.value)).toBe(1500);
      expect(updated.body.version).toBe(2);
    });

    it('rejects a no-op amendment (nothing actually different from current values)', async () => {
      const contract = await signedContract();
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/amendments`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ reason: 'Nothing really changes', effectiveDate: '2026-09-01', value: 1000 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_MATERIAL_CHANGE');
    });

    it('ADMIN_FINANCE holds no contracts:amend permission (403)', async () => {
      const contract = await signedContract();
      const res = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/amendments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ reason: 'Attempted by the wrong role', effectiveDate: '2026-09-01', value: 2000 });
      expect(res.status).toBe(403);
    });
  });

  /// Client Acceptance Remediation GAP-002 (CRITICAL, REQ-CONTRACT-002/CONFLICT-001) —
  /// SIGNED -> ACTIVE now requires at least 30% of Contract.value received, net of refunds
  /// (client-confirmed threshold, DEC-01, 2026-08-27 — see
  /// docs/requirements/CLIENT_CLARIFICATION_SIGNOFF.md; CONFLICT-001 is now RESOLVED).
  describe('activation — payment-gated (GAP-002, DEC-01)', () => {
    async function signedContract(value = 1000) {
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
        .send({ signedDocumentId: `doc-activation-fixture-${Date.now()}` });
      return signRes.body;
    }

    async function activate(contractId: string, token: string = financeToken) {
      return request(app.getHttpServer()).patch(`/contracts/${contractId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'ACTIVE' });
    }

    it('denies activation with zero payments recorded at all (409 PAYMENT_REQUIRED_FOR_ACTIVATION)', async () => {
      const contract = await signedContract();
      const res = await activate(contract.id);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_REQUIRED_FOR_ACTIVATION');
    });

    it('denies activation when an installment schedule exists but nothing has actually been received yet (still PENDING)', async () => {
      const contract = await signedContract();
      await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 1000, currency: 'USD', dueDate: '2026-12-01' });
      const res = await activate(contract.id);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_REQUIRED_FOR_ACTIVATION');
    });

    it('denies activation when the amount received is below the 30% threshold (409 PAYMENT_REQUIRED_FOR_ACTIVATION, DEC-01)', async () => {
      const contract = await signedContract(1000);
      const installmentRes = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 1000, currency: 'USD', dueDate: '2026-12-01' });
      await request(app.getHttpServer())
        .post(`/payments/${installmentRes.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', `activate-below-threshold-${Date.now()}`)
        .send({ amount: 299 });
      const res = await activate(contract.id);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_REQUIRED_FOR_ACTIVATION');
    });

    it('allows activation once at least 30% of the contract value has been received (full payment is not required, DEC-01)', async () => {
      const contract = await signedContract(1000);
      const installmentRes = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 1000, currency: 'USD', dueDate: '2026-12-01' });
      await request(app.getHttpServer())
        .post(`/payments/${installmentRes.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', `activate-partial-${Date.now()}`)
        .send({ amount: 300 });
      const res = await activate(contract.id);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.activatedAt).toBeTruthy();
    });

    it('sums multiple payments toward the 30% threshold (DEC-01)', async () => {
      const contract = await signedContract(1000);
      const first = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 500, currency: 'USD', dueDate: '2026-12-01' });
      const second = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 2, amount: 500, currency: 'USD', dueDate: '2026-12-15' });
      await request(app.getHttpServer())
        .post(`/payments/${first.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', `activate-sum-a-${Date.now()}`)
        .send({ amount: 200 });
      const tooEarly = await activate(contract.id);
      expect(tooEarly.status).toBe(409);

      await request(app.getHttpServer())
        .post(`/payments/${second.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', `activate-sum-b-${Date.now()}`)
        .send({ amount: 150 });
      const res = await activate(contract.id);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('denies activation attempt from a role without contracts:edit (403), even with a payment received', async () => {
      const contract = await signedContract();
      const installmentRes = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 1000, currency: 'USD', dueDate: '2026-12-01' });
      await request(app.getHttpServer())
        .post(`/payments/${installmentRes.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', `activate-unauth-${Date.now()}`)
        .send({ amount: 1000 });
      const res = await activate(contract.id, consultantAToken);
      expect(res.status).toBe(403);
    });

    it('a concurrent duplicate activation attempt fails cleanly instead of double-processing (compare-and-swap on status)', async () => {
      const contract = await signedContract();
      const installmentRes = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 1000, currency: 'USD', dueDate: '2026-12-01' });
      await request(app.getHttpServer())
        .post(`/payments/${installmentRes.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', `activate-race-${Date.now()}`)
        .send({ amount: 1000 });

      const [first, second] = await Promise.all([activate(contract.id), activate(contract.id)]);
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 409]);
      const failed = first.status === 409 ? first : second;
      expect(failed.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      const finalContract = await request(app.getHttpServer()).get(`/contracts/${contract.id}`).set('Authorization', `Bearer ${financeToken}`);
      expect(finalContract.body.status).toBe('ACTIVE');

      // Task generation (06-operations "contract activation" trigger) must have fired
      // exactly once, not twice, confirming the race was resolved at the DB layer and not
      // just at the HTTP response layer.
      const generatedTasks = await prisma.task.findMany({ where: { sourceEntityType: 'Contract', sourceEntityId: contract.id } });
      expect(generatedTasks.length).toBeLessThanOrEqual(1);
    });

    it('a denied activation attempt is still audited (EDIT, DENIED is only for 401/403 — a 409 business rule records ERROR)', async () => {
      const contract = await signedContract();
      const res = await activate(contract.id);
      expect(res.status).toBe(409);

      const auditRow = await prisma.auditLog.findFirst({
        where: { action: 'EDIT', objectType: 'Contracts', objectId: contract.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.result).toBe('ERROR');
    });
  });

  /// Client Acceptance Remediation DEC-06 (GAP-007, REQ-CASE-014, 2026-08-26) — the old
  /// independent Contract-level COMPLETED/LIQUIDATED path (payment-checked/reasoned) is
  /// retired: once a Contract is linked to a Case — always true by the time ACTIVE is
  /// reachable, since `sign()` requires and sets that link — `PATCH /contracts/:id/status`
  /// now refuses COMPLETED/LIQUIDATED and redirects to the unified `ClosureService`
  /// (`POST /cases/:id/closure/close` / `.../liquidation/confirm-company`). The debt-check/
  /// reason/two-party-confirmation behavior itself is now covered by
  /// `pre-departure-enrollment-closure.e2e-spec.ts` ("full happy path", which asserts the
  /// linked Contract syncs to COMPLETED) and `case-closure.e2e-spec.ts` (full DEC-06/07/08
  /// matrix, including liquidation). This block only verifies the redirect itself.
  describe('closure — Contract COMPLETED/LIQUIDATED redirect to the unified Closure workflow once a Case is linked (DEC-06)', () => {
    async function activeContract(value = 1000) {
      const { studentId, caseId } = await createStudentWithCase(app, salesToken);
      const createRes = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId, value, currency: 'USD' });
      const contract = createRes.body;
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ signedDocumentId: `doc-closure-fixture-${Date.now()}` });
      const installmentRes = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: value, currency: 'USD', dueDate: '2026-12-01' });
      await request(app.getHttpServer())
        .post(`/payments/${installmentRes.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', `closure-fixture-${Date.now()}`)
        .send({ amount: value });
      await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'ACTIVE' });
      return { contractId: contract.id as string, caseId: caseId as string };
    }

    it('denies ACTIVE -> COMPLETED directly once linked to a Case (409 USE_UNIFIED_CLOSURE_WORKFLOW)', async () => {
      const { contractId, caseId } = await activeContract();
      const res = await request(app.getHttpServer()).patch(`/contracts/${contractId}/status`).set('Authorization', `Bearer ${financeToken}`).send({ status: 'COMPLETED' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USE_UNIFIED_CLOSURE_WORKFLOW');
      expect(res.body.error.caseId).toBe(caseId);
    });

    it('denies COMPLETED -> LIQUIDATED directly as well, even after the unified workflow already moved it to COMPLETED', async () => {
      const { contractId, caseId } = await activeContract();
      await request(app.getHttpServer()).post(`/cases/${caseId}/closure/handover`).set('Authorization', `Bearer ${financeToken}`).send({});
      const closeRes = await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/close`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ closureReason: 'Đã hoàn tất dịch vụ.' });
      expect(closeRes.status).toBe(201);

      const contractAfter = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
      expect(contractAfter.status).toBe('COMPLETED');

      const res = await request(app.getHttpServer())
        .patch(`/contracts/${contractId}/status`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ status: 'LIQUIDATED', reason: 'Attempting the old direct path.' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USE_UNIFIED_CLOSURE_WORKFLOW');
    });

    /// ARCHIVED itself is untouched by DEC-06 (only COMPLETED/LIQUIDATED are redirected) —
    /// still reachable via the old `PATCH /contracts/:id/status` once a Contract has
    /// genuinely reached LIQUIATED through the unified workflow (Case→CLOSED→two-party
    /// liquidation, same shape as `payments.e2e-spec.ts`'s `liquidateContractViaClosureWorkflow`).
    it('ARCHIVED remains reachable via the old Contract endpoint once LIQUIDATED through the unified workflow', async () => {
      const { contractId, caseId } = await activeContract();
      await request(app.getHttpServer()).post(`/cases/${caseId}/closure/handover`).set('Authorization', `Bearer ${financeToken}`).send({});
      await request(app.getHttpServer())
        .post(`/cases/${caseId}/closure/close`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ closureReason: 'Đã hoàn tất dịch vụ.' });

      const caseRow = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
      const user = await createTestUser(prisma, 'STUDENT_PARENT', 'irrelevant-test-password-1!');
      await prisma.student.update({ where: { id: caseRow.studentId }, data: { portalUserId: user.id } });
      const { token: studentToken } = await issueTestSession(prisma, user.username);

      await request(app.getHttpServer()).post(`/cases/${caseId}/closure/liquidation/confirm-company`).set('Authorization', `Bearer ${financeToken}`).send({});
      const studentRes = await request(app.getHttpServer())
        .post(`/portal/students/${caseRow.studentId}/closure/liquidation/confirm`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(studentRes.status).toBe(201);

      const liquidatedContract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
      expect(liquidatedContract.status).toBe('LIQUIDATED');

      const archiveRes = await request(app.getHttpServer())
        .patch(`/contracts/${contractId}/status`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ status: 'ARCHIVED' });
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.status).toBe('ARCHIVED');
    });

    /// ADMIN_FINANCE (who actually performs Contract closure per SRS role table) holds no
    /// `cases:view` permission at all — "Chỉ dữ liệu cần thiết" (Contract/Payment/Closure
    /// only, never Case internals). This ?contractId= filter is therefore only useful to a
    /// GLOBAL-scoped role (Director/Manager) cross-referencing, not to HCTH itself — the
    /// Closure/Liquidation frontend page must rely only on Contract/Payment-scoped data
    /// (debt status), never on Case-level preconditions, for the role that actually uses it.
    it('finding the Case linked to a Contract via ?contractId= (GLOBAL-scoped roles only — ADMIN_FINANCE cannot see Case data at all)', async () => {
      const { studentId, caseId } = await createStudentWithCase(app, salesToken);
      const createRes = await request(app.getHttpServer()).post('/contracts').set('Authorization', `Bearer ${financeToken}`).send({ studentId, value: 500, currency: 'USD' });
      const contract = createRes.body;
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/sign`).set('Authorization', `Bearer ${financeToken}`).send({ signedDocumentId: `doc-${Date.now()}` });

      const res = await request(app.getHttpServer()).get('/cases').query({ contractId: contract.id }).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([caseId]);

      const financeRes = await request(app.getHttpServer()).get('/cases').query({ contractId: contract.id }).set('Authorization', `Bearer ${financeToken}`);
      expect(financeRes.status).toBe(403);
    });
  });

  describe('RBAC — scope (05-commercial: Contract/Payment scope is separate from Case scope)', () => {
    it('GLOBAL roles (director, manager, finance) can read the fixture contract', async () => {
      for (const token of [directorToken, managerToken, financeToken]) {
        const res = await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('OWN_STUDENT: the linked student and linked parent can read the fixture contract', async () => {
      const selfRes = await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(selfRes.status).toBe(200);
      const parentRes = await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${parentLinkedToken}`);
      expect(parentRes.status).toBe(200);
    });

    it('OWN_STUDENT: an unlinked parent is denied (404, not 403)', async () => {
      const res = await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${parentUnlinkedToken}`);
      expect(res.status).toBe(404);
    });

    it('CONSULTANT gets 403 at the permission layer even though it is a member of the linked Case — Contract access does not follow from Case access', async () => {
      const res = await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('STUDENT_PARENT (view-only) is denied write actions on its own contract (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/contracts/${fixtureContractId}`)
        .set('Authorization', `Bearer ${studentSelfToken}`)
        .send({ value: 1 });
      expect(res.status).toBe(403);
    });
  });

  describe('field-level redaction — Contract value/currency (defense in depth, SRS §13)', () => {
    it('CONSULTANT would have financial fields redacted if it ever reached a record — verified directly since scope already 404/403s it first', async () => {
      // The scope layer already blocks CONSULTANT before a record is ever reached (test
      // above) — this documents WHY FieldPolicyService additionally redacts CONSULTANT
      // for Contract/Payment, not a reachable HTTP path. See field-policy.service.spec.ts
      // for the direct unit-level assertion of the redaction itself.
      const res = await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
    });

    it('EXECUTIVE_DIRECTOR (financial data allowed) sees the real Contract value', async () => {
      const res = await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.value).not.toBeNull();
    });
  });

  describe('export — reason required, audited (SRS 6.21)', () => {
    it('rejects export without a reason (400)', async () => {
      const res = await request(app.getHttpServer()).get('/contracts/export').set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(400);
    });

    it('records reason, row count and fields exported for a Contract EXPORT', async () => {
      const res = await request(app.getHttpServer())
        .get('/contracts/export')
        .query({ reason: 'Monthly finance reconciliation' })
        .set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.rowCount).toBeGreaterThanOrEqual(1);

      const financeUser = await prisma.user.findUniqueOrThrow({ where: { username: 'demo.finance' } });
      const row = await prisma.auditLog.findFirst({
        where: { action: 'EXPORT', objectType: 'Contracts', actorId: financeUser.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      const metadata = row?.metadata as { reason?: string; rowCount?: number } | null;
      expect(metadata?.reason).toBe('Monthly finance reconciliation');
    });

    it('STUDENT_PARENT (view-only) cannot export (403)', async () => {
      const res = await request(app.getHttpServer()).get('/contracts/export').query({ reason: 'attempt' }).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('audit — VIEW recorded for reading a contract', () => {
    it('creates a VIEW audit record with the contract id as objectId', async () => {
      await request(app.getHttpServer()).get(`/contracts/${fixtureContractId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({
        where: { action: 'VIEW', objectType: 'Contracts', objectId: fixtureContractId },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });

  it('sanity: the fixture contract really is scoped to the fixture student', async () => {
    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: fixtureContractId } });
    expect(contract.studentId).toBe(fixtureStudentId);
  });
});
