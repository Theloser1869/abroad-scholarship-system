import { Module, OnModuleInit } from '@nestjs/common';
import { JobRunnerService } from '../../../common/jobs/job-runner.service';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationsModule } from '../../notifications/notifications/notifications.module';
import { ContractPaymentsController } from './contract-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

export const PAYMENT_REMINDER_SWEEP_JOB_TYPE = 'REMINDER_SWEEP_PAYMENT';

/// `PaymentsService` is exported for cross-domain use — `docs/architecture/DOMAIN_MAP.md`
/// domain 7's own stated expose-point ("DebtStatusService dùng bởi visa/case-management để
/// chặn Closure khi còn công nợ"). Phase 09's `CasesService.close()` calls
/// `hasOutstandingDebtForCase` directly rather than re-deriving debt state a second way.
@Module({
  imports: [IdentityModule, NotificationsModule],
  controllers: [PaymentsController, ContractPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly payments: PaymentsService,
  ) {}

  /// Phase 12 — same scheduled-job wiring pattern as `TasksModule`; `POST
  /// /payments/reminders/run` stays unchanged, this is a second, automatic caller of the
  /// same underlying method.
  onModuleInit(): void {
    this.runner.registerProcessor(PAYMENT_REMINDER_SWEEP_JOB_TYPE, async () => {
      await this.payments.generateOverdueReminders();
    });
  }
}
