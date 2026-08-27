import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JobRunnerService } from '../src/common/jobs/job-runner.service';
import { drainJobs } from './helpers/drain-jobs';
import { createStudentWithCase } from './helpers/create-student-case';
import { uploadTestDocument } from './helpers/upload-document';
import { issueTestSession } from './helpers/issue-session';

/// 09-visa/01_VISA.md: Visa FSM (Not Started→...→Granted/Refused/Withdrawn), checklist
/// configurable by country+visaType (VisaChecklistTemplate → instantiated
/// VisaChecklistItem rows), mandatory-checklist gate before Ready/Submitted, Document
/// reuse for evidence, Task/Notification integration (VISA_GRANTED, the last Phase
/// 06-deferred trigger), field-level `internalNotes` redaction.
describe('Visa (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobRunner: JobRunnerService;
  let directorToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let consultantBToken: string;
  let salesToken: string;
  let financeToken: string;
  let studentSelfToken: string;

  let caseAId: string;
  let visaAId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jobRunner = app.get(JobRunnerService);

    ({ token: directorToken } = await issueTestSession(prisma, 'demo.director'));
    ({ token: consultantAToken, userId: consultantAId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    const visaA = await prisma.visa.findUniqueOrThrow({ where: { visaCode: 'VISA-2026-90001' } });
    visaAId = visaA.id;
  });

  // See the identical tracked-cleanup comment in admission-application.e2e-spec.ts —
  // `createCaseForConsultant` below adds a fresh CaseMember row per call that otherwise
  // outlives the run (this dev DB is never reset between suites).
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

  describe('Visa Checklist Template — configurable by country + visa type', () => {
    it('ED can create a template; a duplicate (country, visaType, title) is rejected', async () => {
      const title = `Bank statement ${randomUUID()}`;
      const first = await request(app.getHttpServer()).post('/visa-checklist-templates').set('Authorization', `Bearer ${directorToken}`).send({ countryCode: 'CA', visaType: 'Study Permit', title });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer()).post('/visa-checklist-templates').set('Authorization', `Bearer ${directorToken}`).send({ countryCode: 'CA', visaType: 'Study Permit', title });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_VISA_CHECKLIST_TEMPLATE');
    });

    it('CONSULTANT can view but not create templates (403) — master-data curation stays ED/DM-only', async () => {
      const viewRes = await request(app.getHttpServer()).get('/visa-checklist-templates').set('Authorization', `Bearer ${consultantAToken}`);
      expect(viewRes.status).toBe(200);
      const createRes = await request(app.getHttpServer()).post('/visa-checklist-templates').set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'GB', visaType: 'Tier 4', title: 'Nope' });
      expect(createRes.status).toBe(403);
    });
  });

  describe('Visa — RBAC / cross-case', () => {
    it('GLOBAL and CASE_MEMBER roles can read the fixture visa', async () => {
      for (const token of [directorToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get(`/visas/${visaAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/visas/${visaAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('SALES_MARKETING has zero visa grant (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/cases/${caseAId}/visas`).set('Authorization', `Bearer ${salesToken}`);
      expect(res.status).toBe(403);
    });

    it('ADMIN_FINANCE holds view-only visa:view (client permission-matrix remediation, 2026-08-25) but is still denied at the Case NONE-scope layer (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/visas/${visaAId}`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(404);
    });

    it('does not create a new Student/Case — Visa only links an existing Case', async () => {
      const res = await request(app.getHttpServer()).get(`/visas/${visaAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.body.caseId).toBe(caseAId);
    });
  });

  describe('Visa — creation, checklist instantiation, at-most-one-active', () => {
    it('creating a Visa instantiates matching active templates into real checklist items', async () => {
      const countryCode = 'CA';
      const visaType = `Study Permit ${randomUUID()}`;
      const templateRes = await request(app.getHttpServer()).post('/visa-checklist-templates').set('Authorization', `Bearer ${directorToken}`).send({ countryCode, visaType, title: 'Proof of funds' });
      expect(templateRes.status).toBe(201);

      const { caseId } = await createCaseForConsultant();
      const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode, visaType });
      expect(visaRes.status).toBe(201);
      expect(visaRes.body.visaCode).toMatch(/^VISA-\d{4}-\d{5}$/);

      const checklistRes = await request(app.getHttpServer()).get(`/visas/${visaRes.body.id}/checklist`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(checklistRes.body.some((i: { title: string }) => i.title === 'Proof of funds')).toBe(true);
    });

    it('rejects a second active Visa for the same case', async () => {
      const { caseId } = await createCaseForConsultant();
      const first = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('ACTIVE_VISA_EXISTS');
    });

    it('allows a new attempt after WITHDRAWN — a NEW row, history preserved', async () => {
      const { caseId } = await createCaseForConsultant();
      const first = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      await request(app.getHttpServer()).patch(`/visas/${first.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'WITHDRAWN' });

      const second = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);

      const firstStill = await request(app.getHttpServer()).get(`/visas/${first.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(firstStill.body.status).toBe('WITHDRAWN');
    });
  });

  describe('Visa — workflow FSM', () => {
    async function freshVisa(): Promise<string> {
      const { caseId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      return res.body.id;
    }

    it('blocks READY until the mandatory checklist is complete', async () => {
      const visaId = await freshVisa();
      await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).post(`/visas/${visaId}/checklist`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Passport', required: true });
      const res = await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CHECKLIST_INCOMPLETE');
    });

    it('rejects an illegal status jump (Not Started -> Submitted directly)', async () => {
      const visaId = await freshVisa();
      const res = await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
      expect(res.status).toBe(400); // SUBMITTED excluded from the generic transition DTO
    });

    it('walks the full path: Preparing -> Ready -> Submitted -> Appointment -> Interview -> Granted', async () => {
      const visaId = await freshVisa();
      await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });

      const item = await request(app.getHttpServer()).post(`/visas/${visaId}/checklist`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Passport', required: true });
      await request(app.getHttpServer()).patch(`/visa-checklist-items/${item.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });

      const readyRes = await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });
      expect(readyRes.status).toBe(200);

      const submitRes = await request(app.getHttpServer())
        .post(`/visas/${visaId}/submit`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ submissionReference: `REF-${randomUUID()}` });
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.status).toBe('SUBMITTED');
      expect(submitRes.body.submittedAt).not.toBeNull();

      const appointmentRes = await request(app.getHttpServer())
        .post(`/visas/${visaId}/appointment`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ appointmentAt: '2026-06-01T09:00:00Z', appointmentLocation: 'Embassy' });
      expect(appointmentRes.status).toBe(201);
      expect(appointmentRes.body.status).toBe('APPOINTMENT');

      const interviewRes = await request(app.getHttpServer())
        .post(`/visas/${visaId}/interview`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ interviewAt: '2026-06-01T10:00:00Z', interviewNotes: 'Went well.' });
      expect(interviewRes.status).toBe(201);
      expect(interviewRes.body.status).toBe('INTERVIEW');

      const resultRes = await request(app.getHttpServer())
        .post(`/visas/${visaId}/result`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ result: 'GRANTED', resultDate: '2026-06-05T00:00:00Z' });
      expect(resultRes.status).toBe(201);
      expect(resultRes.body.status).toBe('GRANTED');
      expect(resultRes.body.resultDate).not.toBeNull();
    });

    it('a Refused result is reachable directly from Submitted (no interview required for every visa type)', async () => {
      const visaId = await freshVisa();
      await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });
      await request(app.getHttpServer()).post(`/visas/${visaId}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      const res = await request(app.getHttpServer()).post(`/visas/${visaId}/result`).set('Authorization', `Bearer ${consultantAToken}`).send({ result: 'REFUSED', reason: 'Insufficient funds evidence.' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('REFUSED');
      expect(res.body.reason).toBe('Insufficient funds evidence.');
    });

    it('GRANTED/REFUSED are reachable only via the dedicated result action, never the generic status PATCH', async () => {
      const res = await request(app.getHttpServer()).patch(`/visas/${visaAId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'GRANTED' });
      expect(res.status).toBe(400);
    });

    it('a terminal (WITHDRAWN) visa freezes further generic edits', async () => {
      const visaId = await freshVisa();
      await request(app.getHttpServer()).patch(`/visas/${visaId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'WITHDRAWN' });
      const res = await request(app.getHttpServer()).patch(`/visas/${visaId}`).set('Authorization', `Bearer ${consultantAToken}`).send({ visaType: 'F-2' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VISA_CLOSED');
    });
  });

  describe('Visa — evidence -> Document linkage', () => {
    it('linking evidence on submit grants the case members and student access', async () => {
      const { caseId } = await createCaseForConsultant();
      const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });

      const documentRes = await uploadTestDocument(app, consultantAToken, {
        ownerEntity: 'Visa',
        ownerId: visaRes.body.id,
        documentType: 'visa_form',
        title: 'Visa application form',
      });
      const submitRes = await request(app.getHttpServer())
        .post(`/visas/${visaRes.body.id}/submit`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ evidenceDocumentId: documentRes.body.id });
      expect(submitRes.status).toBe(201);
      expect(submitRes.body).not.toHaveProperty('fileUrl');

      await drainJobs(jobRunner);
      const downloadRes = await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.downloadUrl).toMatch(/^\/documents\/download\//);
    });

    // Phase 13 HIGH-fix regression — SRS §13 gives Consultant only "Xem hạn chế" (restricted
    // view) on Visa evidence, vs full access for Document Specialist/GĐĐH/Trưởng phòng;
    // §6.14 asks for visa-sensitive documents to carry their own, separate download
    // permission. The uploader always keeps full access regardless of role (that grant is
    // independent of `grantCaseAccess`), so this test deliberately has a non-Consultant case
    // member upload the evidence, to isolate the case-membership grant this fix changes.
    it('a Consultant case member gets view-only access to visa evidence they did not upload; the uploader keeps full access', async () => {
      const { caseId } = await createCaseForConsultant();
      const { token: docSpecialistToken, userId: docSpecialistId } = await issueTestSession(prisma, 'demo.docspecialist');
      await request(app.getHttpServer())
        .post(`/cases/${caseId}/members`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ userId: docSpecialistId, role: 'COLLABORATOR' });

      const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });

      const documentRes = await uploadTestDocument(app, docSpecialistToken, {
        ownerEntity: 'Visa',
        ownerId: visaRes.body.id,
        documentType: 'passport_copy',
        title: 'Passport copy',
      });
      const submitRes = await request(app.getHttpServer())
        .post(`/visas/${visaRes.body.id}/submit`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ evidenceDocumentId: documentRes.body.id });
      expect(submitRes.status).toBe(201);
      await drainJobs(jobRunner);

      const consultantView = await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(consultantView.status).toBe(200);
      const consultantDownload = await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(consultantDownload.status).toBe(404);

      const specialistDownload = await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}/download`).set('Authorization', `Bearer ${docSpecialistToken}`);
      expect(specialistDownload.status).toBe(200);
    });
  });

  describe('Visa — field-level security', () => {
    it('redacts internalNotes from STUDENT_PARENT but keeps it visible to staff', async () => {
      const staffRes = await request(app.getHttpServer()).get(`/visas/${visaAId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(staffRes.body.internalNotes).toBe('Staff-only visa strategy note.');

      const studentRes = await request(app.getHttpServer()).get(`/visas/${visaAId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(studentRes.status).toBe(200);
      expect(studentRes.body.internalNotes).toBeNull();
      // Non-sensitive fields — the student's OWN visa outcome — remain visible.
      expect(studentRes.body.visaCode).toBe('VISA-2026-90001');
      expect(studentRes.body.status).toBe('SUBMITTED');
    });

    it('the same redaction rule is never bypassed by the list endpoint', async () => {
      const res = await request(app.getHttpServer()).get(`/cases/${caseAId}/visas`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      const fixture = res.body.data.find((v: { id: string }) => v.id === visaAId);
      expect(fixture.internalNotes).toBeNull();
    });
  });

  describe('Task integration — idempotent VISA_GRANTED auto-generation', () => {
    it('generates a task from an active template exactly once', async () => {
      const template = await request(app.getHttpServer())
        .post('/task-templates')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ code: `TT-VISA-GRANTED-${randomUUID()}`, name: 'Visa granted follow-up', module: 'visa', taskType: 'follow_up', title: 'Process visa grant', deadlineOffsetDays: 3, triggerEvent: 'VISA_GRANTED' });
      expect(template.status).toBe(201);
      try {
        const { caseId } = await createCaseForConsultant();
        const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
        await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
        await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });
        await request(app.getHttpServer()).post(`/visas/${visaRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
        const resultRes = await request(app.getHttpServer()).post(`/visas/${visaRes.body.id}/result`).set('Authorization', `Bearer ${consultantAToken}`).send({ result: 'GRANTED' });
        expect(resultRes.status).toBe(201);

        const count = await prisma.task.count({ where: { templateId: template.body.id, sourceEntityId: visaRes.body.id } });
        expect(count).toBe(1);
      } finally {
        await prisma.taskTemplate.update({ where: { id: template.body.id }, data: { active: false } });
      }
    });

    it('a REFUSED result never fires the VISA_GRANTED trigger', async () => {
      const template = await request(app.getHttpServer())
        .post('/task-templates')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ code: `TT-VISA-GRANTED-2-${randomUUID()}`, name: 'Visa granted follow-up 2', module: 'visa', taskType: 'follow_up', title: 'Process visa grant', deadlineOffsetDays: 3, triggerEvent: 'VISA_GRANTED' });
      try {
        const { caseId } = await createCaseForConsultant();
        const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
        await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
        await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });
        await request(app.getHttpServer()).post(`/visas/${visaRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
        await request(app.getHttpServer()).post(`/visas/${visaRes.body.id}/result`).set('Authorization', `Bearer ${consultantAToken}`).send({ result: 'REFUSED' });

        const count = await prisma.task.count({ where: { templateId: template.body.id, sourceEntityId: visaRes.body.id } });
        expect(count).toBe(0);
      } finally {
        await prisma.taskTemplate.update({ where: { id: template.body.id }, data: { active: false } });
      }
    });
  });

  describe('Notification integration', () => {
    it('VISA_SUBMITTED notifies every current case member (in-app + email)', async () => {
      const { caseId } = await createCaseForConsultant();
      const visaRes = await request(app.getHttpServer()).post(`/cases/${caseId}/visas`).set('Authorization', `Bearer ${consultantAToken}`).send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/visas/${visaRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY' });
      await request(app.getHttpServer()).post(`/visas/${visaRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});

      const notifications = await prisma.notification.findMany({ where: { event: 'VISA_SUBMITTED', dedupeKey: { startsWith: `visa_submitted:${visaRes.body.id}:` } } });
      expect(notifications.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('audit', () => {
    it('creates a VIEW audit record for reading a visa', async () => {
      await request(app.getHttpServer()).get(`/visas/${visaAId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'VIEW', objectType: 'Visas', objectId: visaAId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
