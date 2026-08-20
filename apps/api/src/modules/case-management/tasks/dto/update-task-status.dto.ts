import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;

/// 06-operations/01_TASK.md "task Blocked phải thể hiện blocker hợp lý" — `blocker` is
/// accepted here (not only via the generic edit endpoint) so a client can set status and
/// reason in one atomic call; `TasksService.updateStatus` requires a non-empty blocker
/// (either freshly supplied here or already on the record) whenever the target status is
/// BLOCKED.
export class UpdateTaskStatusDto {
  @IsIn(TASK_STATUSES)
  status!: (typeof TASK_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  blocker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  output?: string;

  /// Set on completion (target status DONE). 0–100, matching `Task.qualityScore`'s
  /// existing schema type (`Int?`) with a sane bound (nothing in SRS 6.18 specifies the
  /// scale — 0–100 is the least-surprising default for a "quality score").
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  qualityScore?: number;
}
