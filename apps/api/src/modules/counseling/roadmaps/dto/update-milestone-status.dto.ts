import { IsIn } from 'class-validator';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;

export class UpdateMilestoneStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
