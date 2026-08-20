import { IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  eventName!: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  season?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preparation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  result?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rank?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  award?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
