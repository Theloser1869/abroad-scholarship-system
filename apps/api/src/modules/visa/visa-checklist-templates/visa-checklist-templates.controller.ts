import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateVisaChecklistTemplateDto } from './dto/create-visa-checklist-template.dto';
import { UpdateVisaChecklistTemplateDto } from './dto/update-visa-checklist-template.dto';
import { VisaChecklistTemplateQueryDto } from './dto/visa-checklist-template-query.dto';
import { VisaChecklistTemplatesService } from './visa-checklist-templates.service';

@Controller('visa-checklist-templates')
export class VisaChecklistTemplatesController {
  constructor(private readonly service: VisaChecklistTemplatesService) {}

  @Get()
  @RequirePermission('visa_checklist_templates', 'view')
  async list(@Query() query: VisaChecklistTemplateQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermission('visa_checklist_templates', 'view')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermission('visa_checklist_templates', 'create')
  @Audit('CREATE')
  async create(@Body() dto: CreateVisaChecklistTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('visa_checklist_templates', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVisaChecklistTemplateDto) {
    return this.service.update(id, dto);
  }
}
