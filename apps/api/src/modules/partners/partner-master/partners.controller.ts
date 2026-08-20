import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { PartnerQueryDto } from './dto/partner-query.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnersService } from './partners.service';

/// `internalNotes` is field-level redacted from DOCUMENT_SPECIALIST
/// (`FieldPolicyService.redactPartner`) on every response — see docs/security/
/// RBAC_MATRIX.md section 5.
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly service: PartnersService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get()
  @RequirePermission('partner', 'view')
  async list(@CurrentUser() principal: Principal | null, @Query() query: PartnerQueryDto) {
    const actor = requirePrincipal(principal);
    const result = await this.service.list(query);
    return { ...result, data: result.data.map((p) => this.fieldPolicy.redactPartner(p, actor.roleCode)) };
  }

  @Get(':id')
  @RequirePermission('partner', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const partner = await this.service.getById(id);
    return this.fieldPolicy.redactPartner(partner, actor.roleCode);
  }

  @Post()
  @RequirePermission('partner', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Body() dto: CreatePartnerDto) {
    const actor = requirePrincipal(principal);
    const partner = await this.service.create(dto);
    return this.fieldPolicy.redactPartner(partner, actor.roleCode);
  }

  @Patch(':id')
  @RequirePermission('partner', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerDto) {
    const actor = requirePrincipal(principal);
    const partner = await this.service.update(id, dto);
    return this.fieldPolicy.redactPartner(partner, actor.roleCode);
  }

  @Post(':id/archive')
  @RequirePermission('partner', 'edit')
  @Audit('ARCHIVE')
  async archive(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const partner = await this.service.archive(id);
    return this.fieldPolicy.redactPartner(partner, actor.roleCode);
  }
}
