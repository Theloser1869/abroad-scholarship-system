import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { JobsService } from '../jobs/jobs.service';

/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "Scheduler ... không tạo duplicate, xử lý
/// timezone đúng, retry an toàn, audit/observe được, không phụ thuộc vào user mở UI").
/// Enqueues (never runs inline) the recurring sweeps this project already has real,
/// idempotent domain logic for — `TasksService.generateDeadlineReminders`/
/// `generateOverdueReminders` (Phase 06) and `PaymentsService.generateOverdueReminders`
/// (Phase 05), previously only reachable via a manual `POST .../reminders/run`. Those
/// manual routes are UNCHANGED (still call the same service methods directly, synchronously
/// — see `docs/DECISIONS.md`/`docs/phase-status/PHASE_12.md` for why they were not rewritten
/// to route through the queue) — this scheduler is a second, automatic caller of the exact
/// same underlying methods via their own registered job processors
/// (`TasksModule`/`PaymentsModule`'s `onModuleInit`), never a duplicated copy of the sweep
/// logic itself.
///
/// Timezone: every dedupe key is bucketed by UTC calendar day
/// (`toISOString().slice(0,10)`), the same convention `generateOverdueReminders` already
/// uses internally — a server in any timezone computes the identical bucket for "today,"
/// so a duplicate sweep is never enqueued twice for what a human would call the same day
/// somewhere, and the scheduler never depends on the server's local TZ setting.
@Injectable()
export class SchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly jobs: JobsService,
    private readonly config: ConfigService,
  ) {}

  startTicking(): void {
    if (this.timer) return;
    const intervalMs = Number(this.config.get<string>('SCHEDULER_INTERVAL_MS') ?? '60000');
    this.timer = setInterval(() => {
      this.tick().catch((err) => this.logger.error(`Scheduler tick failed: ${(err as Error).message}`));
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /// One round of "enqueue whatever recurring jobs are due." Public so tests (and
  /// `startTicking`'s own interval) can call it directly rather than waiting on wall-clock
  /// time — same testability precedent as `JobRunnerService.processPendingJobs`.
  async tick(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const correlationId = randomUUID();

    await this.jobs.enqueue('REMINDER_SWEEP_TASK', {}, { dedupeKey: `reminder-sweep-task:${today}`, correlationId });
    await this.jobs.enqueue('REMINDER_SWEEP_PAYMENT', {}, { dedupeKey: `reminder-sweep-payment:${today}`, correlationId });
    await this.jobs.enqueue('EXTERNAL_DATA_SYNC', {}, { dedupeKey: `external-data-sync:${today}`, correlationId });
  }
}
