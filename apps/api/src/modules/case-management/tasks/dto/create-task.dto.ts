import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// 06-operations/01_TASK.md field list. `caseId` comes from the route param on the
/// nested `POST /cases/:caseId/tasks`, not this body — see `case-tasks.controller.ts`.
/// Deadline is required (schema: `Task.deadline` is not nullable) — a task with no
/// deadline can't be checked for overdue, and 01_TASK.md lists `deadline` as a core field.
export class CreateTaskDto {
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
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsDateString()
  deadline!: string;
}
