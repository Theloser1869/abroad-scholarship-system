import { Module } from '@nestjs/common';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { CasePreDepartureController, PreDepartureItemController } from './pre-departure.controller';
import { PreDepartureService } from './pre-departure.service';

@Module({
  imports: [IdentityModule, DocumentsModule],
  controllers: [CasePreDepartureController, PreDepartureItemController],
  providers: [PreDepartureService],
  exports: [PreDepartureService],
})
export class PreDepartureModule {}
