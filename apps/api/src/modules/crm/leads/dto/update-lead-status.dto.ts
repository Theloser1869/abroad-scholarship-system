import { IsIn } from 'class-validator';

/// CONVERTED is deliberately excluded — only `POST /leads/:id/convert` may set it (SRS
/// section 9: "Converted chỉ khi tạo được Contract/Student hợp lệ").
const MANUAL_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONSULTATION', 'CONTRACTING', 'LOST'] as const;

export class UpdateLeadStatusDto {
  @IsIn(MANUAL_LEAD_STATUSES)
  status!: (typeof MANUAL_LEAD_STATUSES)[number];
}
