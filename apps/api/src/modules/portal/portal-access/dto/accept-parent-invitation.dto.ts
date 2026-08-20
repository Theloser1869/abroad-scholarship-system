import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// `username`/`password` are only required when the invited email does not already belong
/// to an existing STUDENT_PARENT account (a parent with a second child links to their
/// EXISTING login instead — "Nếu một Parent liên kết nhiều Student: phải chọn đúng Student
/// context", never a duplicate User). Validated conditionally in the service, not here,
/// since which branch applies depends on a DB lookup the DTO layer can't perform.
export class AcceptParentInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password?: string;
}
