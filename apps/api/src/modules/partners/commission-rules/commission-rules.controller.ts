import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CommissionRuleQueryDto } from './dto/commission-rule-query.dto';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';
import { CommissionRulesService } from './commission-rules.service';

@Controller('partners/:partnerId/commission-rules')
export class CommissionRulesNestedController {
  constructor(private readonly service: CommissionRulesService) {}

  @Get()
  @RequirePermission('commission_rules', 'view')
  async list(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Query() query: CommissionRuleQueryDto) {
    return this.service.listForPartner(partnerId, query);
  }

  @Post()
  @RequirePermission('commission_rules', 'create')
  @Audit('CREATE')
  async create(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Body() dto: CreateCommissionRuleDto) {
    return this.service.create(partnerId, dto);
  }
}

@Controller('commission-rules')
export class CommissionRulesController {
  constructor(private readonly service: CommissionRulesService) {}

  @Get(':id')
  @RequirePermission('commission_rules', 'view')
  @Audit('VIEW')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  @RequirePermission('commission_rules', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCommissionRuleDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/activate')
  @RequirePermission('commission_rules', 'edit')
  @Audit('EDIT')
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.activate(id);
  }

  @Post(':id/deactivate')
  @RequirePermission('commission_rules', 'edit')
  @Audit('EDIT')
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }
}
