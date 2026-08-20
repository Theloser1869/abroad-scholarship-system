import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateResearchProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mentor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  methodology?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  output?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publication?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  award?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
