import { IsISO31661Alpha2, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// 09-visa/01_VISA.md. `studentId`/`caseId` come from the route (`/cases/:caseId/visas`) —
/// Case already carries `studentId`, derived, never a separately client-supplied field.
export class CreateVisaDto {
  @IsISO31661Alpha2()
  countryCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  visaType!: string;

  @IsOptional()
  @IsUUID()
  offerId?: string;
}
