import { Module } from '@nestjs/common';
import { ContractsModule } from './contracts/contracts.module';
import { PaymentsModule } from './payments/payments.module';

/// Domain module boundary per docs/architecture/DOMAIN_MAP.md domain 5 (Commercial): owns
/// Contract, ContractTemplate, ContractAmendment, ContractReviewLink, Payment
/// (05-commercial/01_CONTRACT.md, 02_PAYMENT.md). `contracts` and `payments` are separate
/// sub-modules (mirroring `case-management`'s `students`/`cases` split) because they have
/// distinct route surfaces and distinct RBAC scope maps, even though Payment always hangs
/// off a Contract.
@Module({
  imports: [ContractsModule, PaymentsModule],
})
export class CommercialModule {}
