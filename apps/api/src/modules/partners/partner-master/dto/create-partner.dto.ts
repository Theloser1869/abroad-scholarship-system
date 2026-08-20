import { IsEmail, IsEnum, IsISO31661Alpha2, IsOptional, IsPhoneNumber, IsString, IsUUID, IsUrl, MaxLength, MinLength } from 'class-validator';
import { PartnerType } from '@prisma/client';

/// 10-partners/01_PARTNER_CRM.md Partner field list. `partnerCode` is server-generated
/// (`IdGeneratorService.nextCountryScopedCode('PT', countryCode)`), never client-supplied.
export class CreatePartnerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsEnum(PartnerType)
  type!: PartnerType;

  @IsISO31661Alpha2()
  countryCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsPhoneNumber()
  contactPhone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
