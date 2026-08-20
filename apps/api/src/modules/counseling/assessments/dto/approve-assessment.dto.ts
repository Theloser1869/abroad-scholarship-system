import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveAssessmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
