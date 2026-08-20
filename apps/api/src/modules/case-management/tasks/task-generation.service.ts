import { Injectable } from '@nestjs/common';
import { Prisma, TaskTemplateTrigger } from '@prisma/client';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

interface GenerateForEventInput {
  triggerEvent: TaskTemplateTrigger;
  /// Only relevant for CASE_STAGE_CHANGED — the new `Case.stage` value, matched against
  /// each candidate template's `triggerStageValue`.
  stageValue?: string;
  sourceEntityType: string;
  sourceEntityId: string;
  ownerId: string;
  caseId: string | null;
}

/// 06-operations/01_TASK.md "Auto-generated tasks on: case creation, stage change, ...,
/// contract activation, ...". Exposed to other domains per
/// docs/architecture/DOMAIN_MAP.md domain 3's "TaskService (module khác có thể tạo task
/// template khi stage thay đổi)" — `crm` (Lead conversion) and `commercial` (Contract
/// activation) both call `generateForEvent` directly, cross-domain, matching the
/// dependency direction already declared in DOMAIN_MAP.md section 12
/// (crm/commercial → case-management).
@Injectable()
export class TaskGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  /// Idempotent: `Task`'s own `(templateId, sourceEntityType, sourceEntityId)` unique
  /// constraint is the actual guarantee (a retried event or duplicated queue message can
  /// never produce two tasks for the same (template, source) pair — 06-operations/
  /// 01_TASK.md "Nếu event/API bị retry, task generation phải idempotent"). The
  /// `findUnique` pre-check is only to avoid burning a `TASK-YYYY-NNNNN` business-ID
  /// sequence number on every retry in the common (non-racing) case; the `P2002` catch is
  /// the real safety net for the rare concurrent-retry race, swallowed silently since the
  /// desired end state (exactly one task) is already achieved by whichever call won.
  async generateForEvent(input: GenerateForEventInput): Promise<void> {
    const templates = await this.prisma.taskTemplate.findMany({
      where: {
        active: true,
        triggerEvent: input.triggerEvent,
        ...(input.triggerEvent === 'CASE_STAGE_CHANGED' ? { triggerStageValue: input.stageValue } : {}),
      },
    });

    for (const template of templates) {
      const existing = await this.prisma.task.findUnique({
        where: {
          templateId_sourceEntityType_sourceEntityId: {
            templateId: template.id,
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
          },
        },
      });
      if (existing) continue;

      const deadline = new Date(Date.now() + template.deadlineOffsetDays! * 24 * 60 * 60 * 1000);
      const taskCode = await this.idGenerator.nextYearlyCode('TASK');
      try {
        await this.prisma.task.create({
          data: {
            taskCode,
            caseId: input.caseId,
            module: template.module,
            taskType: template.taskType,
            title: template.title,
            ownerId: input.ownerId,
            priority: template.priority,
            deadline,
            templateId: template.id,
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) continue;
        throw err;
      }
    }
  }
}
