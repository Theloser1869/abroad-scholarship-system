import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/// SRS 6.5 "Roadmap chỉ được approve khi assessment baseline tồn tại" — `assessmentId` may
/// be set at creation (most common) or added later while still DRAFT, but is required
/// before `approve()` will succeed (checked there, not here, since a Roadmap may
/// legitimately start before its baseline Assessment is finished).
export class CreateRoadmapDto {
  @IsOptional()
  @IsUUID()
  assessmentId?: string;

  /// "Roadmap hỗ trợ horizon 1–3 năm."
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  horizonYears?: number;
}
