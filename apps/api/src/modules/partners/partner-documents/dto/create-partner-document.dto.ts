import { PartnerDocumentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

/// 10-partners/01_PARTNER_CRM.md Documents section (MOU/Agreement/Commission Agreement/
/// Rate Sheet). `documentId` must already exist (client uploads via `POST /documents`
/// first) — same "link a pre-existing Document, never create one here" pattern as every
/// Phase 07-09 evidence field (ASM-24 precedent).
export class CreatePartnerDocumentDto {
  @IsEnum(PartnerDocumentType)
  type!: PartnerDocumentType;

  @IsUUID()
  documentId!: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
