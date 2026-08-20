import { IsIn } from 'class-validator';

const STATUSES = ['DRAFT', 'REVIEW', 'REVISION', 'FINAL', 'SUBMITTED'] as const;

export class UpdateWritingStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
