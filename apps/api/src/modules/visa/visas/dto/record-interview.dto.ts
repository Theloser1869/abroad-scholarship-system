import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RecordInterviewDto {
  @IsDateString()
  interviewAt!: string;

  @IsOptional()
  @IsString()
  interviewNotes?: string;
}
