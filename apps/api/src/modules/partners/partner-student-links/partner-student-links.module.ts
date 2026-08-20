import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import {
  PartnerStudentLinksNestedController,
  StudentPartnerLinksController,
  PartnerStudentLinksController,
} from './partner-student-links.controller';
import { PartnerStudentLinksService } from './partner-student-links.service';

@Module({
  imports: [IdentityModule],
  controllers: [PartnerStudentLinksNestedController, StudentPartnerLinksController, PartnerStudentLinksController],
  providers: [PartnerStudentLinksService],
  exports: [PartnerStudentLinksService],
})
export class PartnerStudentLinksModule {}
