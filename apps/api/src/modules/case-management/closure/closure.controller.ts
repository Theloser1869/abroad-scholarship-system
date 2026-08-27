import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { ClosureService } from './closure.service';
import { ConfirmHandoverDto } from './dto/confirm-handover.dto';
import { ConfirmLiquidationDto } from './dto/confirm-liquidation.dto';
import { ExecuteClosureDto } from './dto/execute-closure.dto';
import { RequestClosureDto } from './dto/request-closure.dto';

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014) — the unified
/// Closure/Liquidation surface. Replaces the deleted `PATCH /cases/:id/close` and the
/// COMPLETED/LIQUIDATED targets of `PATCH /contracts/:id/status` (see
/// `ContractsService.updateStatus`, which now redirects here once a Case is linked).
@Controller('cases/:id/closure')
export class ClosureController {
  constructor(private readonly closure: ClosureService) {}

  @Get()
  @RequirePermission('case-closure', 'view')
  @Audit('VIEW')
  async getStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.closure.getChecklist(requirePrincipal(principal), id);
  }

  @Post('request')
  @RequirePermission('case-closure', 'request')
  @Audit('CREATE')
  async request(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestClosureDto,
    @Req() req: Request,
  ) {
    req.auditMetadata = { event: 'CLOSURE_REQUESTED' };
    await this.closure.requestClosure(requirePrincipal(principal), id, dto);
    return { requested: true };
  }

  @Post('handover')
  @RequirePermission('case-closure', 'execute')
  @Audit('EDIT')
  async handover(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmHandoverDto,
    @Req() req: Request,
  ) {
    const actor = requirePrincipal(principal);
    req.auditMetadata = { event: 'CLOSURE_CHECKED', overrideUsed: actor.roleCode !== 'ADMIN_FINANCE' };
    await this.closure.confirmHandover(actor, id, dto);
    return { confirmed: true };
  }

  @Post('close')
  @RequirePermission('case-closure', 'execute')
  @Audit('ARCHIVE')
  async close(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteClosureDto,
    @Req() req: Request,
  ) {
    const actor = requirePrincipal(principal);
    const overrideUsed = actor.roleCode !== 'ADMIN_FINANCE';
    req.auditMetadata = { event: overrideUsed ? 'OVERRIDE_USED' : 'CLOSURE_COMPLETED', overrideUsed, overrideReason: dto.overrideReason };
    return this.closure.close(actor, id, dto);
  }

  @Post('liquidation/confirm-company')
  @RequirePermission('case-closure', 'execute')
  @Audit('APPROVE')
  async confirmLiquidationCompany(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmLiquidationDto,
    @Req() req: Request,
  ) {
    const actor = requirePrincipal(principal);
    const overrideUsed = actor.roleCode !== 'ADMIN_FINANCE';
    req.auditMetadata = { event: 'LIQUIDATION_COMPANY_CONFIRMED', overrideUsed, overrideReason: dto.overrideReason };
    return this.closure.confirmLiquidationCompany(actor, id, dto);
  }
}
