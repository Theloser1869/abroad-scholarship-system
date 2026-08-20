import { Module } from '@nestjs/common';
import { LeadsModule } from './leads/leads.module';

/// Domain module boundary per docs/architecture/DOMAIN_MAP.md domain 2 (CRM): owns Lead.
@Module({
  imports: [LeadsModule],
})
export class CrmModule {}
