import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { issueTestSession } from './helpers/issue-session';

/// 06-operations/01_TASK.md: status FSM enforced server-side, dependency rules
/// (self/circular/prerequisite-on-completion), owner-or-case-owner-or-GLOBAL
/// manageability, overdue (computed, consistent), auto-generation from Case/Contract
/// workflow events (idempotent), and RBAC/scope (Task reuses Student/Case's ROLE_SCOPE —
/// docs/ASSUMPTIONS.md ASM-16).
describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let managerToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let consultantBToken: string;
  let docSpecialistToken: string;
  let docSpecialistId: string;
  let financeToken: string;
  let salesToken: string;
  let studentSelfToken: string;

  let caseAId: string;
  let taskAId: string; // owned by consultant.a (also caseA's OWNER member)
  let taskBId: string; // owned by docspecialist (a mere COLLABORATOR), overdue fixture

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
    ({ token: docSpecialistToken, userId: docSpecialistId } = await issueTestSession(prisma, 'demo.docspecialist'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    const taskA = await prisma.task.findUniqueOrThrow({ where: { taskCode: 'TASK-2026-90001' } });
    taskAId = taskA.id;
    const taskB = await prisma.task.findUniqueOrThrow({ where: { taskCode: 'TASK-2026-90002' } });
    taskBId = taskB.id;
  });

  // Every task this file creates (mostly against the shared caseA fixture) is tracked here
  // and deleted in afterAll — without this, repeated e2e runs leak `module: 'counseling',
  // taskType: 'follow_up'` rows onto caseA forever, eventually pushing the shared taskA
  // fixture off the first page of caseA's (paginated, deadline-sorted) task list and
  // breaking the RBAC-scope test below. Only IDs this file itself created are deleted —
  // never a blanket "clear all of caseA's tasks", which would also remove the seeded
  // taskA/taskB fixtures other tests and other files depend on.
  const createdTaskIds: string[] = [];

  afterAll(async () => {
    if (createdTaskIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }
    await app.close();
  });

  async function createTask(caseId: string, token: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post(`/cases/${caseId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ module: 'counseling', taskType: 'follow_up', title: `E2E Task ${randomUUID()}`, deadline: '2026-12-01', ...overrides });
    expect(res.status).toBe(201);
    createdTaskIds.push(res.body.id);
    return res.body;
  }

  describe('create', () => {
    it('creates a task under a case, defaulting owner to the caller', async () => {
      const task = await createTask(caseAId, consultantAToken);
      expect(task.status).toBe('NOT_STARTED');
      expect(task.taskCode).toMatch(/^TASK-\d{4}-\d{5}$/);
      expect(task.ownerId).toBe(consultantAId);
    });

    it('rejects an invalid ownerId (404)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/tasks`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ module: 'counseling', taskType: 'follow_up', title: 'Bad owner', deadline: '2026-12-01', ownerId: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('OWNER_NOT_FOUND');
    });

    it('a non-member (consultant.b) cannot create a task under caseA (404)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cases/${caseAId}/tasks`)
        .set('Authorization', `Bearer ${consultantBToken}`)
        .send({ module: 'counseling', taskType: 'follow_up', title: 'Should fail', deadline: '2026-12-01' });
      expect(res.status).toBe(404);
    });
  });

  describe('RBAC — scope (Task reuses Student/Case ROLE_SCOPE, ASM-16)', () => {
    it('GLOBAL roles can read any task', async () => {
      for (const token of [directorToken, managerToken]) {
        const res = await request(app.getHttpServer()).get(`/tasks/${taskAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('CASE_MEMBER: consultant.a (a member of caseA) can read taskA and taskB', async () => {
      const resA = await request(app.getHttpServer()).get(`/tasks/${taskAId}`).set('Authorization', `Bearer ${consultantAToken}`);
      const resB = await request(app.getHttpServer()).get(`/tasks/${taskBId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
    });

    it('CASE_MEMBER: consultant.b (not a member of caseA) is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/tasks/${taskAId}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    it('NONE scope (ADMIN_FINANCE has zero tasks grant) is denied at the permission layer (403)', async () => {
      const res = await request(app.getHttpServer()).get('/tasks').set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('STUDENT_PARENT has zero tasks grant — Task Engine is internal staff tooling (403)', async () => {
      const res = await request(app.getHttpServer()).get('/tasks').set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(403);
    });

    it('"My Tasks" (mine=true) returns only the caller\'s own tasks', async () => {
      const res = await request(app.getHttpServer()).get('/tasks').query({ mine: 'true' }).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(taskAId);
      expect(ids).not.toContain(taskBId); // owned by docspecialist, not consultant.a
    });

    it('a case-scoped task list only returns tasks the caller is a member of that case for', async () => {
      const res = await request(app.getHttpServer()).get(`/cases/${caseAId}/tasks`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(taskAId);
      expect(ids).toContain(taskBId);
    });
  });

  describe('workflow — status FSM enforced server-side', () => {
    it('walks the legal chain NOT_STARTED -> IN_PROGRESS -> DONE', async () => {
      const task = await createTask(caseAId, consultantAToken);
      const toProgress = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(toProgress.status).toBe(200);
      expect(toProgress.body.status).toBe('IN_PROGRESS');

      const toDone = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'DONE', output: 'Completed the follow-up call.', qualityScore: 90 });
      expect(toDone.status).toBe(200);
      expect(toDone.body.status).toBe('DONE');
      expect(toDone.body.qualityScore).toBe(90);
    });

    it('rejects an illegal jump (NOT_STARTED -> DONE directly)', async () => {
      const task = await createTask(caseAId, consultantAToken);
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'DONE' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TASK_STATUS_TRANSITION');
    });

    it('rejects moving to BLOCKED without a blocker reason', async () => {
      const task = await createTask(caseAId, consultantAToken);
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'BLOCKED' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BLOCKER_REQUIRED');
    });

    it('accepts BLOCKED with a blocker reason, and can resume to IN_PROGRESS', async () => {
      const task = await createTask(caseAId, consultantAToken);
      const blocked = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'BLOCKED', blocker: 'Waiting on the student to submit documents.' });
      expect(blocked.status).toBe(200);
      expect(blocked.body.blocker).toBe('Waiting on the student to submit documents.');

      const resumed = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(resumed.status).toBe(200);
    });

    it('a terminal (DONE/CANCELLED) task can no longer be edited (409)', async () => {
      const task = await createTask(caseAId, consultantAToken);
      await request(app.getHttpServer()).patch(`/tasks/${task.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'CANCELLED' });
      const res = await request(app.getHttpServer()).patch(`/tasks/${task.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'New title' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TASK_TERMINAL_STATE');
    });
  });

  describe('dependencies', () => {
    it('rejects a self-dependency', async () => {
      const task = await createTask(caseAId, consultantAToken);
      const res = await request(app.getHttpServer())
        .post(`/tasks/${task.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnTaskId: task.id });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SELF_DEPENDENCY');
    });

    it('rejects a circular dependency', async () => {
      const taskX = await createTask(caseAId, consultantAToken);
      const taskY = await createTask(caseAId, consultantAToken);
      const forward = await request(app.getHttpServer())
        .post(`/tasks/${taskX.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnTaskId: taskY.id });
      expect(forward.status).toBe(201);

      const backward = await request(app.getHttpServer())
        .post(`/tasks/${taskY.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnTaskId: taskX.id });
      expect(backward.status).toBe(409);
      expect(backward.body.error.code).toBe('CIRCULAR_DEPENDENCY');
    });

    it('rejects a duplicate dependency edge', async () => {
      const taskX = await createTask(caseAId, consultantAToken);
      const taskY = await createTask(caseAId, consultantAToken);
      await request(app.getHttpServer()).post(`/tasks/${taskX.id}/dependencies`).set('Authorization', `Bearer ${consultantAToken}`).send({ dependsOnTaskId: taskY.id });
      const res = await request(app.getHttpServer())
        .post(`/tasks/${taskX.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnTaskId: taskY.id });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_DEPENDENCY');
    });

    it('blocks completion until the prerequisite is Done (PREREQUISITE_NOT_DONE), then allows it once satisfied', async () => {
      const prerequisite = await createTask(caseAId, consultantAToken);
      const dependent = await createTask(caseAId, consultantAToken);
      await request(app.getHttpServer())
        .post(`/tasks/${dependent.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnTaskId: prerequisite.id });

      await request(app.getHttpServer()).patch(`/tasks/${dependent.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      const blocked = await request(app.getHttpServer())
        .patch(`/tasks/${dependent.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'DONE' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('PREREQUISITE_NOT_DONE');

      await request(app.getHttpServer()).patch(`/tasks/${prerequisite.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer()).patch(`/tasks/${prerequisite.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });

      const nowDone = await request(app.getHttpServer())
        .patch(`/tasks/${dependent.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'DONE' });
      expect(nowDone.status).toBe(200);
      expect(nowDone.body.status).toBe('DONE');
    });

    it('a CANCELLED prerequisite also satisfies the completion gate (ASM-17)', async () => {
      const prerequisite = await createTask(caseAId, consultantAToken);
      const dependent = await createTask(caseAId, consultantAToken);
      await request(app.getHttpServer())
        .post(`/tasks/${dependent.id}/dependencies`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ dependsOnTaskId: prerequisite.id });

      await request(app.getHttpServer()).patch(`/tasks/${prerequisite.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'CANCELLED' });
      await request(app.getHttpServer()).patch(`/tasks/${dependent.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      const res = await request(app.getHttpServer()).patch(`/tasks/${dependent.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      expect(res.status).toBe(200);
    });

    it('removes a dependency, and removing a nonexistent one 404s', async () => {
      const taskX = await createTask(caseAId, consultantAToken);
      const taskY = await createTask(caseAId, consultantAToken);
      await request(app.getHttpServer()).post(`/tasks/${taskX.id}/dependencies`).set('Authorization', `Bearer ${consultantAToken}`).send({ dependsOnTaskId: taskY.id });

      const removed = await request(app.getHttpServer())
        .delete(`/tasks/${taskX.id}/dependencies/${taskY.id}`)
        .set('Authorization', `Bearer ${consultantAToken}`);
      expect(removed.status).toBe(200);

      const removedAgain = await request(app.getHttpServer())
        .delete(`/tasks/${taskX.id}/dependencies/${taskY.id}`)
        .set('Authorization', `Bearer ${consultantAToken}`);
      expect(removedAgain.status).toBe(404);
    });
  });

  describe('assignment / manageability (owner, or case OWNER, or GLOBAL)', () => {
    it('the case OWNER (consultant.a) can reassign a task owned by a mere collaborator (docspecialist)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${taskBId}/assign`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ ownerId: consultantAId });
      expect(res.status).toBe(200);
      expect(res.body.ownerId).toBe(consultantAId);
      // restore fixture state for later tests in this file
      await request(app.getHttpServer()).patch(`/tasks/${taskBId}/assign`).set('Authorization', `Bearer ${consultantAToken}`).send({ ownerId: docSpecialistId });
    });

    it('a mere collaborator (docspecialist) cannot reassign a task they do not own and are not the case owner of (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${taskAId}/assign`)
        .set('Authorization', `Bearer ${docSpecialistToken}`)
        .send({ ownerId: docSpecialistId });
      expect(res.status).toBe(403);
    });

    it('a collaborator CAN manage (reassign) their own task', async () => {
      const task = await createTask(caseAId, consultantAToken, { ownerId: docSpecialistId });
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/assign`)
        .set('Authorization', `Bearer ${docSpecialistToken}`)
        .send({ ownerId: consultantAId });
      expect(res.status).toBe(200);
    });
  });

  describe('overdue — computed, consistent (isOverdue)', () => {
    it('the seed fixture task with a past deadline and NOT_STARTED status reports isOverdue true', async () => {
      const res = await request(app.getHttpServer()).get(`/tasks/${taskBId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isOverdue).toBe(true);
    });

    it('filters the flat task list by overdue=true', async () => {
      const res = await request(app.getHttpServer()).get('/tasks').query({ overdue: 'true' }).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(taskBId);
    });

    it('a DONE task is never overdue even with a past deadline', async () => {
      const task = await createTask(caseAId, consultantAToken, { deadline: '2020-01-01' });
      await request(app.getHttpServer()).patch(`/tasks/${task.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer()).patch(`/tasks/${task.id}/status`).set('Authorization', `Bearer ${consultantAToken}`).send({ status: 'DONE' });
      const res = await request(app.getHttpServer()).get(`/tasks/${task.id}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.body.isOverdue).toBe(false);
    });
  });

  describe('cross-case isolation', () => {
    it('a task on one case is not visible/listed under a different case', async () => {
      const { caseId: otherCaseId } = await createStudentWithCase(app, salesToken);
      const taskOnA = await createTask(caseAId, consultantAToken);
      const listUnderOther = await request(app.getHttpServer())
        .get(`/cases/${otherCaseId}/tasks`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(listUnderOther.status).toBe(200);
      expect(listUnderOther.body.data.map((t: { id: string }) => t.id)).not.toContain(taskOnA.id);
    });
  });

  describe('task generation from workflow events — idempotent (06-operations rule)', () => {
    async function createTemplate(overrides: Record<string, unknown> = {}) {
      const res = await request(app.getHttpServer())
        .post('/task-templates')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          code: `TT-E2E-${randomUUID()}`,
          name: 'E2E generated template',
          module: 'counseling',
          taskType: 'auto_generated',
          title: 'Auto-generated by template',
          deadlineOffsetDays: 5,
          triggerEvent: 'CASE_CREATED',
          ...overrides,
        });
      expect(res.status).toBe(201);
      return res.body;
    }

    /// A `triggerEvent: CASE_CREATED` (or `CASE_STAGE_CHANGED`) template affects EVERY
    /// case created anywhere for as long as it stays `active` — including in OTHER e2e
    /// spec files running concurrently in separate Jest workers (case-management.e2e-spec.ts
    /// creates/closes cases constantly, and its closure check rejects a case with any
    /// open task — a stray active template here previously broke it). Deactivate
    /// immediately after each test's own assertions so the exposure window is just this
    /// one test, not the rest of the suite run.
    async function deactivate(templateId: string) {
      await prisma.taskTemplate.update({ where: { id: templateId }, data: { active: false } });
    }

    it('CASE_CREATED: creating a Case (via Lead conversion) generates a task from an active matching template', async () => {
      const template = await createTemplate();
      try {
        const { caseId } = await createStudentWithCase(app, salesToken);
        const generated = await prisma.task.findFirst({ where: { sourceEntityType: 'Case', sourceEntityId: caseId } });
        expect(generated).not.toBeNull();
        expect(generated?.status).toBe('NOT_STARTED');
      } finally {
        await deactivate(template.id);
      }
    });

    it('CASE_STAGE_CHANGED: fires only for the configured stage value, and only once per case (idempotent on repeat)', async () => {
      const template = await createTemplate({ triggerEvent: 'CASE_STAGE_CHANGED', triggerStageValue: 'e2e_stage_marker', code: `TT-STAGE-${randomUUID()}` });
      try {
        const { caseId } = await createStudentWithCase(app, salesToken);

        await request(app.getHttpServer()).patch(`/cases/${caseId}/stage`).set('Authorization', `Bearer ${directorToken}`).send({ stage: 'e2e_stage_marker' });
        const afterFirst = await prisma.task.count({ where: { templateId: template.id, sourceEntityId: caseId } });
        expect(afterFirst).toBe(1);

        // Repeat the exact same stage change — must not produce a second task from THIS
        // template (other active templates, e.g. from the CASE_CREATED test above, may
        // independently also generate their own task for this case — irrelevant here
        // since we count only tasks traceable to this specific template).
        await request(app.getHttpServer()).patch(`/cases/${caseId}/stage`).set('Authorization', `Bearer ${directorToken}`).send({ stage: 'e2e_stage_marker' });
        const afterSecond = await prisma.task.count({ where: { templateId: template.id, sourceEntityId: caseId } });
        expect(afterSecond).toBe(1);
      } finally {
        await deactivate(template.id);
      }
    });

    it('CONTRACT_ACTIVATED: activating a signed Contract generates a task owned by the linked Case\'s owner', async () => {
      const template = await createTemplate({ triggerEvent: 'CONTRACT_ACTIVATED', code: `TT-CONTRACT-${randomUUID()}` });
      const { studentId, caseId } = await createStudentWithCase(app, salesToken);
      const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });

      const createRes = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, value: 1000, currency: 'USD' });
      const contract = createRes.body;
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${directorToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${directorToken}`).send({});
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${directorToken}`);
      await request(app.getHttpServer())
        .post(`/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ signedDocumentId: `doc-task-gen-${randomUUID()}` });
      await request(app.getHttpServer()).patch(`/contracts/${contract.id}/status`).set('Authorization', `Bearer ${directorToken}`).send({ status: 'ACTIVE' });
      await deactivate(template.id);

      const generated = await prisma.task.findFirst({ where: { sourceEntityType: 'Contract', sourceEntityId: contract.id } });
      expect(generated).not.toBeNull();
      expect(generated?.ownerId).toBe(caseRecord.ownerId);
    });
  });

  describe('reminder sweep trigger (manual, no scheduler yet — docs/ASSUMPTIONS.md ASM-18)', () => {
    it('rejects a non-admin/director caller (403)', async () => {
      const res = await request(app.getHttpServer()).post('/tasks/reminders/run').set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
    });

    it('EXECUTIVE_DIRECTOR can trigger the sweep, and re-running it does not double-send (dedup)', async () => {
      const first = await request(app.getHttpServer()).post('/tasks/reminders/run').set('Authorization', `Bearer ${directorToken}`);
      expect(first.status).toBe(201);
      expect(typeof first.body.overdueReminders).toBe('number');

      const notificationsAfterFirst = await prisma.notification.count({ where: { event: 'TASK_OVERDUE_REMINDER' } });
      await request(app.getHttpServer()).post('/tasks/reminders/run').set('Authorization', `Bearer ${directorToken}`);
      const notificationsAfterSecond = await prisma.notification.count({ where: { event: 'TASK_OVERDUE_REMINDER' } });
      expect(notificationsAfterSecond).toBe(notificationsAfterFirst);
    });
  });

  describe('audit — VIEW recorded for reading a task', () => {
    it('creates a VIEW audit record with the task id as objectId', async () => {
      await request(app.getHttpServer()).get(`/tasks/${taskAId}`).set('Authorization', `Bearer ${directorToken}`);
      const row = await prisma.auditLog.findFirst({ where: { action: 'VIEW', objectType: 'Tasks', objectId: taskAId }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });
});
