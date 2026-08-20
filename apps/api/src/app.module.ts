import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import './common/json-bigint.polyfill';
import { AuthContextMiddleware } from './common/context/auth-context.middleware';
import { RequestIdMiddleware } from './common/context/request-id.middleware';
import { CommonModule } from './common/common.module';
import { IntegrationsModule } from './common/integrations/integrations.module';
import { JobsModule } from './common/jobs/jobs.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { SchedulerModule } from './common/scheduler/scheduler.module';
import { StorageModule } from './common/storage/storage.module';
import { AdmissionModule } from './modules/admission/admission.module';
import { CaseManagementModule } from './modules/case-management/case-management.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { CounselingModule } from './modules/counseling/counseling.module';
import { CrmModule } from './modules/crm/crm.module';
import { DocumentsModule } from './modules/documents/documents/documents.module';
import { WebhooksModule } from './modules/documents/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { NotificationsModule } from './modules/notifications/notifications/notifications.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PortalModule } from './modules/portal/portal.module';
import { AuditLogsModule } from './modules/reporting/audit-logs/audit-logs.module';
import { ReportsModule } from './modules/reporting/reports/reports.module';
import { VisaModule } from './modules/visa/visa.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    RateLimitModule,
    HealthModule,
    // Phase 12 cross-cutting infra — all @Global(), registered once here so every domain
    // module below can inject JobsService/JobRunnerService/StorageProvider/adapters
    // without re-importing them.
    JobsModule,
    StorageModule,
    IntegrationsModule,
    SchedulerModule,
    IdentityModule,
    CrmModule,
    CaseManagementModule,
    CommercialModule,
    NotificationsModule,
    DocumentsModule,
    WebhooksModule,
    CounselingModule,
    AdmissionModule,
    VisaModule,
    PartnersModule,
    PortalModule,
    AuditLogsModule,
    ReportsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, AuthContextMiddleware).forRoutes('*');
  }
}
