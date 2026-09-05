import { IsEmail, IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

/// 11-portal/01_STUDENT_PARENT_PORTAL.md Parent relationship section. A StudentContact is
/// the contact-person record (Phase 02 schema) — this is its first real controller/service
/// (schema-only until now, same "schema waited, this phase builds it" pattern as
/// Partner/PartnerDocument in Phase 10). `type`/`relationship` stay free text (e.g.
/// "Mother"/"Father"/"Guardian"), never a hard-coded enum, same precedent as
/// `Visa.visaType`.
export class CreateStudentContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;

  /// 'VN' as the default region so staff can type the normal local format
  /// (0901234567) — not just E.164 (+84901234567), which `@IsPhoneNumber()` with no
  /// region would otherwise require.
  @IsOptional()
  @IsPhoneNumber('VN')
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
