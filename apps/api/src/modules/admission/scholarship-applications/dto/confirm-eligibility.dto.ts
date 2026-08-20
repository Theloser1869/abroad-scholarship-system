import { IsOptional, IsString } from 'class-validator';

export class ConfirmEligibilityDto {
  @IsOptional()
  @IsString()
  eligibilityNotes?: string;
}
