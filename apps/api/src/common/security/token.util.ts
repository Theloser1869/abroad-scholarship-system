import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/// Opaque bearer tokens (refresh tokens, password-reset tokens, MFA backup codes): the raw
/// value is shown to the caller exactly once and never stored — only its SHA-256 hash is
/// persisted (`sessions.refresh_token_hash`, `password_reset_tokens.token_hash`,
/// `mfa_backup_codes.code_hash`). A stolen database dump does not hand over usable tokens.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
