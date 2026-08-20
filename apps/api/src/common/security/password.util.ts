import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/// Same scrypt-based format used by `database/seeds/seed.ts` (`scrypt$salt$hash`, hex).
/// Duplicated rather than imported — `database/` and `apps/api/` are separate TypeScript
/// projects/packages (see docs/database/DATA_DICTIONARY.md) and this function is ~10 lines;
/// not worth a shared package for that. If it ever grows, extract to `packages/auth`.
const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/// Constant-time comparison (`timingSafeEqual`) — a naive `===` on the derived hash would
/// leak timing information about how many leading bytes matched (SRS 6.1 "no verbose auth
/// errors" extends to not leaking anything via timing either).
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(plain, salt, SCRYPT_KEY_LENGTH);
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
