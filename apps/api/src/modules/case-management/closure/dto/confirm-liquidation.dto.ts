import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// Client Acceptance Remediation DEC-08 — the company side of the two-party liquidation
/// confirmation. `overrideReason` is required only for the EXECUTIVE_DIRECTOR/
/// DEPARTMENT_MANAGER exception path (see `ExecuteClosureDto`'s doc comment).
export class ConfirmLiquidationDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  overrideReason?: string;
}
