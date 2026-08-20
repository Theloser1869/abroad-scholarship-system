import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const RESULTS = ['GRANTED', 'REFUSED'] as const;

/// "Granted/Refused phải có result evidence và result date nếu yêu cầu" — 09-visa.
export class RecordVisaResultDto {
  @IsIn(RESULTS)
  result!: (typeof RESULTS)[number];

  @IsOptional()
  @IsDateString()
  resultDate?: string;

  @IsOptional()
  @IsUUID()
  resultEvidenceDocumentId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
