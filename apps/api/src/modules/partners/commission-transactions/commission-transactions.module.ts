import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { CommissionRulesModule } from '../commission-rules/commission-rules.module';
import { CommissionTransactionsNestedController, CommissionTransactionsController } from './commission-transactions.controller';
import { CommissionTransactionsService } from './commission-transactions.service';

@Module({
  imports: [IdentityModule, CommissionRulesModule],
  controllers: [CommissionTransactionsNestedController, CommissionTransactionsController],
  providers: [CommissionTransactionsService],
  exports: [CommissionTransactionsService],
})
export class CommissionTransactionsModule {}
