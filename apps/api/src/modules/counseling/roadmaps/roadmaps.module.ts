import { Module } from '@nestjs/common';
import { CaseManagementModule } from '../../case-management/case-management.module';
import { TasksModule } from '../../case-management/tasks/tasks.module';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { CaseRoadmapsController, RoadmapsController } from './roadmaps.controller';
import { RoadmapsService } from './roadmaps.service';
import { MilestonesController, RoadmapMilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

/// `CaseManagementModule` (for `TaskGenerationService`, re-exported — see its own doc
/// comment) + `TasksModule` directly (for `TasksService`, milestone task-linkage) —
/// matches the dependency direction already established for `commercial` in Phase 06.
/// `DocumentsModule` added Phase 11 — `MilestonesService.submitEvidence` (Portal).
@Module({
  imports: [IdentityModule, CaseManagementModule, TasksModule, DocumentsModule],
  controllers: [RoadmapsController, CaseRoadmapsController, RoadmapMilestonesController, MilestonesController],
  providers: [RoadmapsService, MilestonesService],
  exports: [RoadmapsService, MilestonesService],
})
export class RoadmapsModule {}
