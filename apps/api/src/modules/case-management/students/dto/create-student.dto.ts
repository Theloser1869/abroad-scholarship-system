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

  /// Client Acceptance Remediation GAP-005 (REQ-STUDENT-004) — 04_Student_Profile row18.
  /// Optional here (same as targetCountry/targetMajor/targetIntake above); required-ness
  /// enforced stage-aware at Assessment approval — see AssessmentsService.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  scholarshipGoal?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  budgetCurrency?: string;
}
