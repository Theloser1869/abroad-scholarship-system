import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JobRunnerService } from '../src/common/jobs/job-runner.service';
import { JobsService } from '../src/common/jobs/jobs.service';
import { TransientJobError } from '../src/common/jobs/job-error';
import { SchedulerService } from '../src/common/scheduler/scheduler.service';
import { drainJobs } from './helpers/drain-jobs';
import { issueTestSession } from './helpers/issue-session';

/// 12-platform/02_INTEGRATIONS_JOBS.md — the DB-backed job queue (idempotent enqueue,
/// transient-vs-permanent retry classification, backoff) and the scheduler that drives it.
describe('Background Jobs + Scheduler (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobs: JobsService;
  let jobRunner: JobRunnerService;
  let scheduler: SchedulerService;
  let systemAdminToken: string;
  let directorToken: string;
  let consultantAToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jobs = app.get(JobsService);
    jobRunner = app.get(JobRunnerService);
    scheduler = app.get(SchedulerService);

    ({ token: systemAdminToken } = await issueTestSession(prisma, 'admin'));
    ({ token: directorToken } = await issueTestSession(prisma, 'demo.director'));
    ({ token: consultantAToken } = await issueTestSession(prisma, 'demo.consultant.a'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('idempotency', () => {
    it('enqueueing the same dedupeKey twice returns the same job row, never a duplicate', async () => {
      const dedupeKey = `test-job:${randomUUID()}`;
      const first = await jobs.enqueue('TEST_NOOP', { a: 1 }, { dedupeKey });
      const second = await jobs.enqueue('TEST_NOOP', { a: 2 }, { dedupeKey });
      expect(second.id).toBe(first.id);
      const count = await prisma.backgroundJob.count({ where: { dedupeKey } });
      expect(count).toBe(1);
    });

    it('concurrent enqueue attempts with the same dedupeKey never race into two rows', async () => {
      const dedupeKey = `test-job-race:${randomUUID()}`;
      const results = await Promise.all(Array.from({ length: 5 }, () => jobs.enqueue('TEST_NOOP', {}, { dedupeKey })));
      const uniqueIds = new Set(results.map((r) => r.id));
      expect(uniqueIds.size).toBe(1);
    });
  });

  describe('retry — transient vs permanent classification', () => {
    it('a TransientJobError is retried with exponential backoff, attempts incremented, until success', async () => {
      let attemptCount = 0;
      const jobType = `TEST_TRANSIENT_${randomUUID()}`;
      jobRunner.registerProcessor(jobType, async () => {
        attemptCount += 1;
        if (attemptCount < 2) throw new TransientJobError('simulated transient failure');
      });

      const job = await jobs.enqueue(jobType, {});
      await drainJobs(jobRunner);
      const afterFirstAttempt = await jobs.getById(job.id);
      expect(afterFirstAttempt?.status).toBe('PENDING'); // rescheduled, not failed
      expect(afterFirstAttempt?.attempts).toBe(1);
      expect(afterFirstAttempt?.lastError).toContain('simulated transient failure');
      expect(afterFirstAttempt?.scheduledFor.getTime()).toBeGreaterThan(Date.now()); // backoff delay applied

      // Force it due now (bypass the real backoff delay for test speed) and process again.
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { scheduledFor: new Date() } });
      await drainJobs(jobRunner);
      const afterSecondAttempt = await jobs.getById(job.id);
      expect(afterSecondAttempt?.status).toBe('SUCCEEDED');
      expect(attemptCount).toBe(2);
    });

    it('a non-transient error fails the job immediately — never retried', async () => {
      const jobType = `TEST_PERMANENT_${randomUUID()}`;
      let attemptCount = 0;
      jobRunner.registerProcessor(jobType, async () => {
        attemptCount += 1;
        throw new Error('permanent business-logic failure');
      });

      const job = await jobs.enqueue(jobType, {});
      await drainJobs(jobRunner);
      const result = await jobs.getById(job.id);
      expect(result?.status).toBe('FAILED');
      expect(result?.attempts).toBe(1);
      expect(attemptCount).toBe(1);

      // Confirm it's truly dead — a later poll never picks it up again.
      await drainJobs(jobRunner);
      expect(attemptCount).toBe(1);
    });

    it('a transient error stops retrying once maxAttempts is exhausted', async () => {
      const jobType = `TEST_EXHAUSTED_${randomUUID()}`;
      jobRunner.registerProcessor(jobType, async () => {
        throw new TransientJobError('always fails');
      });

      const job = await jobs.enqueue(jobType, {}, { maxAttempts: 1 });
      await drainJobs(jobRunner);
      const result = await jobs.getById(job.id);
      expect(result?.status).toBe('FAILED');
      expect(result?.attempts).toBe(1);
    });

    it('an unregistered job type is marked FAILED, not retried forever', async () => {
      const job = await jobs.enqueue(`TEST_UNKNOWN_${randomUUID()}`, {});
      await drainJobs(jobRunner);
      const result = await jobs.getById(job.id);
      expect(result?.status).toBe('FAILED');
      expect(result?.lastError).toBe('NO_PROCESSOR_REGISTERED');
    });
  });

  describe('scheduler — recurring sweeps, idempotent per UTC day', () => {
    it('tick() enqueues the reminder-sweep and sync jobs exactly once per day even when called repeatedly', async () => {
      await prisma.backgroundJob.deleteMany({ where: { jobType: { in: ['REMINDER_SWEEP_TASK', 'REMINDER_SWEEP_PAYMENT', 'EXTERNAL_DATA_SYNC'] } } });
      await scheduler.tick();
      await scheduler.tick();
      await scheduler.tick();

      const taskSweepCount = await prisma.backgroundJob.count({ where: { jobType: 'REMINDER_SWEEP_TASK' } });
      const paymentSweepCount = await prisma.backgroundJob.count({ where: { jobType: 'REMINDER_SWEEP_PAYMENT' } });
      const syncCount = await prisma.backgroundJob.count({ where: { jobType: 'EXTERNAL_DATA_SYNC' } });
      expect(taskSweepCount).toBe(1);
      expect(paymentSweepCount).toBe(1);
      expect(syncCount).toBe(1);
    });

    it('the enqueued REMINDER_SWEEP_TASK job actually runs the real Task reminder sweep when processed', async () => {
      await prisma.backgroundJob.deleteMany({ where: { jobType: 'REMINDER_SWEEP_TASK' } });
      await scheduler.tick();
      await drainJobs(jobRunner);
      const job = await prisma.backgroundJob.findFirst({ where: { jobType: 'REMINDER_SWEEP_TASK' }, orderBy: { createdAt: 'desc' } });
      expect(job?.status).toBe('SUCCEEDED');
    });
  });

  describe('admin job-status endpoint — RBAC', () => {
    it('SYSTEM_ADMIN can list and view job status', async () => {
      const job = await jobs.enqueue(`TEST_ADMIN_VIEW_${randomUUID()}`, {});
      const listRes = await request(app.getHttpServer()).get('/admin/jobs').set('Authorization', `Bearer ${systemAdminToken}`);
      expect(listRes.status).toBe(200);
      const detailRes = await request(app.getHttpServer()).get(`/admin/jobs/${job.id}`).set('Authorization', `Bearer ${systemAdminToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.id).toBe(job.id);
    });

    it('every other role is denied — job status is SYSTEM_ADMIN-only', async () => {
      for (const token of [directorToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get('/admin/jobs').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    it('an unknown job id 404s, never leaking existence of a mismatched id', async () => {
      const res = await request(app.getHttpServer()).get(`/admin/jobs/${randomUUID()}`).set('Authorization', `Bearer ${systemAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
