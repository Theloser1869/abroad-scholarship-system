import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
