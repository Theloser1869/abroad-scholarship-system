import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JobRunnerService } from '../src/common/jobs/job-runner.service';
import { drainJobs } from './helpers/drain-jobs';
import { issueTestSession } from './helpers/issue-session';
import { uploadTestDocument } from './helpers/upload-document';

/// 07-profile/02_PROFILE_EVIDENCE.md: AcademicRecord (never overwrite historical
/// periods), TestRecord (never overwrite a prior attempt, no duplicate attempt number),
/// Competition/ResearchProject/Activity, all evidence linking to the real Document module
/// (Phase 07's own minimal slice) with case-scoped, download-gated authorization.
describe('Profile Evidence (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobRunner: JobRunnerService;
  let directorToken: string;
  let consultantAToken: string;
  let consultantBToken: string;
  let financeToken: string;
  let studentSelfToken: string;

  let caseAId: string;
  let academicRecordAId: string;
  let activityAId: string;

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
    ({ token: consultantAToken } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    const academicA = await prisma.academicRecord.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-00000000a001' } });
    academicRecordAId = academicA.id;
    const activityA = await prisma.activity.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-00000000e001' } });
    activityAId = activityA.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('RBAC / cross-case', () => {
    it('GLOBAL and CASE_MEMBER roles can read the fixture academic record', async () => {
      for (const token of [directorToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get(`/academic-records/${academicRecordAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/academic-records/${academicRecordAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('NONE scope (ADMIN_FINANCE has zero profile_evidence grant) is denied at the permission layer (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/cases/${caseAId}/academic-records`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(403);
    });

    it('STUDENT_PARENT (view-only, own case) can view but not create', async () => {
      const viewRes = await request(app.getHttpServer()).get(`/academic-records/${academicRecordAId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(viewRes.status).toBe(200);
      const createRes = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/academic-records`)
        .set('Authorization', `Bearer ${studentSelfToken}`)
        .send({ school: 'Self-reported School', period: 'Grade 12' });
      expect(createRes.status).toBe(403);
    });
  });

  describe('Academic — history preserved across periods, corrections stay in-period', () => {
    it('a new period is a new row; an old period row is never removed', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/academic-records`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ school: 'RBAC Fixture High School', period: 'Grade 12, 2026-2027', gpa: 8.9, gradingScale: '10' });
      expect(createRes.status).toBe(201);

      const listRes = await request(app.getHttpServer()).get(`/cases/${caseAId}/academic-records`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(listRes.status).toBe(200);
      const periods = listRes.body.map((r: { period: string }) => r.period);
      expect(periods).toContain('Grade 11, 2025-2026'); // the original fixture period, still present
      expect(periods).toContain('Grade 12, 2026-2027');
    });

    it('correcting the SAME period updates that row in place, not a new one', async () => {
      const before = await prisma.academicRecord.count({ where: { caseId: caseAId } });
      const res = await request(app.getHttpServer())
        .patch(`/academic-records/${academicRecordAId}`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ gpa: 8.7 });
      expect(res.status).toBe(200);
      expect(Number(res.body.gpa)).toBe(8.7);
      const after = await prisma.academicRecord.count({ where: { caseId: caseAId } });
      expect(after).toBe(before);
    });

    it('verifies a record, stamping verifiedById/verifiedAt', async () => {
      const res = await request(app.getHttpServer()).post(`/academic-records/${academicRecordAId}/verify`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(201);
      expect(res.body.verifiedAt).not.toBeNull();
    });
  });

  describe('Test records — multiple attempts, never overwritten', () => {
    it('a second attempt is a new row; the first attempt is untouched', async () => {
      // Unique testType per run — caseAId is the shared seed fixture, persistent across
      // repeated test runs, and `(caseId, testType, attemptNumber)` is unique.
      const testType = `SAT-${randomUUID()}`;
      const first = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/test-records`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ testType, attemptNumber: 1, score: 1350, target: 1500 });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/test-records`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ testType, attemptNumber: 2, score: 1420, target: 1500 });
      expect(second.status).toBe(201);

      const firstStillThere = await request(app.getHttpServer()).get(`/test-records/${first.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(firstStillThere.status).toBe(200);
      expect(Number(firstStillThere.body.score)).toBe(1350);
    });

    it('rejects a duplicate (testType, attemptNumber) pair for the same case', async () => {
      const testType = `TOEFL-${randomUUID()}`;
      await request(app.getHttpServer()).post(`/cases/${caseAId}/test-records`).set('Authorization', `Bearer ${consultantAToken}`).send({ testType, attemptNumber: 1, score: 90 });
      const dup = await request(app.getHttpServer()).post(`/cases/${caseAId}/test-records`).set('Authorization', `Bearer ${consultantAToken}`).send({ testType, attemptNumber: 1, score: 95 });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_TEST_ATTEMPT');
    });

    it('is not hard-coded to IELTS/SAT — any test type string is accepted', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/test-records`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ testType: `AP Calc-${randomUUID()}`, attemptNumber: 1, score: 5 });
      expect(res.status).toBe(201);
    });
  });

  describe('Competition — each participation is its own record', () => {
    it('creates two independent competition entries for the same case', async () => {
      const a = await request(app.getHttpServer()).post(`/cases/${caseAId}/competitions`).set('Authorization', `Bearer ${consultantAToken}`).send({ eventName: 'Math Olympiad', year: 2025 });
      const b = await request(app.getHttpServer()).post(`/cases/${caseAId}/competitions`).set('Authorization', `Bearer ${consultantAToken}`).send({ eventName: 'Science Fair', year: 2026 });
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.id).not.toBe(b.body.id);
    });
  });

  describe('Research and Activity', () => {
    it('creates a research project', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/research-projects`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ title: 'Climate modeling project', mentor: 'Dr. Nguyen', role: 'Lead researcher' });
      expect(res.status).toBe(201);
    });

    it('verifies an activity, stamping verifiedById/verifiedAt', async () => {
      const res = await request(app.getHttpServer()).post(`/activities/${activityAId}/verify`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(201);
      expect(res.body.verifiedAt).not.toBeNull();
    });

    it('accepts a non-fixed activity category', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/activities`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ organization: 'Robotics Club', category: 'STEM', hours: 60 });
      expect(res.status).toBe(201);
    });
  });

  describe('Evidence -> Document linkage — case-scoped, download-gated, never a public URL', () => {
    it('linking evidence grants the case members and the student access to the Document', async () => {
      const documentRes = await uploadTestDocument(app, consultantAToken, {
        ownerEntity: 'AcademicRecord',
        ownerId: academicRecordAId,
        documentType: 'transcript',
        title: 'Transcript scan',
      });
      expect(documentRes.status).toBe(201);
      expect(documentRes.body).not.toHaveProperty('fileUrl'); // never a public URL field

      const linkRes = await request(app.getHttpServer())
        .patch(`/academic-records/${academicRecordAId}`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ evidenceDocumentId: documentRes.body.id });
      expect(linkRes.status).toBe(200);

      // Phase 12 — download is blocked until the async malware scan completes.
      await drainJobs(jobRunner);
      // The student (a case member via portal link) can now download it.
      const downloadRes = await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}/download`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.downloadUrl).toMatch(/^\/documents\/download\//);

      // consultant.b (not a case member) is denied (404) even though the document exists.
      const deniedRes = await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}/download`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(deniedRes.status).toBe(404);
    });
  });

  describe('audit', () => {
    it('creates a VIEW audit record for reading an academic record', async () => {
      await request(app.getHttpServer()).get(`/academic-records/${academicRecordAId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'VIEW', objectType: 'AcademicRecords', objectId: academicRecordAId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });

    it('creates a DOWNLOAD audit record for downloading a document', async () => {
      const documentRes = await uploadTestDocument(app, consultantAToken, {
        ownerEntity: 'Activity',
        ownerId: activityAId,
        documentType: 'certificate',
        title: 'Audit test doc',
      });
      await request(app.getHttpServer()).get(`/documents/${documentRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'DOWNLOAD', objectType: 'Documents', objectId: documentRes.body.id }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
    });
  });
});
