import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class UpdateSchoolMasterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
