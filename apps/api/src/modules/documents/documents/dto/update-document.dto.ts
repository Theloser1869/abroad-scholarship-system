import { IsOptional, IsString, MaxLength } from 'class-validator';

/// Metadata-only — there is no way to replace a Document's underlying file content through
/// this DTO. Replacing content is always `POST /documents/:id/versions` (a brand-new
/// Document row), per "Final/submitted/legal files require versioning ... không overwrite."
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentType?: string;
}
