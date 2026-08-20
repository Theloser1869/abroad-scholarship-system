import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCaseDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  stage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}
