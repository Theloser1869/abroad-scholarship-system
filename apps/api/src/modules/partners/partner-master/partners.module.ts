import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  imports: [IdentityModule],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnerMasterModule {}
