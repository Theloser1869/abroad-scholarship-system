import { IsISO31661Alpha2, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateVisaDto {
  @IsOptional()
  @IsISO31661Alpha2()
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  visaType?: string;

  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
