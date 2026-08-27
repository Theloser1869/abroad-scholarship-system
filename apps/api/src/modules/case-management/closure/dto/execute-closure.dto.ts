import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// Client Acceptance Remediation DEC-06 — the unified "Đóng hồ sơ" action. Standard path
/// (ADMIN_FINANCE/HCTH) needs only `closureReason`; EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER
/// exercising the audited exception path must also supply `overrideReason` — see DEC-06
/// "phải có authorized role, phải có reason, phải audit, không được là bypass âm thầm."
/// Every DEC-07 mandatory precondition still applies to both paths unchanged.
export class ExecuteClosureDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  closureReason!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  overrideReason?: string;
}
