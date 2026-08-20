import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ConfirmEnrollmentDto {
  @IsOptional()
  @IsDateString()
  confirmationDate?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
