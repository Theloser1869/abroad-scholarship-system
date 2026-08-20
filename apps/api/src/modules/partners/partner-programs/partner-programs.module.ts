import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { PartnerProgramsNestedController, PartnerProgramsController } from './partner-programs.controller';
import { PartnerProgramsService } from './partner-programs.service';

@Module({
  imports: [IdentityModule],
  controllers: [PartnerProgramsNestedController, PartnerProgramsController],
  providers: [PartnerProgramsService],
  exports: [PartnerProgramsService],
})
export class PartnerProgramsModule {}
