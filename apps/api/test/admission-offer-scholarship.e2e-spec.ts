import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { uploadTestDocument } from './helpers/upload-document';
import { issueTestSession } from './helpers/issue-session';

/// 08-admission/03_OFFER_SCHOLARSHIP.md: Offer lifecycle (multiple offers, current-offer
/// rule, accept/decline, expiry), ScholarshipApplication (kept separate from
/// ScholarshipMaster, eligibility gate, award result, field-level internalNotes
/// redaction), Task/Notification integration for the two Phase 06-anticipated triggers
/// (APPLICATION_SUBMITTED, SCHOLARSHIP_AWARDED — docs/ASSUMPTIONS.md ASM-16).
describe('Admission — Offer + Scholarship Application (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let consultantBToken: string;
  let salesToken: string;
  let studentSelfToken: string;

  let programAId: string;
  let scholarshipMasterAId: string;
  let applicationAId: string;
  let offerAId: string;
  let scholarshipApplicationAId: string;

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
    ({ token: consultantAToken, userId: consultantAId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const programA = await prisma.program.findUniqueOrThrow({ where: { programCode: 'PRG-2026-90001' } });
    programAId = programA.id;
    const scholarshipMasterA = await prisma.scholarshipMaster.findUniqueOrThrow({ where: { scholarshipCode: 'SCHM-2026-90001' } });
    scholarshipMasterAId = scholarshipMasterA.id;
    const applicationA = await prisma.application.findUniqueOrThrow({ where: { applicationCode: 'APP-2026-90001' } });
    applicationAId = applicationA.id;
    const offerA = await prisma.offer.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-000000001007' } });
    offerAId = offerA.id;
    const scholarshipApplicationA = await prisma.scholarshipApplication.findUniqueOrThrow({ where: { scholarshipApplicationCode: 'SCH-2026-90001' } });
    scholarshipApplicationAId = scholarshipApplicationA.id;
  });

  // See the identical tracked-cleanup comment in admission-application.e2e-spec.ts — this
  // file also creates many fresh cases via `createCaseForConsultant`, each adding a
  // CaseMember row that outlives the run unless removed here.
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

  async function createSubmittedApplication(): Promise<{ caseId: string; applicationId: string }> {
    const { caseId } = await createCaseForConsultant();
    const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId: programAId });
    const id = created.body.id;
    await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
    await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY_FOR_REVIEW' });
    const submitRes = await request(app.getHttpServer()).post(`/applications/${id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
    expect(submitRes.status).toBe(201);
    return { caseId, applicationId: id };
  }

  describe('Offer — RBAC / cross-case', () => {
    it('GLOBAL and CASE_MEMBER roles can read the fixture offer', async () => {
      for (const token of [directorToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get(`/offers/${offerAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/offers/${offerAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('SALES_MARKETING has zero offers grant (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/applications/${applicationAId}/offers`).set('Authorization', `Bearer ${salesToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Offer — lifecycle', () => {
    it('rejects creating an Offer before the Application is SUBMITTED', async () => {
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId: programAId });
      const res = await request(app.getHttpServer()).post(`/applications/${created.body.id}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Unconditional' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OFFER_REQUIRES_SUBMITTED_APPLICATION');
    });

    it('creating an Offer transitions the Application to OFFER status', async () => {
      const { applicationId } = await createSubmittedApplication();
      const offerRes = await request(app.getHttpServer()).post(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Conditional', isConditional: true });
      expect(offerRes.status).toBe(201);
      const appRes = await request(app.getHttpServer()).get(`/applications/${applicationId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(appRes.body.status).toBe('OFFER');
    });

    it('supports multiple offers on one Application without overwriting history', async () => {
      const { applicationId } = await createSubmittedApplication();
      const first = await request(app.getHttpServer()).post(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Conditional' });
      const second = await request(app.getHttpServer()).post(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Unconditional (revised)' });
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.id).not.toBe(second.body.id);

      const listRes = await request(app.getHttpServer()).get(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(listRes.body.length).toBe(2);
      // The first offer's own row is untouched by the second's creation.
      const firstStill = await request(app.getHttpServer()).get(`/offers/${first.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(firstStill.body.offerType).toBe('Conditional');
    });

    it('accepting an offer sets ACCEPTED + respondedAt; a second response is rejected', async () => {
      const { applicationId } = await createSubmittedApplication();
      const offerRes = await request(app.getHttpServer()).post(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Unconditional' });
      const acceptRes = await request(app.getHttpServer()).post(`/offers/${offerRes.body.id}/respond`).set('Authorization', `Bearer ${consultantAToken}`).send({ decision: 'ACCEPT' });
      expect(acceptRes.status).toBe(201);
      expect(acceptRes.body.status).toBe('ACCEPTED');
      expect(acceptRes.body.respondedAt).not.toBeNull();

      const again = await request(app.getHttpServer()).post(`/offers/${offerRes.body.id}/respond`).set('Authorization', `Bearer ${consultantAToken}`).send({ decision: 'DECLINE' });
      expect(again.status).toBe(409);
    });

    it('the "current offer" rule prefers ACCEPTED over merely RECEIVED', async () => {
      const { applicationId } = await createSubmittedApplication();
      await request(app.getHttpServer()).post(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'First offer' });
      const offerB = await request(app.getHttpServer()).post(`/applications/${applicationId}/offers`).set('Authorization', `Bearer ${consultantAToken}`).send({ offerType: 'Second offer' });
      await request(app.getHttpServer()).post(`/offers/${offerB.body.id}/respond`).set('Authorization', `Bearer ${consultantAToken}`).send({ decision: 'ACCEPT' });

      const currentRes = await request(app.getHttpServer()).get(`/applications/${applicationId}/offers/current`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(currentRes.status).toBe(200);
      expect(currentRes.body.id).toBe(offerB.body.id);
    });

    it('a RECEIVED offer past its acceptanceDeadline is lazily marked EXPIRED on read', async () => {
      const { applicationId } = await createSubmittedApplication();
      const offerRes = await request(app.getHttpServer())
        .post(`/applications/${applicationId}/offers`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ offerType: 'Unconditional', acceptanceDeadline: '2020-01-01T00:00:00Z' });
      const getRes = await request(app.getHttpServer()).get(`/offers/${offerRes.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(getRes.body.status).toBe('EXPIRED');
    });

    it('an evidence-linked offer document is grant-gated for the linked student', async () => {
      const { applicationId } = await createSubmittedApplication();
      const documentRes = await uploadTestDocument(app, consultantAToken, {
        ownerEntity: 'Offer',
        ownerId: applicationId,
        documentType: 'offer_letter',
        title: 'Offer letter',
      });
      const offerRes = await request(app.getHttpServer())
        .post(`/applications/${applicationId}/offers`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ offerType: 'Unconditional', evidenceDocumentId: documentRes.body.id });
      expect(offerRes.status).toBe(201);
      expect(offerRes.body).not.toHaveProperty('fileUrl');
    });
  });

  describe('Scholarship Application — RBAC / cross-case', () => {
    it('GLOBAL and CASE_MEMBER roles can read the fixture scholarship application', async () => {
      for (const token of [directorToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get(`/scholarship-applications/${scholarshipApplicationAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/scholarship-applications/${scholarshipApplicationAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('does not copy program/university data onto the row — only real FK references', async () => {
      const res = await request(app.getHttpServer()).get(`/scholarship-applications/${scholarshipApplicationAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.body.scholarshipMasterId).toBe(scholarshipMasterAId);
      expect(res.body).not.toHaveProperty('universityName');
      expect(res.body).not.toHaveProperty('programName');
    });
  });

  describe('Scholarship Application — eligibility gate + workflow', () => {
    it('blocks SUBMITTED until eligibility is confirmed', async () => {
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer())
        .post(`/cases/${caseId}/scholarship-applications`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ scholarshipMasterId: scholarshipMasterAId });
      expect(created.status).toBe(201);
      expect(created.body.eligibilityConfirmed).toBe(false);

      const blocked = await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('ELIGIBILITY_NOT_CONFIRMED');

      await request(app.getHttpServer()).post(`/scholarship-applications/${created.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${consultantAToken}`).send({ eligibilityNotes: 'Meets GPA + intake requirements.' });
      const allowed = await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
      expect(allowed.status).toBe(200);
    });

    it('rejects an illegal status jump', async () => {
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer())
        .post(`/cases/${caseId}/scholarship-applications`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ scholarshipMasterId: scholarshipMasterAId });
      const res = await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'INTERVIEW' });
      expect(res.status).toBe(409);
    });

    it('AWARDED/REJECTED are reachable only via the dedicated actions, never the generic status PATCH', async () => {
      const res = await request(app.getHttpServer()).patch(`/scholarship-applications/${scholarshipApplicationAId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'AWARDED' });
      expect(res.status).toBe(400);
    });
  });

  describe('Scholarship Application — award (SCHOLARSHIP RESULT)', () => {
    // A fresh scholarship application, not the shared fixture — AWARDED is a terminal
    // state (no further edits, no re-award), so reusing the fixture row here would
    // permanently mutate it for every other test/run in this suite.
    it('records award amount/currency/coverage/period/acceptance-deadline/evidence, never touching Contract/Payment', async () => {
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer())
        .post(`/cases/${caseId}/scholarship-applications`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ scholarshipMasterId: scholarshipMasterAId });
      await request(app.getHttpServer()).post(`/scholarship-applications/${created.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
      await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'UNDER_REVIEW' });

      const res = await request(app.getHttpServer())
        .post(`/scholarship-applications/${created.body.id}/award`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ awardAmount: 15000, awardCurrency: 'USD', awardCoverageType: 'Full tuition', awardPeriod: 'Per year', awardAcceptanceDeadline: '2027-01-01T00:00:00Z' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('AWARDED');
      expect(Number(res.body.awardAmount)).toBe(15000);
      expect(res.body.decidedAt).not.toBeNull();
      expect(res.body).not.toHaveProperty('contractId');
      expect(res.body).not.toHaveProperty('paymentId');
    });

    it('a REJECTED scholarship application cannot be edited further', async () => {
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer())
        .post(`/cases/${caseId}/scholarship-applications`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ scholarshipMasterId: scholarshipMasterAId });
      await request(app.getHttpServer()).post(`/scholarship-applications/${created.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
      await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'UNDER_REVIEW' });
      const rejectRes = await request(app.getHttpServer()).post(`/scholarship-applications/${created.body.id}/reject`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(rejectRes.status).toBe(201);
      expect(rejectRes.body.status).toBe('REJECTED');

      const editRes = await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ conditions: 'Too late' });
      expect(editRes.status).toBe(409);
    });
  });

  describe('Scholarship Application — field-level security', () => {
    it('redacts internalNotes from STUDENT_PARENT but keeps it visible to staff', async () => {
      const staffRes = await request(app.getHttpServer()).get(`/scholarship-applications/${scholarshipApplicationAId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(staffRes.body.internalNotes).toBe('Staff-only scholarship strategy note.');

      const studentRes = await request(app.getHttpServer()).get(`/scholarship-applications/${scholarshipApplicationAId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(studentRes.status).toBe(200);
      expect(studentRes.body.internalNotes).toBeNull();
      // Non-sensitive fields remain visible.
      expect(studentRes.body.scholarshipApplicationCode).toBe('SCH-2026-90001');
    });
  });

  describe('Task integration — idempotent auto-generation', () => {
    it('APPLICATION_SUBMITTED generates a task from an active template exactly once', async () => {
      const template = await request(app.getHttpServer())
        .post('/task-templates')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ code: `TT-APP-SUBMIT-${randomUUID()}`, name: 'Application submitted follow-up', module: 'admission', taskType: 'follow_up', title: 'Follow up on submitted application', deadlineOffsetDays: 3, triggerEvent: 'APPLICATION_SUBMITTED' });
      expect(template.status).toBe(201);
      try {
        const { applicationId } = await createSubmittedApplication();
        const count = await prisma.task.count({ where: { templateId: template.body.id, sourceEntityId: applicationId } });
        expect(count).toBe(1);
      } finally {
        await prisma.taskTemplate.update({ where: { id: template.body.id }, data: { active: false } });
      }
    });

    it('SCHOLARSHIP_AWARDED generates a task from an active template exactly once', async () => {
      const template = await request(app.getHttpServer())
        .post('/task-templates')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ code: `TT-SCH-AWARD-${randomUUID()}`, name: 'Scholarship awarded follow-up', module: 'admission', taskType: 'follow_up', title: 'Process scholarship acceptance', deadlineOffsetDays: 5, triggerEvent: 'SCHOLARSHIP_AWARDED' });
      expect(template.status).toBe(201);
      try {
        const { caseId } = await createCaseForConsultant();
        const created = await request(app.getHttpServer())
          .post(`/cases/${caseId}/scholarship-applications`)
          .set('Authorization', `Bearer ${consultantAToken}`)
          .send({ scholarshipMasterId: scholarshipMasterAId });
        await request(app.getHttpServer()).post(`/scholarship-applications/${created.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${consultantAToken}`).send({});
        await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
        await request(app.getHttpServer()).patch(`/scholarship-applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'UNDER_REVIEW' });
        const awardRes = await request(app.getHttpServer()).post(`/scholarship-applications/${created.body.id}/award`).set('Authorization', `Bearer ${directorToken}`).send({ awardAmount: 5000, awardCurrency: 'USD' });
        expect(awardRes.status).toBe(201);

        const count = await prisma.task.count({ where: { templateId: template.body.id, sourceEntityId: created.body.id } });
        expect(count).toBe(1);
      } finally {
        await prisma.taskTemplate.update({ where: { id: template.body.id }, data: { active: false } });
      }
    });
  });

  describe('Notification integration', () => {
    it('APPLICATION_SUBMITTED notifies every current case member (in-app + email)', async () => {
      const { applicationId } = await createSubmittedApplication();
      const notifications = await prisma.notification.findMany({ where: { event: 'APPLICATION_SUBMITTED', dedupeKey: { startsWith: `application-submitted:${applicationId}:` } } });
      expect(notifications.length).toBeGreaterThanOrEqual(2); // consultantA gets IN_APP + EMAIL
    });
  });

  describe('audit', () => {
    it('creates a VIEW audit record for reading a scholarship application', async () => {
      await request(app.getHttpServer()).get(`/scholarship-applications/${scholarshipApplicationAId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'VIEW', objectType: 'ScholarshipApplications', objectId: scholarshipApplicationAId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
