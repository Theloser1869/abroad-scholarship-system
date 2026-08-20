import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateScholarshipApplicationDto {
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsUUID()
  essayArtifactId?: string;

  @IsOptional()
  @IsDateString()
  interviewAt?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsString()
  conditions?: string;
}
