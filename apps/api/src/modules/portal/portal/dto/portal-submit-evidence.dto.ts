import { IsUUID } from 'class-validator';

/// Shared by the roadmap-milestone and application-checklist "submit evidence" Portal
/// actions — both are a single `documentId` link, nothing else.
export class PortalSubmitEvidenceDto {
  @IsUUID()
  documentId!: string;
}
