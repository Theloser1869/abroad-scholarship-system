import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Idempotent } from '../../../common/idempotency/idempotency.interceptor';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { ApproveContractDto } from './dto/approve-contract.dto';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateAmendmentDto } from './dto/create-amendment.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { ExportContractsQueryDto } from './dto/export-contracts-query.dto';
import { RejectContractDto } from './dto/reject-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';
import { ContractsService } from './contracts.service';

/// 05-commercial/01_CONTRACT.md reference implementation. Every state transition its own
/// method with its own precondition (never a bare status PATCH — "Không cho phép chuyển
/// trạng thái bằng cách gửi request tùy ý"), every mutation audited, every read/write
/// scope-checked via `ScopePolicyService.contractScopeKindFor` and field-redacted via
/// `FieldPolicyService.redactContract` — see docs/security/RBAC_MATRIX.md.
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get('export')
  @RequirePermission('contracts', 'export')
  @Audit('EXPORT')
  async export(@CurrentUser() principal: Principal | null, @Query() query: ExportContractsQueryDto, @Req() req: Request) {
    const actor = requirePrincipal(principal);
    const { rows, rowCount } = await this.contracts.export(actor);
    const redacted = rows.map((row) => this.fieldPolicy.redactContract(row, actor.roleCode));
    const fields = redacted.length > 0 ? Object.keys(redacted[0]) : [];
    req.auditMetadata = { reason: query.reason, filterScope: 'scope-filtered list (see ScopePolicyService)', rowCount, fields };
    return { rows: redacted, rowCount };
  }

  @Get()
  @RequirePermission('contracts', 'view')
  async list(@CurrentUser() principal: Principal | null, @Query() query: ContractQueryDto) {
    const actor = requirePrincipal(principal);
    const result = await this.contracts.list(actor, query);
    return { data: result.data.map((row) => this.fieldPolicy.redactContract(row, actor.roleCode)), meta: result.meta };
  }

  @Get(':id')
  @RequirePermission('contracts', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const contract = await this.contracts.getById(actor, id);
    return this.fieldPolicy.redactContract(contract, actor.roleCode);
  }

  @Post()
  @RequirePermission('contracts', 'create')
  @Audit('CREATE')
  @Idempotent()
  async create(@CurrentUser() principal: Principal | null, @Body() dto: CreateContractDto) {
    const actor = requirePrincipal(principal);
    const contract = await this.contracts.create(dto);
    return this.fieldPolicy.redactContract(contract, actor.roleCode);
  }

  @Patch(':id')
  @RequirePermission('contracts', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id); // scope check before writing
    const contract = await this.contracts.update(id, dto);
    return this.fieldPolicy.redactContract(contract, actor.roleCode);
  }

  @Post(':id/submit')
  @RequirePermission('contracts', 'edit')
  @Audit('EDIT')
  async submit(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id);
    return this.contracts.submit(id);
  }

  @Post(':id/approve')
  @RequirePermission('contracts', 'approve')
  @Audit('APPROVE')
  async approve(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveContractDto) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id);
    return this.contracts.approve(actor, id, dto);
  }

  @Post(':id/reject')
  @RequirePermission('contracts', 'approve')
  @Audit('APPROVE')
  async reject(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectContractDto) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id);
    return this.contracts.reject(actor, id, dto);
  }

  @Post(':id/send')
  @RequirePermission('contracts', 'send')
  @Audit('SHARE')
  async send(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id);
    const result = await this.contracts.send(id);
    // Same "returned once, only the hash is ever stored" pattern as password-reset —
    // the raw review token is only in this response, never logged or persisted.
    return { contract: this.fieldPolicy.redactContract(result.contract, actor.roleCode), reviewToken: result.reviewToken, reviewExpiresAt: result.reviewExpiresAt };
  }

  @Post(':id/sign')
  @RequirePermission('contracts', 'sign')
  @Audit('EDIT')
  async sign(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SignContractDto) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id);
    const contract = await this.contracts.sign(id, dto);
    return this.fieldPolicy.redactContract(contract, actor.roleCode);
  }

  @Patch(':id/status')
  @RequirePermission('contracts', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractStatusDto) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id);
    const contract = await this.contracts.updateStatus(id, dto.status);
    return this.fieldPolicy.redactContract(contract, actor.roleCode);
  }

  @Get(':id/amendments')
  @RequirePermission('contracts', 'view')
  async listAmendments(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.listAmendments(requirePrincipal(principal), id);
  }

  @Post(':id/amendments')
  @RequirePermission('contracts', 'amend')
  @Audit('EDIT')
  async createAmendment(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAmendmentDto) {
    const actor = requirePrincipal(principal);
    await this.contracts.getById(actor, id);
    return this.contracts.createAmendment(actor, id, dto);
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
