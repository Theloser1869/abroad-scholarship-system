import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { AssessmentsController, CaseAssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

@Module({
  imports: [IdentityModule],
  controllers: [AssessmentsController, CaseAssessmentsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
