import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// "Không overwrite version cũ" — this always creates a NEW `WritingVersion` row; there is
/// no endpoint that edits an existing version's content.
export class CreateWritingVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  changeSummary?: string;
}
