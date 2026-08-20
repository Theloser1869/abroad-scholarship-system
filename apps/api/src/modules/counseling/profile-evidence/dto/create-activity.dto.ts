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

  @IsOptional()
  @IsString()
  @MaxLength(255)
  verifierName?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
