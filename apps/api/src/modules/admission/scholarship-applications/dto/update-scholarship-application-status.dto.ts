import { IsIn } from 'class-validator';

/// Every OTHER transition besides AWARDED and REJECTED (their own dedicated `/award` and
/// `/reject` actions, since a real award carries required extra data).
const STATUSES = ['PLANNING', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW', 'WITHDRAWN'] as const;

export class UpdateScholarshipApplicationStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
