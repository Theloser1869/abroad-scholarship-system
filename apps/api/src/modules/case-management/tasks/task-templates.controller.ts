import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { TaskTemplatesService } from './task-templates.service';

/// Same `tasks:*` permission family as TasksController — templates are a sub-resource of
/// the Task domain, not their own RBAC surface (same reasoning as
/// `ContractTemplatesController`).
@Controller('task-templates')
export class TaskTemplatesController {
  constructor(private readonly templates: TaskTemplatesService) {}

  @Get()
  @RequirePermission('tasks', 'view')
  async listActive() {
    return this.templates.listActive();
  }

  @Get(':id')
  @RequirePermission('tasks', 'view')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.getById(id);
  }

  @Post()
  @RequirePermission('tasks', 'create')
  @Audit('CREATE')
  async create(@Body() dto: CreateTaskTemplateDto) {
    return this.templates.create(dto);
  }
}
