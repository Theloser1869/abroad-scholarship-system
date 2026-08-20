import { IsBoolean, IsISO31661Alpha2, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// 09-visa/01_VISA.md "Checklist configurable by country + visa type" — master/config
/// data, the `TaskTemplate` role for Visa checklist auto-instantiation.
export class CreateVisaChecklistTemplateDto {
  @IsISO31661Alpha2()
  countryCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  visaType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
