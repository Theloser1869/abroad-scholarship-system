import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

/// First slice of docs/architecture/DOMAIN_MAP.md domain 11 (Reporting) — read-only,
/// owns no tables of its own (reads AuditLog, which `identity` owns for writes).
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
