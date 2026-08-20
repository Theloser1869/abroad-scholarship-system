import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { ExportReportQueryDto } from './dto/export-report-query.dto';
import { ReportsService } from './reports.service';

/// 12-platform/03_REPORTING.md. Every route requires the base `reports:view` (or
/// `reports:export`) permission grant, gating who may reach the reporting surface at all;
/// `executive`/`manager` additionally narrow to EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER
/// inside `ReportsService` itself (same layered pattern as `TasksController.
/// runReminders`). Student/Parent reporting is intentionally NOT here — Phase 11's Portal
/// (`/portal/students/:id/{roadmap,tasks,applications,scholarships,visa,documents,...}`)
/// already satisfies every field 11-portal/../03_REPORTING.md's Student section names
/// (roadmap progress/deadlines/application/scholarship/visa progress/document status/own
/// task), with the exact same field-redaction this module reuses everywhere else — no
/// second reporting surface was built for it. See `docs/ASSUMPTIONS.md` ASM-55.
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('executive')
  @RequirePermission('reports', 'view')
  async executive(@CurrentUser() principal: Principal | null) {
    return this.reports.executiveDashboard(requirePrincipal(principal));
  }

  @Get('manager')
  @RequirePermission('reports', 'view')
  async manager(@CurrentUser() principal: Principal | null) {
    return this.reports.managerDashboard(requirePrincipal(principal));
  }

  @Get('me')
  @RequirePermission('reports', 'view')
  async me(@CurrentUser() principal: Principal | null) {
    return this.reports.myDashboard(requirePrincipal(principal));
  }

  /// "Export phải: được authorize, filter theo scope, audit, giới hạn fields, log actor,
  /// log reason." Same `students.export`-style audit-metadata pattern (SRS 6.21).
  @Get('cases/export')
  @RequirePermission('reports', 'export')
  @Audit('EXPORT')
  async exportCases(@CurrentUser() principal: Principal | null, @Query() query: ExportReportQueryDto, @Req() req: Request) {
    const actor = requirePrincipal(principal);
    const { rows, rowCount } = await this.reports.exportCases(actor);
    const fields = rows.length > 0 ? Object.keys(rows[0] as object) : [];
    req.auditMetadata = { reason: query.reason, filterScope: 'scope-filtered list (see ScopePolicyService)', rowCount, fields };
    return { rows, rowCount };
  }
}
