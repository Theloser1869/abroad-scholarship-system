import { IsDateString, IsISO4217CurrencyCode, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

/// SCHOLARSHIP RESULT (08-admission/03_OFFER_SCHOLARSHIP.md) — award must record amount,
/// currency, coverage, period, acceptance deadline, evidence. Deliberately never linked to
/// Contract/Payment/Commission ("Không trộn: scholarship amount / student contract fee /
/// tuition payment / partner commission").
export class AwardScholarshipDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  awardAmount?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  awardCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  awardCoverageType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  awardPeriod?: string;

  @IsOptional()
  @IsDateString()
  awardAcceptanceDeadline?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
