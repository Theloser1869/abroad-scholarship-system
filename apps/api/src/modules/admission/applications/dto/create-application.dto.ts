import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/// 08-admission/02_APPLICATION.md. `studentId`/`caseId` come from the route
/// (`/cases/:caseId/applications`) — Case already carries `studentId`, so it is derived,
/// never a separately client-supplied field that could disagree with the Case ("Không tạo
/// Student/Case mới khi tạo Application" — and no way to mismatch one that already exists).
export class CreateApplicationDto {
  @IsUUID()
  programId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intendedIntake?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
