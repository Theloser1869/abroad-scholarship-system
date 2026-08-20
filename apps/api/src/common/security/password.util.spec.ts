import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('verifies the correct password against its own hash', () => {
    const hash = hashPassword('Correct-Horse-1');
    expect(verifyPassword('Correct-Horse-1', hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('Correct-Horse-1');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash (different salt) for the same password each time', () => {
    const a = hashPassword('same-input');
    const b = hashPassword('same-input');
    expect(a).not.toBe(b);
    expect(verifyPassword('same-input', a)).toBe(true);
    expect(verifyPassword('same-input', b)).toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', () => {
    expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});
