import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { issueTestSession } from './helpers/issue-session';

/// 07-profile/01_ASSESSMENT_ROADMAP.md: Assessment versioning (never overwrite an
/// approved version), Roadmap FSM (Active requires Approved, which requires an approved
/// assessment baseline), Milestone dependency + completion gate, and Task Engine reuse
/// (Phase 06 — never a parallel milestone-task implementation).
describe('Assessment + Roadmap (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let managerToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let consultantBToken: string;
  let docSpecialistToken: string;
  let salesToken: string;

  let caseAId: string;
  let assessmentAId: string;

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
    ({ token: consultantAToken, userId: consultantAId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: docSpecialistToken } = await issueTestSession(prisma, 'demo.docspecialist'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    const assessmentA = await prisma.assessment.findFirstOrThrow({ where: { caseId: caseAId, version: 1 } });
    assessmentAId = assessmentA.id;
  });

  /// `createStudentWithCase` walks the real Lead-conversion flow, which makes the
  /// converting SALES_MARKETING user the Case's OWNER member — CONSULTANT (the role that
  /// actually does Assessment/Roadmap work) is not a member of a freshly-created case at
  /// all. Add consultant.a as the case's OWNER member (mirrors the seed fixture caseA's
  /// own shape) so the workflow tests below exercise a realistic, case-scoped actor.
  ///
  /// Each such case's fresh CaseMember row otherwise outlives the run (this dev DB is
  /// never reset between suites) — tracked here and removed in afterAll, so repeated runs
  /// don't accumulate enough membership rows to break rbac.e2e-spec.ts's `limit: 100`
  /// case-member-scoped list assertion (this file's own accumulation was one of two
  /// contributors when that broke twice during Phase 08's development).
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

  describe('Assessment — RBAC / cross-case', () => {
    it('GLOBAL and CASE_MEMBER roles can read the fixture assessment', async () => {
      for (const token of [directorToken, managerToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get(`/assessments/${assessmentAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('a non-member (consultant.b) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/assessments/${assessmentAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('DOCUMENT_SPECIALIST can view but cannot edit (403) — view-only per RBAC design', async () => {
      const viewRes = await request(app.getHttpServer()).get(`/assessments/${assessmentAId}`).set('Authorization', `Bearer ${docSpecialistToken}`);
      expect(viewRes.status).toBe(200);
      const editRes = await request(app.getHttpServer())
        .post(`/assessments/${assessmentAId}/criteria`)
        .set('Authorization', `Bearer ${docSpecialistToken}`)
        .send({ area: 'Test', currentScore: 6 });
      expect(editRes.status).toBe(403);
    });
  });

  describe('Assessment — versioning workflow', () => {
    async function freshCase() {
      return createCaseForConsultant();
    }

    it('walks DRAFT -> REVIEW -> APPROVED, and criteria compute gap = target - current', async () => {
      const { caseId } = await freshCase();
      const createRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(createRes.status).toBe(201);
      expect(createRes.body.version).toBe(1);
      const id = createRes.body.id;

      const criterionRes = await request(app.getHttpServer())
        .post(`/assessments/${id}/criteria`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ area: 'Academic', currentScore: 7, targetScore: 9 });
      expect(criterionRes.status).toBe(201);
      expect(Number(criterionRes.body.gap)).toBe(2);

      const submitRes = await request(app.getHttpServer()).post(`/assessments/${id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.status).toBe('REVIEW');

      const approveRes = await request(app.getHttpServer()).post(`/assessments/${id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe('APPROVED');
    });

    it('CONSULTANT cannot approve its own assessment (403) — separation of duties', async () => {
      const { caseId } = await freshCase();
      const createRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      await request(app.getHttpServer()).post(`/assessments/${createRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      const res = await request(app.getHttpServer()).post(`/assessments/${createRes.body.id}/approve`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(res.status).toBe(403);
    });

    it('criteria cannot be edited once APPROVED (409) — never overwrite an approved assessment', async () => {
      const { caseId } = await freshCase();
      const createRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      const id = createRes.body.id;
      await request(app.getHttpServer()).post(`/assessments/${id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      await request(app.getHttpServer()).post(`/assessments/${id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});

      const res = await request(app.getHttpServer()).post(`/assessments/${id}/criteria`).set('Authorization', `Bearer ${consultantAToken}`).send({ area: 'Academic', currentScore: 8 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_ASSESSMENT_STATE');
    });

    it('rejects creating a second open (DRAFT/REVIEW) version while one is already open', async () => {
      const { caseId } = await freshCase();
      await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      const res = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OPEN_ASSESSMENT_EXISTS');
    });

    it('requires a changeReason for a new version after an approved one, and supersedes the previous version', async () => {
      const { caseId } = await freshCase();
      const createRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      const v1Id = createRes.body.id;
      await request(app.getHttpServer()).post(`/assessments/${v1Id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      await request(app.getHttpServer()).post(`/assessments/${v1Id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});

      const missingReason = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      expect(missingReason.status).toBe(409);
      expect(missingReason.body.error.code).toBe('CHANGE_REASON_REQUIRED');

      const v2Res = await request(app.getHttpServer())
        .post(`/cases/${caseId}/assessments`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ changeReason: 'New IELTS score reported.' });
      expect(v2Res.status).toBe(201);
      expect(v2Res.body.version).toBe(2);

      const v1After = await prisma.assessment.findUniqueOrThrow({ where: { id: v1Id } });
      expect(v1After.status).toBe('SUPERSEDED');
    });
  });

  describe('Roadmap — Active requires Approved, which requires an approved baseline', () => {
    it('rejects approving a roadmap whose assessment baseline is not yet APPROVED', async () => {
      const { caseId } = await createCaseForConsultant();
      const assessmentRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      const roadmapRes = await request(app.getHttpServer())
        .post(`/cases/${caseId}/roadmaps`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ assessmentId: assessmentRes.body.id, horizonYears: 2 });
      await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);

      const res = await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ASSESSMENT_BASELINE_NOT_APPROVED');
    });

    it('approves once the baseline is approved, then rejects ACTIVE before approval and allows it after', async () => {
      const { caseId } = await createCaseForConsultant();
      const assessmentRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      await request(app.getHttpServer()).post(`/assessments/${assessmentRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      await request(app.getHttpServer()).post(`/assessments/${assessmentRes.body.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});

      const roadmapRes = await request(app.getHttpServer())
        .post(`/cases/${caseId}/roadmaps`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ assessmentId: assessmentRes.body.id, horizonYears: 2 });

      const activateTooEarly = await request(app.getHttpServer())
        .patch(`/roadmaps/${roadmapRes.body.id}/status`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: 'ACTIVE' });
      expect(activateTooEarly.status).toBe(409);

      await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      const approveRes = await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe('APPROVED');

      const activateRes = await request(app.getHttpServer())
        .patch(`/roadmaps/${roadmapRes.body.id}/status`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: 'ACTIVE' });
      expect(activateRes.status).toBe(200);
      expect(activateRes.body.status).toBe('ACTIVE');
    });
  });

  describe('Milestone — dependency + completion gate + Task Engine reuse', () => {
    async function approvedRoadmap() {
      const { caseId } = await createCaseForConsultant();
      const assessmentRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
      await request(app.getHttpServer()).post(`/assessments/${assessmentRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      await request(app.getHttpServer()).post(`/assessments/${assessmentRes.body.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
      const roadmapRes = await request(app.getHttpServer())
        .post(`/cases/${caseId}/roadmaps`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ assessmentId: assessmentRes.body.id });
      await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
      await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
      return { roadmapId: roadmapRes.body.id, caseId };
    }

    it('creates a milestone and rejects self/circular dependency', async () => {
      const { roadmapId } = await approvedRoadmap();
      const mA = await request(app.getHttpServer()).post(`/roadmaps/${roadmapId}/milestones`).set('Authorization', `Bearer ${consultantAToken}`).send({ objective: 'Improve IELTS to 7.5' });
      const mB = await request(app.getHttpServer()).post(`/roadmaps/${roadmapId}/milestones`).set('Authorization', `Bearer ${consultantAToken}`).send({ objective: 'Submit application' });
      expect(mA.status).toBe(201);

      const selfDep = await request(app.getHttpServer())
        .post(`/milestones/${mA.body.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnMilestoneId: mA.body.id });
      expect(selfDep.status).toBe(409);
      expect(selfDep.body.error.code).toBe('SELF_DEPENDENCY');

      const forward = await request(app.getHttpServer())
        .post(`/milestones/${mB.body.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnMilestoneId: mA.body.id });
      expect(forward.status).toBe(201);

      const circular = await request(app.getHttpServer())
        .post(`/milestones/${mA.body.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnMilestoneId: mB.body.id });
      expect(circular.status).toBe(409);
      expect(circular.body.error.code).toBe('CIRCULAR_DEPENDENCY');
    });

    it('blocks Milestone completion until its prerequisite milestone is Done', async () => {
      const { roadmapId } = await approvedRoadmap();
      const mA = await request(app.getHttpServer()).post(`/roadmaps/${roadmapId}/milestones`).set('Authorization', `Bearer ${consultantAToken}`).send({ objective: 'Milestone A' });
      const mB = await request(app.getHttpServer()).post(`/roadmaps/${roadmapId}/milestones`).set('Authorization', `Bearer ${consultantAToken}`).send({ objective: 'Milestone B' });
      await request(app.getHttpServer()).post(`/milestones/${mB.body.id}/dependencies`).set('Authorization', `Bearer ${consultantAToken}`).send({ dependsOnMilestoneId: mA.body.id });

      await request(app.getHttpServer()).patch(`/milestones/${mB.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      const blocked = await request(app.getHttpServer()).patch(`/milestones/${mB.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('PREREQUISITE_NOT_DONE');

      await request(app.getHttpServer()).patch(`/milestones/${mA.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer()).patch(`/milestones/${mA.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      const nowDone = await request(app.getHttpServer()).patch(`/milestones/${mB.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      expect(nowDone.status).toBe(200);
    });

    it('creates a Task under a milestone via the existing Task Engine, and blocks completion until that task is Done', async () => {
      const { roadmapId, caseId } = await approvedRoadmap();
      const milestone = await request(app.getHttpServer()).post(`/roadmaps/${roadmapId}/milestones`).set('Authorization', `Bearer ${consultantAToken}`).send({ objective: 'Finish essay draft' });

      const taskRes = await request(app.getHttpServer())
        .post(`/milestones/${milestone.body.id}/tasks`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ module: 'counseling', taskType: 'essay_draft', title: 'Draft essay v1', deadline: '2026-12-01' });
      expect(taskRes.status).toBe(201);
      expect(taskRes.body.taskCode).toMatch(/^TASK-\d{4}-\d{5}$/);

      // The task is a real, ordinary Task Engine row — visible via /tasks, not a parallel
      // milestone-task implementation.
      const viaTasksApi = await request(app.getHttpServer()).get(`/tasks/${taskRes.body.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(viaTasksApi.status).toBe(200);

      await request(app.getHttpServer()).patch(`/milestones/${milestone.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      const blocked = await request(app.getHttpServer()).patch(`/milestones/${milestone.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('PREREQUISITE_NOT_DONE');
      expect(blocked.body.error.unmetTaskIds).toContain(taskRes.body.id);

      await request(app.getHttpServer()).patch(`/tasks/${taskRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer()).patch(`/tasks/${taskRes.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      const nowDone = await request(app.getHttpServer()).patch(`/milestones/${milestone.body.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      expect(nowDone.status).toBe(200);

      const caseTaskList = await request(app.getHttpServer()).get(`/cases/${caseId}/tasks`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(caseTaskList.body.data.map((t: { id: string }) => t.id)).toContain(taskRes.body.id);
    });

    it('rejects an invalid milestone owner (not a case member, not GLOBAL)', async () => {
      const { roadmapId } = await approvedRoadmap();
      const { userId: unrelatedUserId } = await issueTestSession(prisma, 'demo.sales.b');
      const res = await request(app.getHttpServer())
        .post(`/roadmaps/${roadmapId}/milestones`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ objective: 'Test', ownerId: unrelatedUserId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_MILESTONE_OWNER');
    });
  });

  describe('Roadmap approval — idempotent task auto-generation (ROADMAP_APPROVED)', () => {
    it('generates a task from an active ROADMAP_APPROVED template exactly once', async () => {
      const template = await request(app.getHttpServer())
        .post('/task-templates')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ code: `TT-ROADMAP-${randomUUID()}`, name: 'Roadmap kickoff', module: 'counseling', taskType: 'kickoff', title: 'Kick off roadmap execution', deadlineOffsetDays: 7, triggerEvent: 'ROADMAP_APPROVED' });
      expect(template.status).toBe(201);

      try {
        const { caseId } = await createCaseForConsultant();
        const assessmentRes = await request(app.getHttpServer()).post(`/cases/${caseId}/assessments`).set('Authorization', `Bearer ${consultantAToken}`).send({});
        await request(app.getHttpServer()).post(`/assessments/${assessmentRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
        await request(app.getHttpServer()).post(`/assessments/${assessmentRes.body.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
        const roadmapRes = await request(app.getHttpServer())
          .post(`/cases/${caseId}/roadmaps`)
          .set('Authorization', `Bearer ${consultantAToken}`)
          .send({ assessmentId: assessmentRes.body.id });
        await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/submit`).set('Authorization', `Bearer ${consultantAToken}`);
        await request(app.getHttpServer()).post(`/roadmaps/${roadmapRes.body.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});

        const count = await prisma.task.count({ where: { templateId: template.body.id, sourceEntityId: roadmapRes.body.id } });
        expect(count).toBe(1);
      } finally {
        await prisma.taskTemplate.update({ where: { id: template.body.id }, data: { active: false } });
      }
    });
  });

  describe('audit', () => {
    it('creates a VIEW audit record for reading an assessment', async () => {
      await request(app.getHttpServer()).get(`/assessments/${assessmentAId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'VIEW', objectType: 'Assessments', objectId: assessmentAId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
