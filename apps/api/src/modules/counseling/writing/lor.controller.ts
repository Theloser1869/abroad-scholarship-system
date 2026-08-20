import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { CreateLorDto } from './dto/create-lor.dto';
import { UpdateLorDto } from './dto/update-lor.dto';
import { LorService } from './lor.service';

@Controller('cases/:caseId/letters-of-recommendation')
export class CaseLorController {
  constructor(
    private readonly lor: LorService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get()
  @RequirePermission('writing', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    const actor = requirePrincipal(principal);
    const rows = await this.lor.listForCase(actor, caseId);
    return rows.map((r) => this.fieldPolicy.redactLor(r, actor.roleCode));
  }

  @Post()
  @RequirePermission('writing', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateLorDto) {
    const actor = requirePrincipal(principal);
    const lor = await this.lor.create(actor, caseId, dto);
    return this.fieldPolicy.redactLor(lor, actor.roleCode);
  }
}

@Controller('letters-of-recommendation')
export class LorController {
  constructor(
    private readonly lor: LorService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get(':id')
  @RequirePermission('writing', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const lor = await this.lor.getById(actor, id);
    return this.fieldPolicy.redactLor(lor, actor.roleCode);
  }

  @Patch(':id')
  @RequirePermission('writing', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLorDto) {
    const actor = requirePrincipal(principal);
    const lor = await this.lor.update(actor, id, dto);
    return this.fieldPolicy.redactLor(lor, actor.roleCode);
  }
}
