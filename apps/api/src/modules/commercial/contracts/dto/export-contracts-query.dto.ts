import { IsString, MaxLength, MinLength } from 'class-validator';

/// SRS 6.21 "Export phải có reason..." — same pattern as
/// case-management/students/dto/export-students-query.dto.ts.
export class ExportContractsQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
