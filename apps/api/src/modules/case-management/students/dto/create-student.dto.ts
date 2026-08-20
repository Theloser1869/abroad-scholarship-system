import { IsDateString, IsEmail, IsISO4217CurrencyCode, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MaxLength(255)
  fullName!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  targetCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetMajor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetIntake?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  budgetCurrency?: string;
}
