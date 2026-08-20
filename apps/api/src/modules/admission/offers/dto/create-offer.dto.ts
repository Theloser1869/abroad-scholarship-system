import { IsBoolean, IsDateString, IsISO4217CurrencyCode, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from 'class-validator';

/// 08-admission/03_OFFER_SCHOLARSHIP.md Offer field list. `offerType` is free text
/// (Unconditional/Conditional/Deferred/...), same configurable-field precedent as
/// `WritingArtifact.type`.
export class CreateOfferDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  offerType!: string;

  @IsOptional()
  @IsDateString()
  offerDate?: string;

  @IsOptional()
  @IsDateString()
  acceptanceDeadline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  depositCurrency?: string;

  @IsOptional()
  @IsBoolean()
  isConditional?: boolean;

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
