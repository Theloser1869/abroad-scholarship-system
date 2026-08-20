import { Module } from '@nestjs/common';
import { CaseManagementModule } from '../../case-management/case-management.module';
import { PaymentsModule } from '../../commercial/payments/payments.module';
import { IdentityModule } from '../../identity/identity.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  // `CommercialModule` itself exports nothing (no `exports:` array) — `PaymentsModule` is
  // imported directly to reach `PaymentsService`. `CaseManagementModule` already
  // re-exports `TasksModule` (see its own doc comment).
  imports: [IdentityModule, PaymentsModule, CaseManagementModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
