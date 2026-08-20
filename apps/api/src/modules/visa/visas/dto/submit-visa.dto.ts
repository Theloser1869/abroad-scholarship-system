import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SubmitVisaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  submissionReference?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
