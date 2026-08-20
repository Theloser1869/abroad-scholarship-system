import { IsDateString, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from 'class-validator';

/// `testType` is free text — 07-profile/02_PROFILE_EVIDENCE.md "Không hard-code chỉ IELTS
/// hoặc SAT nếu master data/configuration trong architecture cho phép nhiều test type."
export class CreateTestRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  testType!: string;

  @IsInt()
  @Min(1)
  attemptNumber!: number;

  @IsOptional()
  @IsDateString()
  testDate?: string;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsObject()
  subscores?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  target?: number;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
