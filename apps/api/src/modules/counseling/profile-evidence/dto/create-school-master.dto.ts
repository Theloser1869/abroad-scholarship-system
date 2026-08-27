import { IsString, MaxLength, MinLength } from 'class-validator';

/// Client Acceptance Remediation DEC-05(b) (2026-08-27) — minimal, staff-curated school list.
export class CreateSchoolMasterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}
