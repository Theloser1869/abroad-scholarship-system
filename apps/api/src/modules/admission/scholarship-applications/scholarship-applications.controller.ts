import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { AwardScholarshipDto } from './dto/award-scholarship.dto';
import { ConfirmEligibilityDto } from './dto/confirm-eligibility.dto';
import { CreateScholarshipApplicationDto } from './dto/create-scholarship-application.dto';
import { UpdateScholarshipApplicationDto } from './dto/update-scholarship-application.dto';
import { UpdateScholarshipApplicationStatusDto } from './dto/update-scholarship-application-status.dto';
import { ScholarshipApplicationsService } from './scholarship-applications.service';

/// `internalNotes` is field-level redacted from STUDENT_PARENT
/// (`FieldPolicyService.redactScholarshipApplication`) on every response — see
/// docs/security/RBAC_MATRIX.md section 5.
@Controller('cases/:caseId/scholarship-applications')
export class CaseScholarshipApplicationsController {
  constructor(
    private readonly service: ScholarshipApplicationsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get()
  @RequirePermission('scholarship_applications', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    const actor = requirePrincipal(principal);
    const rows = await this.service.listForCase(actor, caseId);
    return rows.map((r) => this.fieldPolicy.redactScholarshipApplication(r, actor.roleCode));
  }

  @Post()
  @RequirePermission('scholarship_applications', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateScholarshipApplicationDto) {
    const actor = requirePrincipal(principal);
    const record = await this.service.create(actor, caseId, dto);
    return this.fieldPolicy.redactScholarshipApplication(record, actor.roleCode);
  }
}

@Controller('scholarship-applications')
export class ScholarshipApplicationsController {
  constructor(
    private readonly service: ScholarshipApplicationsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get(':id')
  @RequirePermission('scholarship_applications', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const record = await this.service.getById(actor, id);
    return this.fieldPolicy.redactScholarshipApplication(record, actor.roleCode);
  }

  @Patch(':id')
  @RequirePermission('scholarship_applications', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScholarshipApplicationDto) {
    const actor = requirePrincipal(principal);
    const record = await this.service.update(actor, id, dto);
    return this.fieldPolicy.redactScholarshipApplication(record, actor.roleCode);
  }

  @Post(':id/confirm-eligibility')
  @RequirePermission('scholarship_applications', 'edit')
  @Audit('EDIT')
  async confirmEligibility(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmEligibilityDto) {
    const actor = requirePrincipal(principal);
    const record = await this.service.confirmEligibility(actor, id, dto);
    return this.fieldPolicy.redactScholarshipApplication(record, actor.roleCode);
  }

  @Patch(':id/status')
  @RequirePermission('scholarship_applications', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScholarshipApplicationStatusDto) {
    const actor = requirePrincipal(principal);
    const record = await this.service.updateStatus(actor, id, dto);
    return this.fieldPolicy.redactScholarshipApplication(record, actor.roleCode);
  }

  @Post(':id/award')
  @RequirePermission('scholarship_applications', 'edit')
  @Audit('EDIT')
  async award(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AwardScholarshipDto) {
    const actor = requirePrincipal(principal);
    const record = await this.service.award(actor, id, dto);
    return this.fieldPolicy.redactScholarshipApplication(record, actor.roleCode);
  }

  @Post(':id/reject')
  @RequirePermission('scholarship_applications', 'edit')
  @Audit('EDIT')
  async reject(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const record = await this.service.reject(actor, id);
    return this.fieldPolicy.redactScholarshipApplication(record, actor.roleCode);
  }
}
