import { IsIn, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

const TRIGGER_EVENTS = [
  'CASE_CREATED',
  'CASE_STAGE_CHANGED',
  'CONTRACT_ACTIVATED',
  'ROADMAP_APPROVED',
  'APPLICATION_SUBMITTED',
  'SCHOLARSHIP_AWARDED',
  'VISA_GRANTED',
] as const;

/// 06-operations/01_TASK.md "Task template phải có khả năng được trigger bởi các
/// workflow hiện có." `deadlineOffsetDays` is required (not optional) — every
/// auto-generation source must produce a task with a concrete deadline (`Task.deadline`
/// is non-nullable), so an unconfigured offset is a template-authoring error, not a
/// runtime default to silently paper over.
export class CreateTaskTemplateDto {
  @IsString()
  @MaxLength(100)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(100)
  module!: string;

  @IsString()
  @MaxLength(100)
  taskType!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string;

  @IsInt()
  @Min(0)
  deadlineOffsetDays!: number;

  @IsIn(TRIGGER_EVENTS)
  triggerEvent!: (typeof TRIGGER_EVENTS)[number];

  /// Required when triggerEvent = CASE_STAGE_CHANGED (validated in
  /// `TaskTemplatesService.create`, not here — cross-field rule, class-validator's
  /// per-field decorators can't express "required if sibling field equals X" cleanly).
  @IsOptional()
  @IsString()
  @MaxLength(100)
  triggerStageValue?: string;
}
