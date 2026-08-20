import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// `type` is free text (Resume/Essay/SOP/Motivation Letter/Study Plan/LOR/custom) — same
/// configurable-field precedent as `Case.stage` — 03_WRITING.md "custom types."
export class CreateWritingArtifactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  type!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  /// Optional initial content for version 1 — an artifact may also be created empty and
  /// filled in via `POST /writing-artifacts/:id/versions` immediately after.
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;
}
