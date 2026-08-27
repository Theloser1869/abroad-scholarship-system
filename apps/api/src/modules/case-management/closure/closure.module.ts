import { Module } from '@nestjs/common';
import { PaymentsModule } from '../../commercial/payments/payments.module';
import { IdentityModule } from '../../identity/identity.module';
import { CommentsModule } from '../../notifications/comments/comments.module';
import { VisaStatusModule } from '../../visa/visa-status/visa-status.module';
import { TasksModule } from '../tasks/tasks.module';
import { ClosureController } from './closure.controller';
import { ClosureService } from './closure.service';

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014). `ClosureService` is
/// exported for `PortalModule` (student/parent liquidation confirmation) — same
/// cross-domain expose-point pattern already used by `PaymentsModule`/`VisaStatusModule`
/// themselves.
@Module({
  imports: [IdentityModule, CommentsModule, TasksModule, PaymentsModule, VisaStatusModule],
  controllers: [ClosureController],
  providers: [ClosureService],
  exports: [ClosureService],
})
export class ClosureModule {}
