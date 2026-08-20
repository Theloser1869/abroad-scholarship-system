import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { issueTestSession } from './helpers/issue-session';

/// 07-profile/03_WRITING.md: Draft→Review→Revision→Final→Submitted workflow (server-
/// enforced), WritingArtifact/WritingVersion kept separate (never overwrite an existing
/// version — always a new row), version-attached Comment-based review feedback (reusing
/// the existing entity, not a duplicate ReviewComment), and LOR tracking with
/// field-level-restricted internal notes.
describe('Writing + LOR (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let consultantAToken: string;
  let consultantBToken: string;
  let studentSelfToken: string;

  let caseAId: string;
  let writingArtifactAId: string;
  let lorAId: string;

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
    ({ token: consultantAToken } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    const writingA = await prisma.writingArtifact.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-00000000f001' } });
    writingArtifactAId = writingA.id;
    const lorA = await prisma.letterOfRecommendation.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-00000000b001' } });
    lorAId = lorA.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('RBAC / cross-case', () => {
    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/writing-artifacts/${writingArtifactAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('STUDENT_PARENT can view its own writing artifact', async () => {
      const res = await request(app.getHttpServer()).get(`/writing-artifacts/${writingArtifactAId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Writing workflow — server-enforced FSM', () => {
    async function createArtifact() {
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/writing-artifacts`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ type: 'Essay', title: 'Common App Essay Draft', content: 'Once upon a time...' });
      expect(res.status).toBe(201);
      return res.body;
    }

    it('creating an artifact also creates version 1', async () => {
      const artifact = await createArtifact();
      const detail = await request(app.getHttpServer()).get(`/writing-artifacts/${artifact.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.versions).toHaveLength(1);
      expect(detail.body.versions[0].versionNumber).toBe(1);
    });

    it('walks DRAFT -> REVIEW -> FINAL -> SUBMITTED, and rejects an illegal jump', async () => {
      const artifact = await createArtifact();
      const illegal = await request(app.getHttpServer()).patch(`/writing-artifacts/${artifact.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'FINAL' });
      expect(illegal.status).toBe(409);
      expect(illegal.body.error.code).toBe('INVALID_WRITING_STATUS_TRANSITION');

      await request(app.getHttpServer()).patch(`/writing-artifacts/${artifact.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'REVIEW' });
      const toFinal = await request(app.getHttpServer()).patch(`/writing-artifacts/${artifact.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'FINAL' });
      expect(toFinal.status).toBe(200);
      const toSubmitted = await request(app.getHttpServer()).patch(`/writing-artifacts/${artifact.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });
      expect(toSubmitted.status).toBe(200);
      expect(toSubmitted.body.status).toBe('SUBMITTED');
    });

    it('rejects any further version once SUBMITTED', async () => {
      const artifact = await createArtifact();
      await request(app.getHttpServer()).patch(`/writing-artifacts/${artifact.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'REVIEW' });
      await request(app.getHttpServer()).patch(`/writing-artifacts/${artifact.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'FINAL' });
      await request(app.getHttpServer()).patch(`/writing-artifacts/${artifact.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'SUBMITTED' });

      const res = await request(app.getHttpServer())
        .post(`/writing-artifacts/${artifact.id}/versions`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ content: 'One more edit please' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('WRITING_ARTIFACT_SUBMITTED');
    });
  });

  describe('Writing versioning — never overwrite an existing version', () => {
    it('a new version is a new row; version 1 keeps its original content untouched', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/writing-artifacts`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ type: 'SOP', title: 'Statement of Purpose', content: 'Draft v1 content' });
      const artifactId = createRes.body.id;

      const v2Res = await request(app.getHttpServer())
        .post(`/writing-artifacts/${artifactId}/versions`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ content: 'Draft v2 content', changeSummary: 'Rewrote the intro paragraph' });
      expect(v2Res.status).toBe(201);
      expect(v2Res.body.versionNumber).toBe(2);

      const detail = await request(app.getHttpServer()).get(`/writing-artifacts/${artifactId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(detail.body.versions).toHaveLength(2);
      const v1 = detail.body.versions.find((v: { versionNumber: number }) => v.versionNumber === 1);
      expect(v1.content).toBe('Draft v1 content');
    });

    it('creating a new version while FINAL reverts the artifact to REVISION', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/writing-artifacts`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ type: 'SOP', title: 'SOP for revision test', content: 'v1' });
      const artifactId = createRes.body.id;
      await request(app.getHttpServer()).patch(`/writing-artifacts/${artifactId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'REVIEW' });
      await request(app.getHttpServer()).patch(`/writing-artifacts/${artifactId}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'FINAL' });

      await request(app.getHttpServer()).post(`/writing-artifacts/${artifactId}/versions`).set('Authorization', `Bearer ${consultantAToken}`).send({ content: 'v2 after final' });
      const detail = await request(app.getHttpServer()).get(`/writing-artifacts/${artifactId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(detail.body.status).toBe('REVISION');
    });
  });

  describe('Writing review — verdict + Comment-based feedback, visibility scoped', () => {
    it('reviews a version with a verdict, and attaches internal + shared comments respecting visibility', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/writing-artifacts`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ type: 'Essay', title: 'Review test essay', content: 'draft' });
      const versionId = createRes.body.versions?.[0]?.id ?? (await prisma.writingVersion.findFirstOrThrow({ where: { artifactId: createRes.body.id } })).id;

      const reviewRes = await request(app.getHttpServer())
        .post(`/writing-versions/${versionId}/review`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ reviewStatus: 'CHANGES_REQUESTED' });
      expect(reviewRes.status).toBe(201);
      expect(reviewRes.body.reviewStatus).toBe('CHANGES_REQUESTED');
      expect(reviewRes.body.reviewerId).toBeTruthy();

      const internalComment = await request(app.getHttpServer())
        .post(`/writing-versions/${versionId}/comments`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ body: 'Internal: tone needs work.', visibility: 'internal' });
      expect(internalComment.status).toBe(201);
      const sharedComment = await request(app.getHttpServer())
        .post(`/writing-versions/${versionId}/comments`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ body: 'Please revise the second paragraph.', visibility: 'shared' });
      expect(sharedComment.status).toBe(201);

      const staffView = await request(app.getHttpServer()).get(`/writing-versions/${versionId}/comments`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(staffView.body.length).toBe(2);

      const studentView = await request(app.getHttpServer()).get(`/writing-versions/${versionId}/comments`).set('Authorization', `Bearer ${studentSelfToken}`);
      const studentBodies = studentView.body.map((c: { body: string }) => c.body);
      expect(studentBodies).toContain('Please revise the second paragraph.');
      expect(studentBodies).not.toContain('Internal: tone needs work.');
    });
  });

  describe('LOR — field-level security', () => {
    it('staff sees the recommender contact + internal notes; STUDENT_PARENT does not', async () => {
      const staffRes = await request(app.getHttpServer()).get(`/letters-of-recommendation/${lorAId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(staffRes.status).toBe(200);
      expect(staffRes.body.internalNotes).not.toBeNull();

      const studentRes = await request(app.getHttpServer()).get(`/letters-of-recommendation/${lorAId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(studentRes.status).toBe(200);
      expect(studentRes.body.internalNotes).toBeNull();
      expect(studentRes.body.contactEmail).toBeNull();
      // Non-sensitive fields still visible.
      expect(studentRes.body.recommenderName).toBe('RBAC Fixture Teacher');
    });

    it('creates an LOR request and updates its status', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/letters-of-recommendation`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ recommenderName: 'Ms. Physics Teacher', relationship: 'AP Physics teacher', requestDate: '2026-09-01', deadline: '2026-10-01' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.requestStatus).toBe('REQUESTED');

      const updateRes = await request(app.getHttpServer())
        .patch(`/letters-of-recommendation/${createRes.body.id}`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ requestStatus: 'RECEIVED', submissionStatus: 'SUBMITTED' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.requestStatus).toBe('RECEIVED');
      expect(updateRes.body.submissionStatus).toBe('SUBMITTED');
    });
  });

  describe('audit', () => {
    it('creates a VIEW audit record for reading a writing artifact', async () => {
      await request(app.getHttpServer()).get(`/writing-artifacts/${writingArtifactAId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'VIEW', objectType: 'WritingArtifacts', objectId: writingArtifactAId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
