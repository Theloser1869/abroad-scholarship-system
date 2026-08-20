import { IsIn } from 'class-validator';

/// Deliberately a NARROWER set than the full `TaskStatus` enum — "task status transition
/// vẫn server-enforced" (reuses the exact same FSM as staff, via
/// `TasksService.portalUpdateStatus`) but a student may only ever request one of these two
/// targets; BLOCKED/CANCELLED/NOT_STARTED stay staff-only judgment calls.
const PORTAL_ALLOWED_STATUSES = ['IN_PROGRESS', 'DONE'] as const;

export class PortalUpdateTaskStatusDto {
  @IsIn(PORTAL_ALLOWED_STATUSES)
  status!: (typeof PORTAL_ALLOWED_STATUSES)[number];
}
