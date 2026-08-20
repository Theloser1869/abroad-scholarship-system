import { Module } from '@nestjs/common';
import { CommissionRulesModule } from './commission-rules/commission-rules.module';
import { CommissionTransactionsModule } from './commission-transactions/commission-transactions.module';
import { PartnerDocumentsModule } from './partner-documents/partner-documents.module';
import { PartnerMasterModule } from './partner-master/partners.module';
import { PartnerProgramsModule } from './partner-programs/partner-programs.module';
import { PartnerStudentLinksModule } from './partner-student-links/partner-student-links.module';

/// 10-partners/01_PARTNER_CRM.md — docs/architecture/DOMAIN_MAP.md domain 8 (Partners),
/// the last foundation-slice domain (Partner/PartnerProgram/PartnerDocument schema-only
/// since Phase 02) to get its first real controller/service/workflow, the same
/// "schema waited, this phase builds it" pattern Phase 07 used for Documents and Phase 08
/// used for Admission.
@Module({
  imports: [
    PartnerMasterModule,
    PartnerProgramsModule,
    PartnerDocumentsModule,
    PartnerStudentLinksModule,
    CommissionRulesModule,
    CommissionTransactionsModule,
  ],
})
export class PartnersModule {}
