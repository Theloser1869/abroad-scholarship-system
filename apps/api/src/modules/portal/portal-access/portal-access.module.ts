import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { PublicParentInvitationsController, StudentContactsController } from './portal-access.controller';
import { PortalAccessService } from './portal-access.service';

@Module({
  imports: [IdentityModule],
  controllers: [StudentContactsController, PublicParentInvitationsController],
  providers: [PortalAccessService],
  exports: [PortalAccessService],
})
export class PortalAccessModule {}
