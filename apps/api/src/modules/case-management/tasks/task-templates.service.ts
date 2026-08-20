import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskTemplate } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';

/// Minimal template management — 06-operations/01_TASK.md "Task template phải có khả
/// năng được trigger bởi các workflow hiện có," scoped to what `TaskGenerationService`
/// actually needs. Not a full template-authoring UI backend, matching
/// `ContractTemplatesService`'s equivalent minimalism.
@Injectable()
export class TaskTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<TaskTemplate[]> {
    return this.prisma.taskTemplate.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async getById(id: string): Promise<TaskTemplate> {
    const template = await this.prisma.taskTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException({ code: 'TASK_TEMPLATE_NOT_FOUND', message: `Task template ${id} not found.` });
    return template;
  }

  async create(dto: CreateTaskTemplateDto): Promise<TaskTemplate> {
    if (dto.triggerEvent === 'CASE_STAGE_CHANGED' && !dto.triggerStageValue) {
      throw new ConflictException({
        code: 'TRIGGER_STAGE_VALUE_REQUIRED',
        message: 'triggerStageValue is required when triggerEvent is CASE_STAGE_CHANGED.',
      });
    }
    return this.prisma.taskTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        module: dto.module,
        taskType: dto.taskType,
        title: dto.title,
        priority: dto.priority,
        deadlineOffsetDays: dto.deadlineOffsetDays,
        triggerEvent: dto.triggerEvent,
        triggerStageValue: dto.triggerEvent === 'CASE_STAGE_CHANGED' ? dto.triggerStageValue : undefined,
      },
    });
  }
}
