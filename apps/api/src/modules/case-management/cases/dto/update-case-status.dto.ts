import { IsIn } from 'class-validator';

/// CLOSED excluded deliberately — only `PATCH /cases/:id/close` may set it (requires a
/// closure reason + passes the open-task check, SRS section 9).
const MANUAL_CASE_STATUSES = ['OPEN', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;

export class UpdateCaseStatusDto {
  @IsIn(MANUAL_CASE_STATUSES)
  status!: (typeof MANUAL_CASE_STATUSES)[number];
}
