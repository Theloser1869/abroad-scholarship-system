import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// `category` is free text/configurable — 07-profile/02_PROFILE_EVIDENCE.md "Không giới
/// hạn activity vào một loại cố định."
export class CreateActivityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  organization!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsNumber()
  hours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  impact?: string;

  /// Client Acceptance GAP-026 (2026-08-25) — sheet04 row13 "Awards" is only capturable via
  /// Competition/ResearchProject's own `award` field; an award earned purely through an
  /// extracurricular activity had no dedicated field, only free-text `impact`.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  award?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  verifierName?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
