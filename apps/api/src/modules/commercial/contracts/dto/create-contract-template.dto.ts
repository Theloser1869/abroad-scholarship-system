import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractTemplateDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  /// Schema of merge-field keys this template expects (e.g. `{ programName: "string",
  /// tuitionFee: "number" }`) — a Contract created `fromTemplate` fills these in as
  /// `Contract.mergeFieldValues`. Freeform JSON: master-data-style, not hard-coded (SRS
  /// section 2).
  @IsOptional()
  @IsObject()
  mergeFields?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
