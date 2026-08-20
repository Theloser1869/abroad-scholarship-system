import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { ContractTemplatesService } from './contract-templates.service';

/// Same `contracts:*` permission family as ContractsController — templates are a
/// sub-resource of the Contract domain, not their own RBAC surface (a role that can
/// create Contracts can create the templates it drafts them from).
@Controller('contract-templates')
export class ContractTemplatesController {
  constructor(private readonly templates: ContractTemplatesService) {}

  @Get()
  @RequirePermission('contracts', 'view')
  async listActive() {
    return this.templates.listActive();
  }

  @Get(':id')
  @RequirePermission('contracts', 'view')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.getById(id);
  }

  @Post()
  @RequirePermission('contracts', 'create')
  @Audit('CREATE')
  async create(@Body() dto: CreateContractTemplateDto) {
    return this.templates.create(dto);
  }
}
