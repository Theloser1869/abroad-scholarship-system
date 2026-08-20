import { IsString, MaxLength, MinLength } from 'class-validator';

/// SRS section 9: "Closed phải có closure reason và checklist bắt buộc." No dedicated
/// checklist entity exists yet (see docs/database/DATA_DICTIONARY.md section 5) — the
/// closure reason is enforced here; the "checklist" half is approximated by
/// CasesService.close()'s open-task guard (see its doc comment) until a real checklist
/// entity exists (Phase 08/09).
export class CloseCaseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  closureReason!: string;
}
