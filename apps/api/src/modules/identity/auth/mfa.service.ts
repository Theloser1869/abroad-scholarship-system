import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { authenticator } from 'otplib';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MfaEncryption } from '../../../common/security/mfa-encryption.util';
import { hashOpaqueToken } from '../../../common/security/token.util';

const BACKUP_CODE_COUNT = 8;

export interface EnrollmentResult {
  secret: string;
  otpauthUrl: string;
}

@Injectable()
export class MfaService {
  private readonly encryption: MfaEncryption;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('AUTH_MFA_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('AUTH_MFA_ENCRYPTION_KEY is not configured.');
    }
    this.encryption = new MfaEncryption(key);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    return row?.enabled ?? false;
  }

  /// Starts enrollment: generates a new TOTP secret, stores it encrypted with
  /// `enabled: false` until confirmed via `confirmEnrollment`. Refuses to start a new
  /// enrollment while one is already confirmed+enabled — a stolen-but-valid access token
  /// must not be able to silently downgrade the account's MFA secret without the holder
  /// also proving control of the (would-be new) authenticator device, and this phase does
  /// not implement a safe "replace an active device" flow (would need a staged secondary
  /// secret + confirm-then-swap; deferred, see docs/security/AUTH_MODEL.md). Disabling
  /// MFA first (not implemented in this phase either) would be the intended path.
  async startEnrollment(userId: string, accountLabel: string): Promise<EnrollmentResult> {
    const existing = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (existing?.enabled) {
      throw new ConflictException({
        code: 'MFA_ALREADY_ENABLED',
        message: 'MFA is already enabled for this account. Disable it before enrolling a new device.',
      });
    }

    const secret = authenticator.generateSecret();
    const issuer = this.config.get<string>('AUTH_MFA_ISSUER') ?? 'Abroad Scholarship System';
    const otpauthUrl = authenticator.keyuri(accountLabel, issuer, secret);

    await this.prisma.mfaSecret.upsert({
      where: { userId },
      update: { secretCiphertext: this.encryption.encrypt(secret), enabled: false, confirmedAt: null },
      create: { userId, secretCiphertext: this.encryption.encrypt(secret), enabled: false },
    });

    return { secret, otpauthUrl };
  }

  /// Confirms enrollment (or validates a login-time code) against the caller-supplied
  /// 6-digit TOTP code. On successful *first* confirmation, flips `enabled: true` and
  /// mints a fresh set of backup codes (returned once, hashed at rest — SRS 6.1 "backup
  /// code được mã hóa").
  async confirmEnrollment(userId: string, code: string): Promise<string[]> {
    const valid = await this.verifyTotp(userId, code);
    if (!valid) {
      return [];
    }
    await this.prisma.mfaSecret.update({ where: { userId }, data: { enabled: true, confirmedAt: new Date() } });
    return this.regenerateBackupCodes(userId);
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!row) return false;
    const secret = this.encryption.decrypt(row.secretCiphertext);
    return authenticator.check(code, secret);
  }

  /// A backup code is accepted at most once — matched by hash, then immediately marked
  /// used inside the same call so a captured/leaked code cannot be replayed.
  async consumeBackupCode(userId: string, code: string): Promise<boolean> {
    const hash = hashOpaqueToken(code.trim().toUpperCase());
    const row = await this.prisma.mfaBackupCode.findFirst({ where: { userId, codeHash: hash, usedAt: null } });
    if (!row) return false;
    await this.prisma.mfaBackupCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return true;
  }

  private async regenerateBackupCodes(userId: string): Promise<string[]> {
    await this.prisma.mfaBackupCode.deleteMany({ where: { userId, usedAt: null } });
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      codes.push(this.randomBackupCode());
    }
    await this.prisma.mfaBackupCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashOpaqueToken(code) })),
    });
    return codes;
  }

  private randomBackupCode(): string {
    // 10-digit numeric code, grouped for readability (XXXXX-XXXXX). Simpler for a user to
    // type by hand under stress (locked out, no authenticator app) than the base64url
    // opaque tokens used for sessions/reset — different purpose, different shape.
    const part = () => String(randomInt(0, 100000)).padStart(5, '0');
    return `${part()}-${part()}`;
  }
}
