import { Module } from '@nestjs/common';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import { PartnerDocumentsNestedController, PartnerDocumentsController } from './partner-documents.controller';
import { PartnerDocumentsService } from './partner-documents.service';

@Module({
  imports: [IdentityModule, DocumentsModule],
  controllers: [PartnerDocumentsNestedController, PartnerDocumentsController],
  providers: [PartnerDocumentsService],
  exports: [PartnerDocumentsService],
})
export class PartnerDocumentsModule {}
