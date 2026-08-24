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

/// 08-admission/01_MASTER_DATA.md (UniversityChoice) + 02_APPLICATION.md (Application,
/// ApplicationChecklist): School Selection Reach/Match/Safety, Application FSM
/// (Planning→Preparing→Ready for Review→Submitted→...), mandatory-checklist submission
/// gate, duplicate-active-application prevention with legitimate reapplication support
/// (docs/DECISIONS.md DEC-05).
describe('Admission — University Choice + Application (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobRunner: JobRunnerService;
  let directorToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let consultantBToken: string;
  let docSpecialistToken: string;
  let salesToken: string;
  let financeToken: string;
  let studentSelfToken: string;

  let studentAId: string;
  let caseAId: string;
  let applicationAId: string;

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
    ({ token: docSpecialistToken } = await issueTestSession(prisma, 'demo.docspecialist'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    studentAId = caseA.studentId;
    const applicationA = await prisma.application.findUniqueOrThrow({ where: { applicationCode: 'APP-2026-90001' } });
    applicationAId = applicationA.id;
  });

  // Cases created via `createCaseForConsultant` below each add a fresh CaseMember row for
  // demo.consultant.a that outlives the test run (this dev DB is never reset between
  // suites) — left uncleaned, repeated runs accumulate memberships fast enough to break
  // apps/api/test/rbac.e2e-spec.ts's `limit: 100` case-member-scoped list assertion (hit
  // twice during this phase's own development). Tracked here and removed in afterAll so
  // this file is net-zero on shared fixture state, without touching rbac.e2e-spec.ts.
  const consultantCaseIds: string[] = [];

  afterAll(async () => {
    if (consultantCaseIds.length > 0) {
      await prisma.caseMember.deleteMany({ where: { userId: consultantAId, caseId: { in: consultantCaseIds } } });
    }
    await app.close();
  });

  /// `createStudentWithCase` makes the converting SALES_MARKETING user the Case's OWNER
  /// member — CONSULTANT is not a member of a freshly-created case at all. See the
  /// identical helper/comment in assessment-roadmap.e2e-spec.ts.
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

  async function createProgram(): Promise<string> {
    const uniRes = await request(app.getHttpServer()).post('/universities').set('Authorization', `Bearer ${directorToken}`).send({ officialName: `Fresh Univ ${randomUUID()}`, countryCode: 'US' });
    const progRes = await request(app.getHttpServer())
      .post('/programs')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ universityId: uniRes.body.id, degreeLevel: 'Bachelor', major: `Fresh Major ${randomUUID()}` });
    return progRes.body.id;
  }

  describe('University Choice — RBAC / School Selection', () => {
    it('everyone with view access sees the fixture choice on studentA', async () => {
      for (const token of [directorToken, consultantAToken, studentSelfToken]) {
        const res = await request(app.getHttpServer()).get(`/students/${studentAId}/university-choices`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('a non-member consultant is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}/university-choices`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('CONSULTANT can propose a REACH/MATCH/SAFETY choice for a program', async () => {
      const programId = await createProgram();
      const { studentId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer())
        .post(`/students/${studentId}/university-choices`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ programId, tier: 'REACH', rationale: 'Ambitious but plausible.' });
      expect(res.status).toBe(201);
      expect(res.body.tier).toBe('REACH');
      expect(res.body.status).toBe('PROPOSED');
    });

    it('rejects a duplicate choice for the same (student, program)', async () => {
      const programId = await createProgram();
      const { studentId } = await createCaseForConsultant();
      const first = await request(app.getHttpServer()).post(`/students/${studentId}/university-choices`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, tier: 'MATCH' });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer()).post(`/students/${studentId}/university-choices`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, tier: 'SAFETY' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_UNIVERSITY_CHOICE');
    });

    it('STUDENT_PARENT can view but not create (403)', async () => {
      const programId = await createProgram();
      const res = await request(app.getHttpServer()).post(`/students/${studentAId}/university-choices`).set('Authorization', `Bearer ${studentSelfToken}`).send({ programId, tier: 'MATCH' });
      expect(res.status).toBe(403);
    });

    it('SALES_MARKETING has zero university_choices grant (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}/university-choices`).set('Authorization', `Bearer ${salesToken}`);
      expect(res.status).toBe(403);
    });

    it('a review action stamps reviewedById/reviewedAt without changing tier/status', async () => {
      const programId = await createProgram();
      const { studentId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/university-choices`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, tier: 'MATCH' });
      const res = await request(app.getHttpServer()).post(`/university-choices/${created.body.id}/review`).set('Authorization', `Bearer ${directorToken}`).send({ reviewNotes: 'Looks solid.' });
      expect(res.status).toBe(201);
      expect(res.body.reviewedAt).not.toBeNull();
      expect(res.body.tier).toBe('MATCH');
    });

    /// DEC-11 — list/detail embed a Program (+ nested University) summary so a choice row
    /// can show "which university/program" without a per-row N+1 fetch.
    it('list and detail embed the Program/University summary (DEC-11)', async () => {
      const programId = await createProgram();
      const { studentId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/university-choices`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, tier: 'MATCH' });
      expect(created.status).toBe(201);

      const listRes = await request(app.getHttpServer()).get(`/students/${studentId}/university-choices`).set('Authorization', `Bearer ${consultantAToken}`);
      const row = listRes.body.find((c: { id: string }) => c.id === created.body.id);
      expect(row.program).toMatchObject({ id: programId });
      expect(row.program.university).toEqual({ id: expect.any(String), officialName: expect.any(String), countryCode: expect.any(String) });

      const detailRes = await request(app.getHttpServer()).get(`/university-choices/${created.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(detailRes.body.program).toMatchObject({ id: programId });
      expect(detailRes.body.program.university.officialName).toEqual(expect.any(String));
    });
  });

  describe('Application — RBAC / cross-case', () => {
    it('GLOBAL and CASE_MEMBER roles can read the fixture application', async () => {
      for (const token of [directorToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get(`/applications/${applicationAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/applications/${applicationAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('ADMIN_FINANCE has zero applications grant (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/cases/${caseAId}/applications`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(403);
    });

    it('DOCUMENT_SPECIALIST has full view/create/edit (its document-processing domain)', async () => {
      const programId = await createProgram();
      const res = await request(app.getHttpServer()).post(`/cases/${caseAId}/applications`).set('Authorization', `Bearer ${docSpecialistToken}`).send({ programId });
      expect(res.status).toBe(201);
    });

    it('does not create a new Student/Case — Application only links existing ones', async () => {
      const res = await request(app.getHttpServer()).get(`/applications/${applicationAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.body.studentId).toBe(studentAId);
      expect(res.body.caseId).toBe(caseAId);
    });

    /// DEC-11 — list/detail embed a Program (+ nested University) summary so an application
    /// row can show "university, program" without a per-row N+1 fetch.
    it('list and detail embed the Program/University summary (DEC-11)', async () => {
      // limit:100 — this shared dev DB accumulates Applications on caseAId across repeated
      // e2e runs (other `it` blocks above create more via `createCaseForConsultant`-adjacent
      // fixtures), so the default page size can push the seeded fixture off page 1.
      const listRes = await request(app.getHttpServer()).get(`/cases/${caseAId}/applications`).query({ limit: 100 }).set('Authorization', `Bearer ${directorToken}`);
      expect(listRes.status).toBe(200);
      const row = listRes.body.data.find((a: { id: string }) => a.id === applicationAId);
      expect(row.program).toEqual(expect.objectContaining({ id: expect.any(String), degreeLevel: expect.any(String), major: expect.any(String) }));
      expect(row.program.university).toEqual({ id: expect.any(String), officialName: expect.any(String), countryCode: expect.any(String) });

      const detailRes = await request(app.getHttpServer()).get(`/applications/${applicationAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(detailRes.body.program.university.officialName).toEqual(expect.any(String));
    });
  });

  describe('Application — workflow FSM', () => {
    it('walks Planning -> Preparing -> Ready for Review -> Submitted, blocked by an incomplete mandatory checklist', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, intendedIntake: 'Fall 2026' });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('PLANNING');
      const id = created.body.id;

      await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      const readyRes = await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY_FOR_REVIEW' });
      expect(readyRes.status).toBe(200);

      // Add one mandatory, incomplete checklist item.
      await request(app.getHttpServer()).post(`/applications/${id}/checklist`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Transcript', required: true });

      const blockedSubmit = await request(app.getHttpServer()).post(`/applications/${id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(blockedSubmit.status).toBe(409);
      expect(blockedSubmit.body.error.code).toBe('CHECKLIST_INCOMPLETE');
    });

    it('rejects an illegal status jump (Planning -> Submitted directly)', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId });
      const res = await request(app.getHttpServer()).patch(`/applications/${created.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
      expect(res.status).toBe(400); // SUBMITTED excluded from the generic transition DTO's allowed values
    });

    it('submits once the mandatory checklist is DONE, recording the submission evidence', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId });
      const id = created.body.id;
      await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY_FOR_REVIEW' });

      const item = await request(app.getHttpServer()).post(`/applications/${id}/checklist`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Transcript', required: true });
      const doneRes = await request(app.getHttpServer()).patch(`/checklist-items/${item.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      expect(doneRes.status).toBe(200);
      expect(doneRes.body.completedAt).not.toBeNull();

      const submitRes = await request(app.getHttpServer())
        .post(`/applications/${id}/submit`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ submissionChannel: 'university_portal', submissionReference: `REF-${randomUUID()}` });
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.status).toBe('SUBMITTED');
      expect(submitRes.body.submittedAt).not.toBeNull();
    });

    it('a WAIVED required item also satisfies the submission gate', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId });
      const id = created.body.id;
      await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'PREPARING' });
      await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'READY_FOR_REVIEW' });
      const item = await request(app.getHttpServer()).post(`/applications/${id}/checklist`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'Optional recommender letter', required: true });
      await request(app.getHttpServer()).patch(`/checklist-items/${item.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'WAIVED' });
      const submitRes = await request(app.getHttpServer()).post(`/applications/${id}/submit`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(submitRes.status).toBe(201);
    });

    it('an Application cannot reach OFFER via the generic status endpoint (only via creating an Offer)', async () => {
      const res = await request(app.getHttpServer()).patch(`/applications/${applicationAId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'OFFER' });
      expect(res.status).toBe(400);
    });

    it('WITHDRAWN freezes further generic edits', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const created = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId });
      const id = created.body.id;
      await request(app.getHttpServer()).patch(`/applications/${id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'WITHDRAWN' });
      const res = await request(app.getHttpServer()).patch(`/applications/${id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ intendedIntake: 'Spring 2027' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('APPLICATION_WITHDRAWN');
    });
  });

  describe('Duplicate application prevention (docs/DECISIONS.md DEC-05)', () => {
    it('rejects a second active application for the same (student, program, intake)', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const first = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, intendedIntake: 'Fall 2026' });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, intendedIntake: 'Fall 2026' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('ACTIVE_APPLICATION_EXISTS');
    });

    it('allows a genuine reapplication after WITHDRAWN — a NEW row, not overwriting history', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const first = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, intendedIntake: 'Fall 2026' });
      await request(app.getHttpServer()).patch(`/applications/${first.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'WITHDRAWN' });

      const second = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, intendedIntake: 'Fall 2026' });
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);

      // The first (withdrawn) row's history is untouched.
      const firstStill = await request(app.getHttpServer()).get(`/applications/${first.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(firstStill.body.status).toBe('WITHDRAWN');
    });

    it('a different intended intake for the same (student, program) is not a duplicate', async () => {
      const programId = await createProgram();
      const { caseId } = await createCaseForConsultant();
      const first = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, intendedIntake: 'Fall 2026' });
      expect(first.status).toBe(201);
      const different = await request(app.getHttpServer()).post(`/cases/${caseId}/applications`).set('Authorization', `Bearer ${consultantAToken}`).send({ programId, intendedIntake: 'Spring 2027' });
      expect(different.status).toBe(201);
    });
  });

  describe('Checklist', () => {
    it('lists checklist items scoped to the parent application', async () => {
      const res = await request(app.getHttpServer()).get(`/applications/${applicationAId}/checklist`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('links a Document to a checklist item and grants case access', async () => {
      const documentRes = await uploadTestDocument(app, consultantAToken, {
        ownerEntity: 'ApplicationChecklist',
        ownerId: applicationAId,
        documentType: 'transcript',
        title: 'Checklist evidence',
      });
      const item = await request(app.getHttpServer())
        .post(`/applications/${applicationAId}/checklist`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ title: 'Transcript', documentId: documentRes.body.id });
      expect(item.status).toBe(201);

      // Phase 12 — download is blocked until the async malware scan completes (scanStatus
      // PENDING -> CLEAN); process the queued DOCUMENT_SCAN job synchronously instead of
      // waiting on the poll interval.
      await drainJobs(jobRunner);
      const downloadRes = await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}/download`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.downloadUrl).toMatch(/^\/documents\/download\//);
    });
  });

  describe('audit', () => {
    it('creates a VIEW audit record for reading an application', async () => {
      await request(app.getHttpServer()).get(`/applications/${applicationAId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'VIEW', objectType: 'Applications', objectId: applicationAId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
