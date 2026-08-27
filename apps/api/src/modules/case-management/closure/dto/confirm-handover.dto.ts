import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// Client Acceptance Remediation DEC-07 — "Tài liệu bàn giao" (document handover), the
/// mandatory closure precondition previously unchecked by either old closure path.
export class ConfirmHandoverDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /// Required only when the caller is EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER acting as an
  /// exception — see DEC-06 "phải có reason, phải audit, không được là bypass âm thầm".
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  overrideReason?: string;
}
