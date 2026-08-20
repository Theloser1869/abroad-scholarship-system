import { Inject, Module, OnModuleInit } from '@nestjs/common';
import {
  EXTERNAL_SCHOOL_DATA_PROVIDER,
  ExternalSchoolDataProvider,
} from '../../../common/integrations/external-school-data-provider.interface';
import { JobRunnerService } from '../../../common/jobs/job-runner.service';
import { IdentityModule } from '../../identity/identity.module';
import { ProgramsController, ScholarshipMastersController, UniversitiesController } from './master-data.controller';
import { ProgramsService } from './programs.service';
import { ScholarshipMastersService } from './scholarship-masters.service';
import { UniversitiesService } from './universities.service';

export const EXTERNAL_DATA_SYNC_JOB_TYPE = 'EXTERNAL_DATA_SYNC';

@Module({
  imports: [IdentityModule],
  controllers: [UniversitiesController, ProgramsController, ScholarshipMastersController],
  providers: [UniversitiesService, ProgramsService, ScholarshipMastersService],
  exports: [UniversitiesService, ProgramsService, ScholarshipMastersService],
})
export class MasterDataModule implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly universities: UniversitiesService,
    @Inject(EXTERNAL_SCHOOL_DATA_PROVIDER) private readonly externalData: ExternalSchoolDataProvider,
  ) {}

  /// Phase 12 — enqueued daily by `SchedulerService.tick`. Uses whichever
  /// `ExternalSchoolDataProvider` is bound (the default `NoopExternalSchoolDataProvider`
  /// returns no records, so this is a no-op in practice today — see
  /// `docs/ASSUMPTIONS.md` ASM-51).
  onModuleInit(): void {
    this.runner.registerProcessor(EXTERNAL_DATA_SYNC_JOB_TYPE, async () => {
      const records = await this.externalData.fetchUniversities();
      if (records.length > 0) await this.universities.syncExternal(records);
    });
  }
}
