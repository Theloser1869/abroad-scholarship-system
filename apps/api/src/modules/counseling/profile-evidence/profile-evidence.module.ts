import { Module } from '@nestjs/common';
import { DocumentsModule } from '../../documents/documents/documents.module';
import { IdentityModule } from '../../identity/identity.module';
import {
  AcademicRecordsController,
  ActivitiesController,
  CaseAcademicRecordsController,
  CaseActivitiesController,
  CaseCompetitionsController,
  CaseResearchProjectsController,
  CaseTestRecordsController,
  CompetitionsController,
  ResearchProjectsController,
  TestRecordsController,
} from './profile-evidence.controller';
import { AcademicRecordsService } from './academic-records.service';
import { ActivitiesService } from './activities.service';
import { CompetitionsService } from './competitions.service';
import { ResearchProjectsService } from './research-projects.service';
import { TestRecordsService } from './test-records.service';

@Module({
  imports: [IdentityModule, DocumentsModule],
  controllers: [
    CaseAcademicRecordsController,
    AcademicRecordsController,
    CaseTestRecordsController,
    TestRecordsController,
    CaseCompetitionsController,
    CompetitionsController,
    CaseResearchProjectsController,
    ResearchProjectsController,
    CaseActivitiesController,
    ActivitiesController,
  ],
  providers: [AcademicRecordsService, TestRecordsService, CompetitionsService, ResearchProjectsService, ActivitiesService],
})
export class ProfileEvidenceModule {}
