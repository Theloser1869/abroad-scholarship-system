import { Module } from '@nestjs/common';
import { VisaStatusService } from './visa-status.service';

@Module({
  providers: [VisaStatusService],
  exports: [VisaStatusService],
})
export class VisaStatusModule {}
