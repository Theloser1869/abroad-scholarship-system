import { IsString, MaxLength, MinLength } from 'class-validator';

/// `signedDocumentId` is a plain string reference (not a real Document FK) — same "no
/// Document controller exists yet" pattern as `Contract.signedDocumentId` itself
/// documents (Phase 12; docs/ASSUMPTIONS.md ASM-02). Staff attach the signed artifact
/// through whatever manual/offline means exists today and pass its reference here.
export class SignContractDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  signedDocumentId!: string;
}
