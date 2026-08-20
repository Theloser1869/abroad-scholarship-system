import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/// `programId`/`caseId`/`studentId` are identity-establishing and not editable — a wrong
/// program means a new Application, not a re-pointed one.
export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  intendedIntake?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
