import { IsString, MaxLength, MinLength } from 'class-validator';

export class MfaLoginVerifyDto {
  @IsString()
  mfaToken!: string;

  /// Accepts either a 6-digit TOTP code or an 11-character backup code (`NNNNN-NNNNN`) —
  /// the service tries TOTP first, then falls back to a backup code.
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}
