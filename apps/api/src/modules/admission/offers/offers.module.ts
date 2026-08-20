import { Module } from '@nestjs/common';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { ApplicationsModule } from '../applications/applications.module';
import { ApplicationOffersController, OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [IdentityModule, DocumentsModule, ApplicationsModule],
  controllers: [ApplicationOffersController, OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
