import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { OffersService } from './offers.service';

@Controller('applications/:applicationId/offers')
export class ApplicationOffersController {
  constructor(private readonly service: OffersService) {}

  @Get()
  @RequirePermission('offers', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.service.listForApplication(requirePrincipal(principal), applicationId);
  }

  @Get('current')
  @RequirePermission('offers', 'view')
  async current(@CurrentUser() principal: Principal | null, @Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.service.getCurrent(requirePrincipal(principal), applicationId);
  }

  @Post()
  @RequirePermission('offers', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('applicationId', ParseUUIDPipe) applicationId: string, @Body() dto: CreateOfferDto) {
    return this.service.create(requirePrincipal(principal), applicationId, dto);
  }
}

@Controller('offers')
export class OffersController {
  constructor(private readonly service: OffersService) {}

  @Get(':id')
  @RequirePermission('offers', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Post(':id/respond')
  @RequirePermission('offers', 'edit')
  @Audit('EDIT')
  async respond(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondOfferDto) {
    return this.service.respond(requirePrincipal(principal), id, dto);
  }
}
