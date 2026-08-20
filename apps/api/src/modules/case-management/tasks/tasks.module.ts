import { Module, OnModuleInit } from '@nestjs/common';
import { JobRunnerService } from '../../../common/jobs/job-runner.service';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationsModule } from '../../notifications/notifications/notifications.module';
import { CaseTasksController } from './case-tasks.controller';
import { TaskGenerationService } from './task-generation.service';
import { TaskTemplatesController } from './task-templates.controller';
import { TaskTemplatesService } from './task-templates.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

export const TASK_REMINDER_SWEEP_JOB_TYPE = 'REMINDER_SWEEP_TASK';

/// `TaskGenerationService` is exported for cross-domain use per
/// docs/architecture/DOMAIN_MAP.md domain 3's "TaskService (module khác có thể tạo task
/// template khi stage thay đổi)" — `crm` (Lead conversion) and `commercial` (Contract
/// activation) both call it directly.
@Module({
  imports: [IdentityModule, NotificationsModule],
  controllers: [TasksController, CaseTasksController, TaskTemplatesController],
  providers: [TasksService, TaskGenerationService, TaskTemplatesService],
  exports: [TasksService, TaskGenerationService],
})
export class TasksModule implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly tasks: TasksService,
  ) {}

  /// Phase 12 — the scheduler (`SchedulerService.tick`) enqueues this job type once per
  /// UTC day; this processor is the only thing that actually runs the sweep, calling the
  /// exact same Phase 06 methods `POST /tasks/reminders/run` calls directly (unchanged) —
  /// one source of truth for the sweep logic, two callers (manual route, scheduled job).
  onModuleInit(): void {
    this.runner.registerProcessor(TASK_REMINDER_SWEEP_JOB_TYPE, async () => {
      await this.tasks.generateDeadlineReminders();
      await this.tasks.generateOverdueReminders();
    });
  }
}
