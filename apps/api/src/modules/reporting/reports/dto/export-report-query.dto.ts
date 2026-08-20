import { IsString, MaxLength, MinLength } from 'class-validator';

export class ExportReportQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
