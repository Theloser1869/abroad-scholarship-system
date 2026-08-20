import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAcademicRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  school!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  period!: string;

  @IsOptional()
  @IsNumber()
  gpa?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gradingScale?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
