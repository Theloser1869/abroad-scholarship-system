import { Module } from '@nestjs/common';
import { CasesModule } from './cases/cases.module';
import { ClosureModule } from './closure/closure.module';
import { DuplicateDetectionService } from './shared/duplicate-detection.service';
import { StudentsModule } from './students/students.module';
import { TasksModule } from './tasks/tasks.module';

/// Domain module boundary per docs/architecture/DOMAIN_MAP.md domain 3 (Case Management):
/// owns Student, StudentContact, Case, CaseMember, Task, TaskDependency, TaskTemplate, and
/// (Client Acceptance Remediation DEC-06/07/08) the unified Closure/Liquidation workflow.
/// `students` (full CRUD + Lead-conversion target, Phase 02/04), `cases` (Phase 03
/// read-only scope reference, extended in Phase 04 with membership/stage mutations —
/// closure itself moved to `closure`, see `ClosureModule`), `tasks` (Phase 06 — Task
/// Engine), and `closure` are all implemented.
/// `DuplicateDetectionService` is exported for `crm`'s Lead-conversion flow (04-core-crm/
/// 01_LEAD.md) — case-management owns Student identity, so it owns duplicate detection
/// against that identity too, not crm. `TasksModule` is re-exported so that both `crm`
/// (Lead conversion → CASE_CREATED trigger) and `commercial` (Contract activation →
/// CONTRACT_ACTIVATED trigger) can reach `TaskGenerationService` — the cross-domain
/// entrypoint DOMAIN_MAP.md section 3 names ("module khác có thể tạo task template khi
/// stage thay đổi") — without each importing `tasks` directly. `ClosureModule` is
/// re-exported so `portal` can reach `ClosureService` for student/parent liquidation
/// confirmation (`PortalService.confirmLiquidation`).
@Module({
  imports: [StudentsModule, CasesModule, TasksModule, ClosureModule],
  providers: [DuplicateDetectionService],
  exports: [DuplicateDetectionService, TasksModule, ClosureModule],
})
export class CaseManagementModule {}
