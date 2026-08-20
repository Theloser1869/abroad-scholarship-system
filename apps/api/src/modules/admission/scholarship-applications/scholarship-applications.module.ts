import { Module } from '@nestjs/common';
import { TasksModule } from '../../case-management/tasks/tasks.module';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationsModule } from '../../notifications/notifications/notifications.module';
import { CaseScholarshipApplicationsController, ScholarshipApplicationsController } from './scholarship-applications.controller';
import { ScholarshipApplicationsService } from './scholarship-applications.service';

@Module({
  imports: [IdentityModule, DocumentsModule, TasksModule, NotificationsModule],
  controllers: [CaseScholarshipApplicationsController, ScholarshipApplicationsController],
  providers: [ScholarshipApplicationsService],
  exports: [ScholarshipApplicationsService],
})
export class ScholarshipApplicationsModule {}
