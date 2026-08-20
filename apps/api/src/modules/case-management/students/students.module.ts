import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { CommentsModule } from '../../notifications/comments/comments.module';
import { TimelineModule } from '../../reporting/timeline/timeline.module';
import { CasesModule } from '../cases/cases.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [IdentityModule, CasesModule, CommentsModule, TimelineModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
