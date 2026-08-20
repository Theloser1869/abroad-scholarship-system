import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { VisaChecklistTemplatesController } from './visa-checklist-templates.controller';
import { VisaChecklistTemplatesService } from './visa-checklist-templates.service';

@Module({
  imports: [IdentityModule],
  controllers: [VisaChecklistTemplatesController],
  providers: [VisaChecklistTemplatesService],
  exports: [VisaChecklistTemplatesService],
})
export class VisaChecklistTemplatesModule {}
