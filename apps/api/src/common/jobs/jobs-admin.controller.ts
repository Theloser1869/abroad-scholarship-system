import { Controller, Get, Param, ParseUUIDPipe, Query, NotFoundException } from '@nestjs/common';
import { Audit } from '../audit/audit.interceptor';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { JobsService } from './jobs.service';

/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "Jobs: job status nếu exposed, admin
/// operation nếu được phép"). Read-only observability surface — no retry/cancel mutation
/// endpoint was added (the runner already retries automatically per job; a manual
/// override was not concretely requested by any MD). SYSTEM_ADMIN only, same
/// "Identity/audit administration only" domain boundary as `AuditLogsController`.
@Controller('admin/jobs')
export class JobsAdminController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @RequirePermission('jobs', 'view')
  async list(@Query('jobType') jobType?: string, @Query('status') status?: string) {
    return this.jobs.list(jobType, status);
  }

  @Get(':id')
  @RequirePermission('jobs', 'view')
  @Audit('VIEW')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.jobs.getById(id);
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: `Job ${id} not found.` });
    return job;
  }
}
