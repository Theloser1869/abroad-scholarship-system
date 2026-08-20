import { randomBytes } from 'node:crypto';
import { MfaEncryption } from './mfa-encryption.util';

describe('MfaEncryption', () => {
  const key = randomBytes(32).toString('hex');

  it('round-trips a secret through encrypt/decrypt', () => {
    const mfa = new MfaEncryption(key);
    const secret = 'JBSWY3DPEHPK3PXP';
    const ciphertext = mfa.encrypt(secret);
    expect(ciphertext).not.toContain(secret);
    expect(mfa.decrypt(ciphertext)).toBe(secret);
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => new MfaEncryption('too-short')).toThrow();
  });

  it('fails to decrypt with the wrong key (auth tag mismatch)', () => {
    const mfa = new MfaEncryption(key);
    const ciphertext = mfa.encrypt('JBSWY3DPEHPK3PXP');
    const otherMfa = new MfaEncryption(randomBytes(32).toString('hex'));
    expect(() => otherMfa.decrypt(ciphertext)).toThrow();
  });

  it('fails to decrypt a tampered ciphertext', () => {
    const mfa = new MfaEncryption(key);
    const ciphertext = mfa.encrypt('JBSWY3DPEHPK3PXP');
    const [iv, body, tag] = ciphertext.split(':');
    const tampered = [iv, body.slice(0, -2) + '00', tag].join(':');
    expect(() => mfa.decrypt(tampered)).toThrow();
  });
});
