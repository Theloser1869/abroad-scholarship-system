import { IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  recommenderName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsDateString()
  requestDate?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  /// Field-level restricted from Student/Parent — `FieldPolicyService.redactLor`.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}
