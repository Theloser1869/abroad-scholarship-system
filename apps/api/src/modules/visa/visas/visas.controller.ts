import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { CreateVisaDto } from './dto/create-visa.dto';
import { RecordInterviewDto } from './dto/record-interview.dto';
import { RecordVisaResultDto } from './dto/record-visa-result.dto';
import { ScheduleAppointmentDto } from './dto/schedule-appointment.dto';
import { SubmitVisaDto } from './dto/submit-visa.dto';
import { UpdateVisaDto } from './dto/update-visa.dto';
import { UpdateVisaStatusDto } from './dto/update-visa-status.dto';
import { VisaQueryDto } from './dto/visa-query.dto';
import { VisasService } from './visas.service';

/// `internalNotes` is field-level redacted from STUDENT_PARENT
/// (`FieldPolicyService.redactVisa`) on every response — see docs/security/
/// RBAC_MATRIX.md section 5.
@Controller('cases/:caseId/visas')
export class CaseVisasController {
  constructor(
    private readonly service: VisasService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get()
  @RequirePermission('visa', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Query() query: VisaQueryDto) {
    const actor = requirePrincipal(principal);
    const result = await this.service.listForCase(actor, caseId, query);
    return { ...result, data: result.data.map((v) => this.fieldPolicy.redactVisa(v, actor.roleCode)) };
  }

  @Post()
  @RequirePermission('visa', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateVisaDto) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.create(actor, caseId, dto);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }
}

@Controller('visas')
export class VisasController {
  constructor(
    private readonly service: VisasService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get(':id')
  @RequirePermission('visa', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.getById(actor, id);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }

  @Patch(':id')
  @RequirePermission('visa', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVisaDto) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.update(actor, id, dto);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }

  @Patch(':id/status')
  @RequirePermission('visa', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVisaStatusDto) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.updateStatus(actor, id, dto);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }

  @Post(':id/submit')
  @RequirePermission('visa', 'edit')
  @Audit('EDIT')
  async submit(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitVisaDto) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.submit(actor, id, dto);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }

  @Post(':id/appointment')
  @RequirePermission('visa', 'edit')
  @Audit('EDIT')
  async scheduleAppointment(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleAppointmentDto) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.scheduleAppointment(actor, id, dto);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }

  @Post(':id/interview')
  @RequirePermission('visa', 'edit')
  @Audit('EDIT')
  async recordInterview(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordInterviewDto) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.recordInterview(actor, id, dto);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }

  @Post(':id/result')
  @RequirePermission('visa', 'edit')
  @Audit('EDIT')
  async recordResult(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordVisaResultDto) {
    const actor = requirePrincipal(principal);
    const visa = await this.service.recordResult(actor, id, dto);
    return this.fieldPolicy.redactVisa(visa, actor.roleCode);
  }
}
