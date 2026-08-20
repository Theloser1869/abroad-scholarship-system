import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/// TOTP secrets must be recoverable (the server verifies a live 6-digit code against them
/// every login), so they can't be one-way hashed like a password — encrypted at rest
/// instead (SRS 6.1 "backup code được mã hóa" applied to the secret itself, which is the
/// more sensitive of the two). Uses AUTH_MFA_ENCRYPTION_KEY, a key deliberately separate
/// from AUTH_JWT_SECRET (see .env.example) so a JWT-secret leak doesn't also expose every
/// enrolled MFA secret.
export class MfaEncryption {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    const key = Buffer.from(hexKey, 'hex');
    if (key.length !== 32) {
      throw new Error('AUTH_MFA_ENCRYPTION_KEY must be a 32-byte (64 hex character) key.');
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), ciphertext.toString('hex'), authTag.toString('hex')].join(':');
  }

  decrypt(payload: string): string {
    const [ivHex, ciphertextHex, authTagHex] = payload.split(':');
    if (!ivHex || !ciphertextHex || !authTagHex) {
      throw new Error('Malformed MFA ciphertext payload.');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
