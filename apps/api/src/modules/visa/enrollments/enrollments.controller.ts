import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { ConfirmEnrollmentDto } from './dto/confirm-enrollment.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { EnrollmentsService } from './enrollments.service';

/// `internalNotes` is field-level redacted from STUDENT_PARENT
/// (`FieldPolicyService.redactEnrollment`) on every response.
@Controller('cases/:caseId/enrollments')
export class CaseEnrollmentsController {
  constructor(
    private readonly service: EnrollmentsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get()
  @RequirePermission('enrollment', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    const actor = requirePrincipal(principal);
    const rows = await this.service.listForCase(actor, caseId);
    return rows.map((r) => this.fieldPolicy.redactEnrollment(r, actor.roleCode));
  }

  @Post()
  @RequirePermission('enrollment', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateEnrollmentDto) {
    const actor = requirePrincipal(principal);
    const enrollment = await this.service.create(actor, caseId, dto);
    return this.fieldPolicy.redactEnrollment(enrollment, actor.roleCode);
  }
}

@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly service: EnrollmentsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get(':id')
  @RequirePermission('enrollment', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const enrollment = await this.service.getById(actor, id);
    return this.fieldPolicy.redactEnrollment(enrollment, actor.roleCode);
  }

  @Patch(':id')
  @RequirePermission('enrollment', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEnrollmentDto) {
    const actor = requirePrincipal(principal);
    const enrollment = await this.service.update(actor, id, dto);
    return this.fieldPolicy.redactEnrollment(enrollment, actor.roleCode);
  }

  @Post(':id/confirm')
  @RequirePermission('enrollment', 'edit')
  @Audit('EDIT')
  async confirm(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmEnrollmentDto) {
    const actor = requirePrincipal(principal);
    const enrollment = await this.service.confirm(actor, id, dto);
    return this.fieldPolicy.redactEnrollment(enrollment, actor.roleCode);
  }

  @Post(':id/withdraw')
  @RequirePermission('enrollment', 'edit')
  @Audit('EDIT')
  async withdraw(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const enrollment = await this.service.withdraw(actor, id);
    return this.fieldPolicy.redactEnrollment(enrollment, actor.roleCode);
  }
}
