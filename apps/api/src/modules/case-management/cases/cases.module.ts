import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { CommentsModule } from '../../notifications/comments/comments.module';
import { TimelineModule } from '../../reporting/timeline/timeline.module';
import { TasksModule } from '../tasks/tasks.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007) — `PaymentsModule`/
/// `VisaStatusModule` were previously imported here only for `CasesService.close()`'s
/// closure preconditions; that method (and its precondition checks) moved to the unified
/// `ClosureModule` (`case-management/closure`), so those imports are no longer needed here.
@Module({
  imports: [IdentityModule, CommentsModule, TimelineModule, TasksModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
