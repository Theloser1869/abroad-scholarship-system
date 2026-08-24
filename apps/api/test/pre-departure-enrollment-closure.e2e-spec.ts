import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { issueTestSession } from './helpers/issue-session';

/// 09-visa/02_PRE_DEPARTURE_ENROLLMENT.md: pre-departure checklist (configurable
/// category, not hard-coded), Enrollment (real Offer/Program/University FKs, ACCEPTED-
/// offer-only target, at-most-one-CONFIRMED-per-case), and Closure — extending Phase 04's
/// existing `CasesService.close()` with Payment/Visa/Enrollment/pre-departure
/// preconditions, reusing `PaymentsService`/`VisaStatusService` (never a second debt/
/// status calculation), never a bare status PATCH in a Visa/Enrollment controller.
describe('Pre-Departure + Enrollment + Closure (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let managerToken: string;
  let financeToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let consultantBToken: string;
  let salesToken: string;

  let caseAId: string;
  let programAId: string;

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
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    const programA = await prisma.program.findUniqueOrThrow({ where: { programCode: 'PRG-2026-90001' } });
    programAId = programA.id;
  });

  const consultantCaseIds: string[] = [];

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

  afterAll(async () => {
    if (consultantCaseIds.length > 0) {
      await prisma.caseMember.deleteMany({ where: { userId: consultantAId, caseId: { in: consultantCaseIds } } });
    }
    await app.close();
  });

  // `intendedIntake` defaults to a fresh random value each call — Application's own
  // duplicate-prevention rule (docs/DECISIONS.md DEC-05) rejects a second ACTIVE
  // application for the same (student, program, intake) while the first is still
  // non-terminal (e.g. still OFFER), which several tests below deliberately call this
  // helper twice for the SAME case to set up.
  async function createAcceptedOffer(caseId: string, intendedIntake = `Intake-${randomUUID()}`): Promise<{ offerId: string; applicationId: string }> {
    const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId: programAId, intendedIntake });
    const applicationId = created.body.id;
    await request(app.getHttpServer()).patch(`/applications/${applicationId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
    await request(app.getHttpServer()).patch(`/applications/${applicationId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY_FOR_REVIEW' });
    await request(app.getHttpServer()).post(`/applications/${applicationId}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
    const offerRes = await request(app.getHttpServer()).post(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Unconditional' });
    const acceptRes = await request(app.getHttpServer()).post(`/offers/${offerRes.body.id}/respond`).set('Authorization', `Bearer ${consultantAToken}`).send({ decision: 'ACCEPT' });
    expect(acceptRes.status).toBe(201);
    return { offerId: offerRes.body.id, applicationId };
  }

  async function signContractForCase(studentId: string): Promise<void> {
    const createRes = await request(app.getHttpServer())
      .post('/contracts')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ studentId, value: 2000, currency: 'USD' });
    const contract = createRes.body;
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
    await request(app.getHttpServer())
      .post(`/contracts/${contract.id}/sign`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ signedDocumentId: `doc-closure-e2e-${randomUUID()}` });
    await request(app.getHttpServer())
      .post(`/contracts/${contract.id}/payments`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ installmentNo: 1, amount: 2000, currency: 'USD', dueDate: '2026-12-01' });
  }

  describe('Pre-Departure Checklist — RBAC / configurable category', () => {
    it('CONSULTANT can add an item with a free-text category (not hard-coded)', async () => {
      const { caseId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseId}/pre-departure`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ title: 'Book flight', category: 'flight', required: true });
      expect(res.status).toBe(201);
      expect(res.body.category).toBe('flight');
    });

    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/cases/${caseAId}/pre-departure`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('a WAIVED item is DONE-equivalent for completion purposes', async () => {
      const { caseId } = await createCaseForConsultant();
      const item = await request(app.getHttpServer()).post(`/cases/${caseId}/pre-departure`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Travel insurance', category: 'insurance' });
      const res = await request(app.getHttpServer()).patch(`/pre-departure-items/${item.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'WAIVED' });
      expect(res.status).toBe(200);
      expect(res.body.completedAt).not.toBeNull();
    });
  });

  describe('Enrollment — Offer validity, RBAC, at-most-one-confirmed', () => {
    it('rejects an Enrollment targeting a non-ACCEPTED offer', async () => {
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId: programAId });
      await request(app.getHttpServer()).patch(`/applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY_FOR_REVIEW' });
      await request(app.getHttpServer()).post(`/applications/${created.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      const offerRes = await request(app.getHttpServer()).post(`/applications/${created.body.id}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Unconditional' });
      // Never accepted — status stays RECEIVED.
      const res = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId: offerRes.body.id });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_ENROLLMENT_TARGET');
    });

    it('creates an Enrollment against an ACCEPTED offer, deriving university/program — never duplicating them', async () => {
      const { caseId } = await createCaseForConsultant();
      const { offerId } = await createAcceptedOffer(caseId);
      const res = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId });
      expect(res.status).toBe(201);
      expect(res.body.programId).toBe(programAId);
      expect(res.body.status).toBe('PLANNED');
    });

    /// DEC-12 — list/detail embed a University + Program summary so an enrollment row can
    /// show "institution, program" without a per-row N+1 fetch (mirrors DEC-09/10/11).
    it('list and detail embed the University/Program summary (DEC-12)', async () => {
      const { caseId } = await createCaseForConsultant();
      const { offerId } = await createAcceptedOffer(caseId);
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId });
      expect(created.status).toBe(201);

      const listRes = await request(app.getHttpServer()).get(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(listRes.status).toBe(200);
      const row = listRes.body.find((e: { id: string }) => e.id === created.body.id);
      expect(row.university).toEqual({ id: expect.any(String), officialName: expect.any(String), countryCode: expect.any(String) });
      expect(row.program).toEqual({ id: programAId, degreeLevel: expect.any(String), major: expect.any(String) });

      const detailRes = await request(app.getHttpServer()).get(`/enrollments/${created.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(detailRes.body.university.officialName).toEqual(expect.any(String));
      expect(detailRes.body.program.id).toBe(programAId);
    });

    it('confirming enforces at-most-one-CONFIRMED-per-case', async () => {
      const { caseId } = await createCaseForConsultant();
      const { offerId: offerId1 } = await createAcceptedOffer(caseId);
      const enrollment1 = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId: offerId1 });
      const confirm1 = await request(app.getHttpServer()).post(`/enrollments/${enrollment1.body.id}/confirm`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(confirm1.status).toBe(201);
      expect(confirm1.body.status).toBe('CONFIRMED');

      const { offerId: offerId2 } = await createAcceptedOffer(caseId);
      const enrollment2 = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId: offerId2 });
      const confirm2 = await request(app.getHttpServer()).post(`/enrollments/${enrollment2.body.id}/confirm`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(confirm2.status).toBe(409);
      expect(confirm2.body.error.code).toBe('CONFIRMED_ENROLLMENT_EXISTS');
    });

    it('withdrawing frees the case for a different confirmed enrollment', async () => {
      const { caseId } = await createCaseForConsultant();
      const { offerId: offerId1 } = await createAcceptedOffer(caseId);
      const enrollment1 = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId: offerId1 });
      await request(app.getHttpServer()).post(`/enrollments/${enrollment1.body.id}/confirm`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      const withdrawRes = await request(app.getHttpServer()).post(`/enrollments/${enrollment1.body.id}/withdraw`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(withdrawRes.status).toBe(201);

      const { offerId: offerId2 } = await createAcceptedOffer(caseId);
      const enrollment2 = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId: offerId2 });
      const confirm2 = await request(app.getHttpServer()).post(`/enrollments/${enrollment2.body.id}/confirm`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(confirm2.status).toBe(201);
    });

    it('redacts internalNotes from STUDENT_PARENT', async () => {
      const { caseId } = await createCaseForConsultant();
      const { offerId } = await createAcceptedOffer(caseId);
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId });
      await request(app.getHttpServer()).patch(`/enrollments/${created.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ internalNotes: 'Staff-only note.' });

      const staffRes = await request(app.getHttpServer()).get(`/enrollments/${created.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(staffRes.body.internalNotes).toBe('Staff-only note.');
    });
  });

  describe('Closure — validation gates', () => {
    it('OUTSTANDING_DEBT_REMAINS blocks closure while a payment is unresolved', async () => {
      const { studentId, caseId } = await createCaseForConsultant();
      await signContractForCase(studentId);
      const res = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'Attempting closure with unpaid balance.' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OUTSTANDING_DEBT_REMAINS');
    });

    it('VISA_IN_PROGRESS blocks closure while a non-terminal Visa exists', async () => {
      const { caseId } = await createCaseForConsultant();
      await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      const res = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'Attempting closure with an open visa.' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VISA_IN_PROGRESS');
    });

    it('closure succeeds once the Visa reaches a terminal status (Withdrawn)', async () => {
      const { caseId } = await createCaseForConsultant();
      const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'WITHDRAWN' });
      const res = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'Visa withdrawn, no other blockers.' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CLOSED');
    });

    it('ENROLLMENT_NOT_CONFIRMED blocks closure once admission was attempted but nothing is confirmed', async () => {
      const { caseId } = await createCaseForConsultant();
      await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId: programAId });
      const res = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'Attempting closure with unresolved admission.' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ENROLLMENT_NOT_CONFIRMED');
    });

    it('PRE_DEPARTURE_CHECKLIST_INCOMPLETE blocks closure while a required item is open', async () => {
      const { caseId } = await createCaseForConsultant();
      await request(app.getHttpServer()).post(`/cases/${caseId}/pre-departure`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Confirm accommodation', category: 'accommodation', required: true });
      const res = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'Attempting closure with an open pre-departure item.' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PRE_DEPARTURE_CHECKLIST_INCOMPLETE');
    });

    it('a case with no Contract/Visa/Application/pre-departure activity at all still closes cleanly (Phase 04 regression)', async () => {
      const { caseId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'No admission/visa/contract activity — closed early.' });
      expect(res.status).toBe(200);
    });

    it('full happy path: debt settled, visa granted, enrollment confirmed, pre-departure complete — closure succeeds', async () => {
      const { studentId, caseId } = await createCaseForConsultant();

      // Debt settled.
      const createRes = await request(app.getHttpServer()).post('/contracts').set('Authorization', `Bearer ${financeToken}`).send({ studentId, value: 500, currency: 'USD' });
      const contract = createRes.body;
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/sign`).set('Authorization', `Bearer ${financeToken}`).send({ signedDocumentId: `doc-${randomUUID()}` });
      const paymentRes = await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 500, currency: 'USD', dueDate: '2026-12-01' });
      await request(app.getHttpServer()).post(`/payments/${paymentRes.body.id}/record`).set('Authorization', `Bearer ${financeToken}`).send({ amount: 500 });

      // Visa granted.
      const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });
      await request(app.getHttpServer()).post(`/visas/${visaRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      await request(app.getHttpServer()).post(`/visas/${visaRes.body.id}/result`).set('Authorization', `Bearer ${consultantAToken}`).send({ result: 'GRANTED' });

      // Enrollment confirmed.
      const { offerId } = await createAcceptedOffer(caseId);
      const enrollmentRes = await request(app.getHttpServer()).post(`/cases/${caseId}/enrollments`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerId });
      await request(app.getHttpServer()).post(`/enrollments/${enrollmentRes.body.id}/confirm`).set('Authorization', `Bearer ${consultantAToken}`).send({});

      // Pre-departure complete.
      const item = await request(app.getHttpServer()).post(`/cases/${caseId}/pre-departure`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Book flight', category: 'flight', required: true });
      await request(app.getHttpServer()).patch(`/pre-departure-items/${item.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });

      const closeRes = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'All Phase 09 conditions satisfied.' });
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.status).toBe('CLOSED');
      expect(closeRes.body.closedAt).not.toBeNull();
    });

    it('an unauthorized caller (consultant.b, not a case member) is denied (404), not a partial precondition error', async () => {
      const { caseId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${consultantBToken}`).send({ closureReason: 'unauthorized attempt' });
      expect(res.status).toBe(404);
    });
  });

  describe('audit', () => {
    it('creates an ARCHIVE audit record for a successful closure', async () => {
      const { caseId } = await createCaseForConsultant();
      await request(app.getHttpServer()).patch(`/cases/${caseId}/close`).set('Authorization', `Bearer ${directorToken}`).send({ closureReason: 'Audit check.' });
      const row = await prisma.auditLog.findFirst({ where: { action: 'ARCHIVE', objectType: 'Cases', objectId: caseId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
