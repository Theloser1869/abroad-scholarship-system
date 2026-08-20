import { IsIn } from 'class-validator';

/// Every OTHER transition besides SUBMITTED/APPOINTMENT/INTERVIEW (their own dedicated,
/// data-carrying actions) and GRANTED/REFUSED (their own dedicated `result` action).
const STATUSES = ['NOT_STARTED', 'PREPARING', 'READY', 'WITHDRAWN'] as const;

export class UpdateVisaStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
