import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePartnerStudentLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  linkType?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
