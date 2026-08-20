import { Module } from '@nestjs/common';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationsModule } from '../../notifications/notifications/notifications.module';
import { TasksModule } from '../../case-management/tasks/tasks.module';
import { ApplicationChecklistService } from './application-checklist.service';
import { ApplicationsService } from './applications.service';
import {
  ApplicationChecklistItemsController,
  ApplicationsController,
  CaseApplicationsController,
  ChecklistItemsController,
} from './applications.controller';

@Module({
  imports: [IdentityModule, DocumentsModule, TasksModule, NotificationsModule],
  controllers: [CaseApplicationsController, ApplicationsController, ApplicationChecklistItemsController, ChecklistItemsController],
  providers: [ApplicationsService, ApplicationChecklistService],
  exports: [ApplicationsService, ApplicationChecklistService],
})
export class ApplicationsModule {}
