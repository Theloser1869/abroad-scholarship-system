import { IsOptional, IsString } from 'class-validator';

/// `refreshToken` is optional in the body because the primary transport is the httpOnly
/// `refresh_token` cookie set by login/refresh (see docs/api/API_CONVENTIONS.md and
/// docs/security/AUTH_MODEL.md) — non-browser clients that can't rely on cookies pass it
/// explicitly here instead.
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
