import { Controller, Get, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLogsService } from './audit-logs.service';

/// Restricted to roles holding `audit_logs:view` (seeded to EXECUTIVE_DIRECTOR and
/// SYSTEM_ADMIN only — SRS section 13 "Audit logs" row: everyone else is "Không"/"Theo
/// quyền quản trị"; see docs/security/RBAC_MATRIX.md for the conservative reading taken
/// for DEPARTMENT_MANAGER's ambiguous "theo quyền quản trị" grant). Viewing the audit log
/// is itself audited (`@Audit('VIEW')`) — GĐĐH does not bypass audit even for its own
/// admin actions (SRS section 3: "Không bỏ qua audit; vẫn ghi nhận mọi export/download").
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @RequirePermission('audit_logs', 'view')
  @Audit('VIEW')
  async list(@Query() query: AuditLogQueryDto) {
    return this.auditLogs.list(query);
  }
}
