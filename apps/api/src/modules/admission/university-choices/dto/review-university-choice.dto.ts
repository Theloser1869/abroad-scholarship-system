import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewUniversityChoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;
}
