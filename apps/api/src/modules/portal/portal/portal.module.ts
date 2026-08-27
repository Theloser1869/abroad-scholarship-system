import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../../admission/applications/applications.module';
import { OffersModule } from '../../admission/offers/offers.module';
import { ScholarshipApplicationsModule } from '../../admission/scholarship-applications/scholarship-applications.module';
import { ClosureModule } from '../../case-management/closure/closure.module';
import { TasksModule } from '../../case-management/tasks/tasks.module';
import { ContractsModule } from '../../commercial/contracts/contracts.module';
import { PaymentsModule } from '../../commercial/payments/payments.module';
import { RoadmapsModule } from '../../counseling/roadmaps/roadmaps.module';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationsModule } from '../../notifications/notifications/notifications.module';
import { EnrollmentsModule } from '../../visa/enrollments/enrollments.module';
import { PreDepartureModule } from '../../visa/pre-departure/pre-departure.module';
import { VisasModule } from '../../visa/visas/visas.module';
import { PortalAccessModule } from '../portal-access/portal-access.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

/// The Portal's entire read/thin-action surface — every provider here is an EXISTING
/// Phase 05-10 domain module's service, injected and delegated to, never a duplicated
/// business rule. See `PortalService`'s own doc comment.
@Module({
  imports: [
    IdentityModule,
    PortalAccessModule,
    RoadmapsModule,
    TasksModule,
    ClosureModule,
    DocumentsModule,
    ApplicationsModule,
    OffersModule,
    ScholarshipApplicationsModule,
    VisasModule,
    PreDepartureModule,
    EnrollmentsModule,
    ContractsModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalReadModule {}
