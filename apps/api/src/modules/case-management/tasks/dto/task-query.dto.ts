import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;

export class TaskQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  /// "My Tasks" shorthand — equivalent to passing `ownerId` = the caller's own id, without
  /// the client needing to already know it.
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  mine?: boolean;

  /// Computed, not stored (see `TasksService.isOverdue`) — same "one shared function, both
  /// the filter and the response field read it" pattern as `PaymentQueryDto.overdue`.
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  overdue?: boolean;

  /// Calendar view range (06-operations/01_TASK.md "Build: ... Calendar" — an API
  /// capability a calendar UI would call, see docs/ASSUMPTIONS.md ASM-08 precedent).
  @IsOptional()
  @IsDateString()
  deadlineFrom?: string;

  @IsOptional()
  @IsDateString()
  deadlineTo?: string;
}
