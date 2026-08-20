import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { CreatePreDepartureItemDto } from './dto/create-pre-departure-item.dto';
import { UpdatePreDepartureItemDto } from './dto/update-pre-departure-item.dto';
import { PreDepartureService } from './pre-departure.service';

@Controller('cases/:caseId/pre-departure')
export class CasePreDepartureController {
  constructor(private readonly service: PreDepartureService) {}

  @Get()
  @RequirePermission('pre_departure', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.service.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('pre_departure', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreatePreDepartureItemDto) {
    return this.service.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('pre-departure-items')
export class PreDepartureItemController {
  constructor(private readonly service: PreDepartureService) {}

  @Patch(':id')
  @RequirePermission('pre_departure', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePreDepartureItemDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }
}
