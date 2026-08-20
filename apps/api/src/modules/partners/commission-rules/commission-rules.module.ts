import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { CommissionRulesNestedController, CommissionRulesController } from './commission-rules.controller';
import { CommissionRulesService } from './commission-rules.service';

@Module({
  imports: [IdentityModule],
  controllers: [CommissionRulesNestedController, CommissionRulesController],
  providers: [CommissionRulesService],
  exports: [CommissionRulesService],
})
export class CommissionRulesModule {}
