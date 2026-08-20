import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCaseStageDto {
  @IsString()
  @MaxLength(100)
  stage!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}
