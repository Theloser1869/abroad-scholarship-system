import { Module } from '@nestjs/common';
import { CaseManagementModule } from '../../case-management/case-management.module';
import { IdentityModule } from '../../identity/identity.module';
import { CommentsModule } from '../../notifications/comments/comments.module';
import { TimelineModule } from '../../reporting/timeline/timeline.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [IdentityModule, CaseManagementModule, CommentsModule, TimelineModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
