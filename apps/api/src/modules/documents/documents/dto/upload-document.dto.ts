import { IsString, IsUUID, MaxLength } from 'class-validator';

/// Phase 12 — multipart form fields alongside the uploaded file (`@UploadedFile()`, not a
/// DTO field: NestJS's multer integration keeps the binary out of the validated body).
/// `fileReference`/`mimeType`/`sizeBytes`/`checksumSha256` are gone from client input
/// entirely (Phase 07-11's `CreateDocumentDto` had them as caller-supplied) — every one of
/// those is now computed/generated server-side from the actual uploaded bytes. See
/// `docs/ASSUMPTIONS.md` ASM-50.
export class UploadDocumentDto {
  @IsString()
  @MaxLength(100)
  ownerEntity!: string;

  @IsUUID()
  ownerId!: string;

  @IsString()
  @MaxLength(100)
  documentType!: string;

  @IsString()
  @MaxLength(255)
  title!: string;
}
