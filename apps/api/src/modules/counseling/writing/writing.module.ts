import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { CommentsModule } from '../../notifications/comments/comments.module';
import { CaseWritingArtifactsController, WritingArtifactsController, WritingVersionsController } from './writing-artifacts.controller';
import { WritingArtifactsService } from './writing-artifacts.service';
import { CaseLorController, LorController } from './lor.controller';
import { LorService } from './lor.service';
import { DocumentsModule } from '../../documents/documents/documents.module';

@Module({
  imports: [IdentityModule, CommentsModule, DocumentsModule],
  controllers: [CaseWritingArtifactsController, WritingArtifactsController, WritingVersionsController, CaseLorController, LorController],
  providers: [WritingArtifactsService, LorService],
})
export class WritingModule {}
