import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreatePartnerProgramDto } from './dto/create-partner-program.dto';
import { PartnerProgramQueryDto } from './dto/partner-program-query.dto';
import { UpdatePartnerProgramDto } from './dto/update-partner-program.dto';
import { PartnerProgramsService } from './partner-programs.service';

@Controller('partners/:partnerId/programs')
export class PartnerProgramsNestedController {
  constructor(private readonly service: PartnerProgramsService) {}

  @Get()
  @RequirePermission('partner_programs', 'view')
  async list(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Query() query: PartnerProgramQueryDto) {
    return this.service.listForPartner(partnerId, query);
  }

  @Post()
  @RequirePermission('partner_programs', 'create')
  @Audit('CREATE')
  async create(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Body() dto: CreatePartnerProgramDto) {
    return this.service.create(partnerId, dto);
  }
}

@Controller('partner-programs')
export class PartnerProgramsController {
  constructor(private readonly service: PartnerProgramsService) {}

  @Get(':id')
  @RequirePermission('partner_programs', 'view')
  @Audit('VIEW')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  @RequirePermission('partner_programs', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerProgramDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/archive')
  @RequirePermission('partner_programs', 'edit')
  @Audit('ARCHIVE')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }
}
