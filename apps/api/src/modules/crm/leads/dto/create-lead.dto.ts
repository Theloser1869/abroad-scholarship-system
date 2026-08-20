import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MaxLength(255)
  contactName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  parentName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryInterest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  majorInterest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  intake?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceInterest?: string;

  /// Defaults to the creating principal if omitted — a Lead always has an owner (SRS 6.2
  /// field list "owner"), never created ownerless.
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;
}
