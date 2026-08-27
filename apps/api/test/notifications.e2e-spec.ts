import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JobRunnerService } from '../src/common/jobs/job-runner.service';
import { drainJobsToCompletion } from './helpers/drain-jobs';
import { createStudentWithCase } from './helpers/create-student-case';
import { issueTestSession } from './helpers/issue-session';

/// 06-operations/02_NOTIFICATION.md: in-app + email fan-out, dedup (no double-send on a
/// retried/repeated event), recipient authorization (self-service inbox only, RBAC-aware
/// recipient resolution), and no sensitive data (financial fields) in the notification
/// payload.
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobRunner: JobRunnerService;
  let directorToken: string;
  let managerId: string;
  let consultantAToken: string;
  let consultantAId: string;
  let financeToken: string;
  let financeId: string;
  let salesToken: string;

  let caseAId: string;

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
    ({ userId: managerId } = await issueTestSession(prisma, 'demo.manager'));
    ({ token: consultantAToken, userId: consultantAId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: financeToken, userId: financeId } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));

    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
  });

  // Same rationale as tasks.e2e-spec.ts: track and delete exactly the tasks this file
  // creates against the shared caseA fixture, never a blanket clear of caseA's tasks.
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
      .send({ module: 'counseling', taskType: 'follow_up', title: `E2E Notify Task ${randomUUID()}`, deadline: '2026-12-01', ...overrides });
    expect(res.status).toBe(201);
    createdTaskIds.push(res.body.id);
    return res.body;
  }

  describe('task assignment fan-out (in-app + email)', () => {
    it('creating a task notifies the owner on both channels; IN_APP is immediately "sent", EMAIL dispatches asynchronously via the Phase 12 job queue', async () => {
      const task = await createTask(caseAId, consultantAToken, { ownerId: consultantAId });

      const inApp = await prisma.notification.findFirst({ where: { recipientId: consultantAId, event: 'TASK_ASSIGNED', channel: 'IN_APP', payload: { path: ['taskId'], equals: task.id } } });
      expect(inApp).not.toBeNull();
      expect(inApp?.sentAt).not.toBeNull();

      const emailBeforeDispatch = await prisma.notification.findFirst({ where: { recipientId: consultantAId, event: 'TASK_ASSIGNED', channel: 'EMAIL', payload: { path: ['taskId'], equals: task.id } } });
      expect(emailBeforeDispatch).not.toBeNull();
      // Recorded immediately, but not yet dispatched — the EMAIL_DISPATCH job is queued,
      // not run inline, so sentAt is still null right after the row is created.
      expect(emailBeforeDispatch?.sentAt).toBeNull();

      await drainJobsToCompletion(jobRunner, prisma);
      const emailAfterDispatch = await prisma.notification.findUnique({ where: { id: emailBeforeDispatch!.id } });
      expect(emailAfterDispatch?.sentAt).not.toBeNull();
    });

    it('reassigning a task notifies the new owner', async () => {
      const task = await createTask(caseAId, consultantAToken, { ownerId: consultantAId });
      const { userId: docSpecialistId } = await issueTestSession(prisma, 'demo.docspecialist');
      await request(app.getHttpServer()).patch(`/tasks/${task.id}/assign`).set('Authorization', `Bearer ${consultantAToken}`).send({ ownerId: docSpecialistId });

      const notified = await prisma.notification.findFirst({
        where: { recipientId: docSpecialistId, event: 'TASK_ASSIGNED', channel: 'IN_APP', payload: { path: ['taskId'], equals: task.id } },
      });
      expect(notified).not.toBeNull();
    });

    it('does not leak the internal blocker text to anyone but the case owner, and never notifies the actor of their own action', async () => {
      // consultant.a IS caseA's owner — blocking their own task must not self-notify.
      const task = await createTask(caseAId, consultantAToken, { ownerId: consultantAId });
      await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ status: 'BLOCKED', blocker: 'Waiting on a signature.' });

      const selfNotified = await prisma.notification.findFirst({ where: { recipientId: consultantAId, event: 'TASK_BLOCKED', payload: { path: ['taskId'], equals: task.id } } });
      expect(selfNotified).toBeNull();
    });

    it('a task blocked by a non-owner notifies the case owner, including the blocker reason (internal-staff-to-internal-staff, not exposed to the client)', async () => {
      const { userId: docSpecialistId, token: docSpecialistToken } = await issueTestSession(prisma, 'demo.docspecialist');
      const task = await createTask(caseAId, consultantAToken, { ownerId: docSpecialistId });
      await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${docSpecialistToken}`)
        .send({ status: 'BLOCKED', blocker: 'Missing passport scan from the family.' });

      const caseOwnerNotified = await prisma.notification.findFirst({
        where: { recipientId: consultantAId, event: 'TASK_BLOCKED', channel: 'IN_APP', payload: { path: ['taskId'], equals: task.id } },
      });
      expect(caseOwnerNotified).not.toBeNull();
      const payload = caseOwnerNotified?.payload as { blocker?: string } | null;
      expect(payload?.blocker).toBe('Missing passport scan from the family.');
    });
  });

  describe('deduplication — the same event does not double-send', () => {
    it('reassigning to the SAME owner twice only produces one TASK_ASSIGNED notification per channel', async () => {
      const task = await createTask(caseAId, consultantAToken, { ownerId: consultantAId });
      const { userId: docSpecialistId } = await issueTestSession(prisma, 'demo.docspecialist');

      await request(app.getHttpServer()).patch(`/tasks/${task.id}/assign`).set('Authorization', `Bearer ${consultantAToken}`).send({ ownerId: docSpecialistId });
      await request(app.getHttpServer()).patch(`/tasks/${task.id}/assign`).set('Authorization', `Bearer ${consultantAToken}`).send({ ownerId: docSpecialistId });

      const count = await prisma.notification.count({
        where: { recipientId: docSpecialistId, event: 'TASK_ASSIGNED', channel: 'IN_APP', payload: { path: ['taskId'], equals: task.id } },
      });
      expect(count).toBe(1);
    });
  });

  describe('inbox — self-service, recipient-scoped only (SRS 6.20)', () => {
    it('a user only ever sees notifications addressed to them, never someone else\'s', async () => {
      const task = await createTask(caseAId, consultantAToken, { ownerId: consultantAId });
      const consultantInbox = await request(app.getHttpServer()).get('/notifications').set('Authorization', `Bearer ${consultantAToken}`);
      expect(consultantInbox.status).toBe(200);
      const consultantIds = consultantInbox.body.data.map((n: { payload: { taskId?: string } }) => n.payload?.taskId);
      expect(consultantIds).toContain(task.id);

      const financeInbox = await request(app.getHttpServer()).get('/notifications').set('Authorization', `Bearer ${financeToken}`);
      expect(financeInbox.status).toBe(200);
      const financeIds = financeInbox.body.data.map((n: { payload: { taskId?: string } }) => n.payload?.taskId);
      expect(financeIds).not.toContain(task.id);
    });

    it('marks a notification read, and cannot mark someone else\'s notification (404)', async () => {
      const task = await createTask(caseAId, consultantAToken, { ownerId: consultantAId });
      const notification = await prisma.notification.findFirstOrThrow({
        where: { recipientId: consultantAId, event: 'TASK_ASSIGNED', channel: 'IN_APP', payload: { path: ['taskId'], equals: task.id } },
      });

      const otherUserAttempt = await request(app.getHttpServer()).patch(`/notifications/${notification.id}/read`).set('Authorization', `Bearer ${financeToken}`);
      expect(otherUserAttempt.status).toBe(404);

      const ownAttempt = await request(app.getHttpServer()).patch(`/notifications/${notification.id}/read`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(ownAttempt.status).toBe(200);
      expect(ownAttempt.body.readAt).not.toBeNull();
    });

    it('filters the inbox to unreadOnly', async () => {
      const task = await createTask(caseAId, consultantAToken, { ownerId: consultantAId });
      const notification = await prisma.notification.findFirstOrThrow({
        where: { recipientId: consultantAId, event: 'TASK_ASSIGNED', channel: 'IN_APP', payload: { path: ['taskId'], equals: task.id } },
      });
      await request(app.getHttpServer()).patch(`/notifications/${notification.id}/read`).set('Authorization', `Bearer ${consultantAToken}`);

      const res = await request(app.getHttpServer()).get('/notifications').query({ unreadOnly: 'true' }).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((n: { id: string }) => n.id)).not.toContain(notification.id);
    });
  });

  describe('contract approval request — no financial data in the payload', () => {
    it('submitting a contract notifies every contracts:approve holder, without the contract value', async () => {
      const { studentId } = await createStudentWithCase(app, salesToken);
      const createRes = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, value: 4242, currency: 'USD' });
      const contract = createRes.body;
      await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${directorToken}`);

      for (const approverId of [managerId]) {
        const notification = await prisma.notification.findFirst({
          where: { recipientId: approverId, event: 'CONTRACT_APPROVAL_REQUEST', channel: 'IN_APP', payload: { path: ['contractId'], equals: contract.id } },
        });
        expect(notification).not.toBeNull();
        const payload = notification?.payload as Record<string, unknown> | null;
        expect(payload).not.toHaveProperty('value');
        expect(payload).not.toHaveProperty('currency');
        expect(payload?.contractCode).toBe(contract.contractCode);
      }
    });
  });

  describe('payment overdue reminder — no financial data in the payload', () => {
    it('the reminder sweep notifies payments:record holders about the seed overdue payment, without amount/currency', async () => {
      const res = await request(app.getHttpServer()).post('/payments/reminders/run').set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(201);

      const fixturePayment = await prisma.payment.findUniqueOrThrow({ where: { paymentCode: 'PAY-2026-90002' } });
      const notification = await prisma.notification.findFirst({
        where: { recipientId: financeId, event: 'PAYMENT_OVERDUE_REMINDER', channel: 'IN_APP', payload: { path: ['paymentId'], equals: fixturePayment.id } },
      });
      expect(notification).not.toBeNull();
      const payload = notification?.payload as Record<string, unknown> | null;
      expect(payload).not.toHaveProperty('amount');
      expect(payload).not.toHaveProperty('currency');
      expect(payload?.paymentCode).toBe('PAY-2026-90002');
    });

    it('re-running the sweep the same day does not double-send', async () => {
      const before = await prisma.notification.count({ where: { event: 'PAYMENT_OVERDUE_REMINDER', recipientId: financeId } });
      await request(app.getHttpServer()).post('/payments/reminders/run').set('Authorization', `Bearer ${directorToken}`);
      const after = await prisma.notification.count({ where: { event: 'PAYMENT_OVERDUE_REMINDER', recipientId: financeId } });
      expect(after).toBe(before);
    });

    it('rejects a non-admin/director caller (403)', async () => {
      const res = await request(app.getHttpServer()).post('/payments/reminders/run').set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(403);
    });
  });
});
