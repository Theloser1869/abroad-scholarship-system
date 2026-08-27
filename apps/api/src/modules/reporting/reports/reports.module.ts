import { Module } from '@nestjs/common';
import { AssessmentsModule } from '../../counseling/assessments/assessments.module';
import { CaseManagementModule } from '../../case-management/case-management.module';
import { PaymentsModule } from '../../commercial/payments/payments.module';
import { IdentityModule } from '../../identity/identity.module';
import { VisaStatusModule } from '../../visa/visa-status/visa-status.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  // `CommercialModule` itself exports nothing (no `exports:` array) — `PaymentsModule` is
  // imported directly to reach `PaymentsService`. `CaseManagementModule` already
  // re-exports `TasksModule` (see its own doc comment). `AssessmentsModule`/
  // `VisaStatusModule` added for the sheet06 KPI dashboard (profile completeness /
  // pre-departure checklist completion) — both are leaf modules, no cycle risk.
  imports: [IdentityModule, PaymentsModule, CaseManagementModule, AssessmentsModule, VisaStatusModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
