import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../../common/security/password.util';
import { generateOpaqueToken, hashOpaqueToken } from '../../../common/security/token.util';
import { MfaService } from './mfa.service';
import { RequestMeta, SessionService, IssuedTokens } from './session.service';
import { TokenService } from './token.service';

export type LoginResult =
  | { status: 'ok'; tokens: IssuedTokens; user: PublicUser }
  | { status: 'mfa_required'; mfaToken: string };

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleCode: string;
}

/// SRS 6.1 rules this service enforces: secure password hashing (common/security),
/// account lockout after AUTH_LOGIN_MAX_ATTEMPTS, MFA gate for any user with MFA enabled,
/// generic "invalid credentials" for bad username/password (no user-enumeration signal),
/// but a distinct, deliberately-observable code for locked/suspended/offboarded — those
/// are states the legitimate account owner benefits from knowing, not secrets to hide from
/// them (see docs/security/AUTH_MODEL.md).
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { username }, include: { role: true } });
    if (!user) {
      throw invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked due to repeated failed login attempts.', lockedUntil: user.lockedUntil },
        423,
      );
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended.' });
    }
    if (user.status === 'OFFBOARDED') {
      throw new ForbiddenException({ code: 'ACCOUNT_OFFBOARDED', message: 'This account no longer has access.' });
    }

    const passwordOk = verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      const justLocked = await this.registerFailedAttempt(user);
      if (justLocked) {
        const locked = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        throw new HttpException(
          { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked due to repeated failed login attempts.', lockedUntil: locked.lockedUntil },
          423,
        );
      }
      throw invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    if (await this.mfa.isEnabled(user.id)) {
      return { status: 'mfa_required', mfaToken: this.tokens.signMfaChallengeToken(user.id) };
    }

    const tokens = await this.sessions.issue(user.id, user.role.code, meta);
    return { status: 'ok', tokens, user: toPublicUser(user, user.role.code) };
  }

  async verifyMfaAndIssueTokens(mfaToken: string, code: string, meta: RequestMeta): Promise<LoginResult & { status: 'ok' }> {
    const userId = this.tokens.verifyMfaChallengeToken(mfaToken);
    if (!userId) {
      throw new UnauthorizedException({ code: 'INVALID_MFA_TOKEN', message: 'MFA challenge is invalid or expired — log in again.' });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'INVALID_MFA_TOKEN', message: 'MFA challenge is invalid or expired — log in again.' });
    }

    const totpOk = await this.mfa.verifyTotp(user.id, code);
    const backupOk = totpOk ? false : await this.mfa.consumeBackupCode(user.id, code);
    if (!totpOk && !backupOk) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException({ code: 'INVALID_MFA_CODE', message: 'Invalid authentication code.' });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const tokens = await this.sessions.issue(user.id, user.role.code, meta);
    return { status: 'ok', tokens, user: toPublicUser(user, user.role.code) };
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<IssuedTokens> {
    return this.sessions.rotate(rawRefreshToken, meta);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  /// Always returns successfully regardless of whether the email exists — "no verbose
  /// auth errors" applies to enumeration via the password-reset flow too (SRS 6.1). The
  /// raw token is returned in the result ONLY outside production, standing in for the
  /// email-delivery integration that does not exist until Phase 12
  /// (12-platform/02_INTEGRATIONS_JOBS.md) — see docs/ASSUMPTIONS.md.
  async requestPasswordReset(email: string): Promise<{ devToken?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return {};
    }

    const rawToken = generateOpaqueToken();
    const ttlMinutes = Number(this.config.get<string>('AUTH_PASSWORD_RESET_TTL_MINUTES') ?? '30');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });
    await this.prisma.notification.create({
      data: {
        recipientId: user.id,
        event: 'password_reset_requested',
        channel: 'EMAIL',
        payload: { maskedToken: '***redacted***' },
      },
    });

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return isProduction ? {} : { devToken: rawToken };
  }

  /// Replay prevention: `usedAt` is set inside the same call that consumes the token — a
  /// second confirm with the same raw token no longer matches an unused row and is
  /// rejected exactly like an unknown/expired one (same error code, no distinction, so a
  /// replay attempt learns nothing new).
  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ConflictException({ code: 'INVALID_OR_USED_RESET_TOKEN', message: 'This reset link is invalid or has already been used.' });
    }

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null },
      }),
    ]);
    // A password reset invalidates every existing session — the old password may have
    // been compromised, so anything issued under it should not keep working.
    await this.sessions.revokeAllForUser(record.userId);
  }

  /// Returns whether THIS attempt is the one that crossed the lockout threshold — the
  /// caller uses that to decide whether to respond 423 ACCOUNT_LOCKED (this attempt) or
  /// the generic 401 (attempts before the threshold).
  private async registerFailedAttempt(user: User): Promise<boolean> {
    const maxAttempts = Number(this.config.get<string>('AUTH_LOGIN_MAX_ATTEMPTS') ?? '5');
    const lockoutMinutes = Number(this.config.get<string>('AUTH_LOCKOUT_MINUTES') ?? '15');
    const nextCount = user.failedLoginCount + 1;

    if (nextCount >= maxAttempts) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000) },
      });
      return true;
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: nextCount } });
    return false;
  }
}

function invalidCredentials(): HttpException {
  return new HttpException({ code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' }, HttpStatus.UNAUTHORIZED);
}

function toPublicUser(user: User, roleCode: string): PublicUser {
  return { id: user.id, username: user.username, email: user.email, fullName: user.fullName, roleCode };
}
