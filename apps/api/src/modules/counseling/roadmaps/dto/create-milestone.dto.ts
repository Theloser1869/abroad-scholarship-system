import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stage?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  objective!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  metric?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  target?: string;

  /// The actual assigned staff member — validated (must be a member of the roadmap's
  /// Case) in `MilestonesService`, not here.
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
