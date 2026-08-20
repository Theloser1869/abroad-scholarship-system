import { generateOpaqueToken, hashOpaqueToken, timingSafeStringEqual } from './token.util';

describe('token.util', () => {
  it('generates unique, sufficiently long opaque tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('hashes deterministically so a lookup by hash works', () => {
    const raw = generateOpaqueToken();
    expect(hashOpaqueToken(raw)).toBe(hashOpaqueToken(raw));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashOpaqueToken('a')).not.toBe(hashOpaqueToken('b'));
  });

  describe('timingSafeStringEqual', () => {
    it('returns true for equal strings', () => {
      expect(timingSafeStringEqual('abc', 'abc')).toBe(true);
    });
    it('returns false for different strings of the same length', () => {
      expect(timingSafeStringEqual('abc', 'abd')).toBe(false);
    });
    it('returns false for different-length strings without throwing', () => {
      expect(timingSafeStringEqual('abc', 'abcd')).toBe(false);
    });
  });
});
