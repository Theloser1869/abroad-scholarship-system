import { CaseStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCaseStageDto {
  @IsEnum(CaseStage)
  stage!: CaseStage;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}
