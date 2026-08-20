import { IsIn } from 'class-validator';

/// Only the post-approval forward moves — ACTIVE/COMPLETED/ARCHIVED. DRAFT/REVIEW/APPROVED
/// each have their own dedicated endpoint (submit/approve/reject) with its own
/// precondition, same "no bare status PATCH for a high-consequence transition" pattern as
/// Contract/Task.
const STATUSES = ['ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;

export class UpdateRoadmapStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
