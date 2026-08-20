import { IsString, MaxLength, MinLength } from 'class-validator';

/// SRS 6.21 "Export phải có reason, filter scope, row count, fields exported, actor và
/// result" — `reason` is mandatory input from the caller, the rest is derived server-side
/// and written into `audit_logs.metadata` (see AuditInterceptor / StudentsController).
export class ExportStudentsQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
