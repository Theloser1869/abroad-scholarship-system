import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// 09-visa/02_PRE_DEPARTURE_ENROLLMENT.md — suggested categories (passport/visa/flight/
/// insurance/accommodation/airport transfer/orientation/emergency contact/tuition-deposit/
/// travel documents) are guidance, not a hard-coded enum — `category` is free text, same
/// configurable-field precedent as `Activity.category` (Phase 07).
export class CreatePreDepartureItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
