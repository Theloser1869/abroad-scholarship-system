import { Module } from '@nestjs/common';
import { CaseManagementModule } from '../../case-management/case-management.module';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationsModule } from '../../notifications/notifications/notifications.module';
import { ContractTemplatesController } from './contract-templates.controller';
import { ContractTemplatesService } from './contract-templates.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PublicContractReviewController } from './public-contract-review.controller';

/// `CaseManagementModule` is imported for `TaskGenerationService` (Phase 06 — Contract
/// activation is one of the auto-generation triggers 06-operations/01_TASK.md names) —
/// matches the dependency direction docs/architecture/DOMAIN_MAP.md section 12 already
/// declares (`commercial` depends on `case-management`, never the reverse).
@Module({
  imports: [IdentityModule, CaseManagementModule, NotificationsModule],
  controllers: [ContractsController, ContractTemplatesController, PublicContractReviewController],
  providers: [ContractsService, ContractTemplatesService],
  exports: [ContractsService],
})
export class ContractsModule {}
