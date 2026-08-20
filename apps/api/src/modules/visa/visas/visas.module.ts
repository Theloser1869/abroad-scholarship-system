import { Module } from '@nestjs/common';
import { TasksModule } from '../../case-management/tasks/tasks.module';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationsModule } from '../../notifications/notifications/notifications.module';
import { CaseVisasController, VisasController } from './visas.controller';
import { VisasService } from './visas.service';
import { VisaChecklistItemController, VisaChecklistItemsController } from './visa-checklist.controller';
import { VisaChecklistService } from './visa-checklist.service';

@Module({
  imports: [IdentityModule, DocumentsModule, TasksModule, NotificationsModule],
  controllers: [CaseVisasController, VisasController, VisaChecklistItemsController, VisaChecklistItemController],
  providers: [VisasService, VisaChecklistService],
  exports: [VisasService, VisaChecklistService],
})
export class VisasModule {}
