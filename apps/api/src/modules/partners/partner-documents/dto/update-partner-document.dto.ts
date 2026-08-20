import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/// Allowed only while the PartnerDocument is still DRAFT — "Không overwrite signed/final
/// partner documents." A signed/effective document is replaced by creating a new
/// PartnerDocument row (same partner+type auto-increments `version`), never edited in
/// place.
export class UpdatePartnerDocumentDto {
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}
