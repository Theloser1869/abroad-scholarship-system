import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { CreateVisaChecklistItemDto } from './dto/create-visa-checklist-item.dto';
import { UpdateVisaChecklistItemDto } from './dto/update-visa-checklist-item.dto';
import { VisaChecklistService } from './visa-checklist.service';

@Controller('visas/:visaId/checklist')
export class VisaChecklistItemsController {
  constructor(private readonly service: VisaChecklistService) {}

  @Get()
  @RequirePermission('visa', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('visaId', ParseUUIDPipe) visaId: string) {
    return this.service.listForVisa(requirePrincipal(principal), visaId);
  }

  @Post()
  @RequirePermission('visa', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('visaId', ParseUUIDPipe) visaId: string, @Body() dto: CreateVisaChecklistItemDto) {
    return this.service.create(requirePrincipal(principal), visaId, dto);
  }
}

@Controller('visa-checklist-items')
export class VisaChecklistItemController {
  constructor(private readonly service: VisaChecklistService) {}

  @Patch(':id')
  @RequirePermission('visa', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVisaChecklistItemDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }
}
