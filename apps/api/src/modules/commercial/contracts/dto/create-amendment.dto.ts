import { IsDateString, IsISO4217CurrencyCode, IsNumber, IsObject, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

/// 05-commercial rule #12 "Amendment phải giữ lịch sử version trước/sau" — only the
/// fields actually being changed need to be supplied; `ContractsService.createAmendment`
/// diffs against the contract's current values to build the `before`/`after` snapshot and
/// rejects a no-op amendment (nothing actually different).
export class CreateAmendmentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  servicePackage?: string;

  @IsOptional()
  @IsObject()
  mergeFieldValues?: Record<string, unknown>;
}
