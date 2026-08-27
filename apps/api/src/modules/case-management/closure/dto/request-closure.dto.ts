import { IsString, MaxLength, MinLength } from 'class-validator';

/// Client Acceptance Remediation DEC-06 — Consultant's "đề nghị Đóng hồ sơ" request. Kept
/// advisory (see the plan's Implementation Assumption #1) — recorded as an internal Comment
/// on the Case for HCTH's visibility, never a precondition `ClosureService.close()` checks.
export class RequestClosureDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
