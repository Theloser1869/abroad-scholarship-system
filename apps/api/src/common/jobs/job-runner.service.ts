import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackgroundJob } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransientJobError } from './job-error';

export type JobHandler = (payload: Record<string, unknown>, job: BackgroundJob) => Promise<void>;

const MAX_BACKOFF_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 5 * 1000;
const CLAIM_BATCH_SIZE = 10;

/// Phase 12 — the worker side of the DB-backed job queue. Domain modules register a
/// handler per `jobType` (`registerProcessor`); this service never imports domain services
/// directly, keeping the dependency direction one-way (domains depend on Jobs, not the
/// reverse — same "adapters, not hard-coded provider logic into business domain" principle
/// 12-platform/02_INTEGRATIONS_JOBS.md asks for, applied to job dispatch itself).
///
/// Retry: exponential backoff (`BASE_BACKOFF_MS * 2^attempts`, capped at `MAX_BACKOFF_MS`).
/// `TransientJobError` → reschedule if `attempts < maxAttempts`; anything else, or attempts
/// exhausted → `status: FAILED` immediately (a permanent failure retried forever helps no
/// one, and un-classified errors default to the safer "stop, don't loop silently" side —
/// see `docs/ASSUMPTIONS.md` ASM-52).
///
/// Logging is structured and deliberately excludes job `payload` contents (which may
/// reference a documentId/paymentId but is never itself a secret in this system's current
/// job types — logged as jobId/type/attempt/correlationId/duration/error only, per
/// 12-platform/02_INTEGRATIONS_JOBS.md "Không log: password/token/API key/signed URL/
/// sensitive document contents/financial secrets").
@Injectable()
export class JobRunnerService implements OnModuleDestroy {
  private readonly logger = new Logger(JobRunnerService.name);
  private readonly processors = new Map<string, JobHandler>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  registerProcessor(jobType: string, handler: JobHandler): void {
    this.processors.set(jobType, handler);
  }

  /// Called once at bootstrap (see `JobsModule.onApplicationBootstrap`) — not from the
  /// constructor, since domain modules register their processors in their OWN
  /// `onModuleInit`, which may run after this service's constructor.
  startPolling(): void {
    if (this.timer) return;
    const intervalMs = Number(this.config.get<string>('JOB_POLL_INTERVAL_MS') ?? '5000');
    this.timer = setInterval(() => {
      this.processPendingJobs().catch((err) => this.logger.error(`Job poll tick failed: ${(err as Error).message}`));
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /// Public so tests (and the scheduler, for an immediate run) can process synchronously
  /// instead of waiting on the poll interval — same "manually invokable, not only
  /// wall-clock-driven" testability precedent as the Phase 06 reminder sweeps.
  async processPendingJobs(): Promise<number> {
    const now = new Date();
    const candidates = await this.prisma.backgroundJob.findMany({
      where: { status: 'PENDING', scheduledFor: { lte: now } },
      orderBy: { scheduledFor: 'asc' },
      take: CLAIM_BATCH_SIZE,
    });
    if (candidates.length === 0) return 0;

    const claimed = await this.prisma.backgroundJob.updateMany({
      where: { id: { in: candidates.map((c) => c.id) }, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: now },
    });
    if (claimed.count === 0) return 0;

    const jobs = await this.prisma.backgroundJob.findMany({ where: { id: { in: candidates.map((c) => c.id) }, status: 'RUNNING' } });
    let processed = 0;
    for (const job of jobs) {
      await this.runOne(job);
      processed += 1;
    }
    return processed;
  }

  private async runOne(job: BackgroundJob): Promise<void> {
    const handler = this.processors.get(job.jobType);
    const startedAt = Date.now();
    if (!handler) {
      this.logger.warn(`No processor registered for jobType=${job.jobType} jobId=${job.id} — marking FAILED.`);
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', lastError: 'NO_PROCESSOR_REGISTERED', attempts: { increment: 1 } },
      });
      return;
    }

    try {
      await handler(job.payload as Record<string, unknown>, job);
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', completedAt: new Date(), attempts: { increment: 1 } },
      });
      this.logger.log(
        `job succeeded type=${job.jobType} id=${job.id} attempt=${job.attempts + 1} correlationId=${job.correlationId ?? '-'} durationMs=${Date.now() - startedAt}`,
      );
    } catch (err) {
      const attempts = job.attempts + 1;
      const isTransient = err instanceof TransientJobError;
      const errorMessage = (err as Error).message?.slice(0, 500) ?? 'unknown error';
      const shouldRetry = isTransient && attempts < job.maxAttempts;

      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: shouldRetry
          ? { status: 'PENDING', attempts, lastError: errorMessage, scheduledFor: this.nextBackoff(attempts) }
          : { status: 'FAILED', attempts, lastError: errorMessage, completedAt: new Date() },
      });

      this.logger.error(
        `job ${shouldRetry ? 'will retry' : 'FAILED (dead-letter)'} type=${job.jobType} id=${job.id} attempt=${attempts}/${job.maxAttempts} transient=${isTransient} correlationId=${job.correlationId ?? '-'} error=${errorMessage}`,
      );
    }
  }

  private nextBackoff(attempts: number): Date {
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
    return new Date(Date.now() + delay);
  }
}
