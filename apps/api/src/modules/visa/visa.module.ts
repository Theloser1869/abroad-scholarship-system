import { Module } from '@nestjs/common';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PreDepartureModule } from './pre-departure/pre-departure.module';
import { VisaChecklistTemplatesModule } from './visa-checklist-templates/visa-checklist-templates.module';
import { VisaStatusModule } from './visa-status/visa-status.module';
import { VisasModule } from './visas/visas.module';

/// Domain module boundary per docs/architecture/DOMAIN_MAP.md domain 6 (Visa): owns Visa,
/// VisaChecklistTemplate, VisaChecklistItem (both Visa- and PreDeparture-scoped),
/// Enrollment (09-visa/*.md, Phase 09). `VisaStatusModule` is also imported directly by
/// `case-management` (for Closure validation) — its own leaf module, not re-exported
/// through here, to keep that specific dependency edge minimal and explicit.
@Module({
  imports: [VisaChecklistTemplatesModule, VisasModule, PreDepartureModule, EnrollmentsModule, VisaStatusModule],
})
export class VisaModule {}
