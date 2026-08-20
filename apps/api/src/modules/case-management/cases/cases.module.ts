import { Module } from '@nestjs/common';
import { PaymentsModule } from '../../commercial/payments/payments.module';
import { IdentityModule } from '../../identity/identity.module';
import { CommentsModule } from '../../notifications/comments/comments.module';
import { TimelineModule } from '../../reporting/timeline/timeline.module';
import { VisaStatusModule } from '../../visa/visa-status/visa-status.module';
import { TasksModule } from '../tasks/tasks.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

/// `PaymentsModule` and `VisaStatusModule` are imported for Phase 09 Closure validation
/// only (`CasesService.close()`) — both are leaf-ish modules with no dependency back on
/// `case-management`, so this does not create a module cycle; see the doc comment on
/// `close()` itself.
@Module({
  imports: [IdentityModule, CommentsModule, TimelineModule, TasksModule, PaymentsModule, VisaStatusModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
