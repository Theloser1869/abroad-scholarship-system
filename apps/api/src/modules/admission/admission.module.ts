import { Module } from '@nestjs/common';
import { ApplicationsModule } from './applications/applications.module';
import { MasterDataModule } from './master-data/master-data.module';
import { OffersModule } from './offers/offers.module';
import { ScholarshipApplicationsModule } from './scholarship-applications/scholarship-applications.module';
import { UniversityChoicesModule } from './university-choices/university-choices.module';

/// Domain module boundary per docs/architecture/DOMAIN_MAP.md domain 5 (Admission): owns
/// University, Program, ScholarshipMaster, UniversityChoice, Application,
/// ApplicationChecklist, Offer, ScholarshipApplication (08-admission/*.md, Phase 08).
@Module({
  imports: [MasterDataModule, UniversityChoicesModule, ApplicationsModule, OffersModule, ScholarshipApplicationsModule],
})
export class AdmissionModule {}
