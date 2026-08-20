import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/// Every OTHER transition besides SUBMITTED (its own `/submit` action, precondition-
/// checked) and OFFER (reachable only via `POST /applications/:id/offers` — "Không được
/// chuyển Offer nếu chưa có offer record tương ứng", 08-admission/02_APPLICATION.md).
const STATUSES = ['PLANNING', 'PREPARING', 'READY_FOR_REVIEW', 'WAITLIST', 'REJECT', 'WITHDRAWN'] as const;

export class UpdateApplicationStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
