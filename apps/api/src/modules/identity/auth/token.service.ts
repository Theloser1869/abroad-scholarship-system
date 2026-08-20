import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface AccessTokenClaims {
  sub: string;
  roleCode: string;
  jti: string;
}

export interface MfaChallengeClaims {
  sub: string;
  purpose: 'mfa_login';
}

/// Everything JWT-shaped in the auth flow goes through here — the access token
/// (short-lived, `jti` = Session id, re-validated by AuthContextMiddleware) and the MFA
/// challenge token (very short-lived, issued after password check, before the second
/// factor — carries no role/session so it cannot be used as an access token by mistake).
@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService) {}

  signAccessToken(claims: AccessTokenClaims): string {
    return jwt.sign(claims, this.secret(), { expiresIn: `${this.accessTokenTtlMinutes()}m` });
  }

  signMfaChallengeToken(userId: string): string {
    const claims: MfaChallengeClaims = { sub: userId, purpose: 'mfa_login' };
    return jwt.sign(claims, this.secret(), { expiresIn: '5m' });
  }

  verifyMfaChallengeToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.secret());
      if (typeof decoded === 'string') return null;
      const { sub, purpose } = decoded as { sub?: unknown; purpose?: unknown };
      if (typeof sub !== 'string' || purpose !== 'mfa_login') return null;
      return sub;
    } catch {
      return null;
    }
  }

  accessTokenTtlMinutes(): number {
    return Number(this.config.get<string>('AUTH_ACCESS_TOKEN_TTL_MINUTES') ?? '15');
  }

  refreshTokenTtlDays(): number {
    return Number(this.config.get<string>('AUTH_REFRESH_TOKEN_TTL_DAYS') ?? '7');
  }

  private secret(): string {
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    if (!secret) {
      throw new Error('AUTH_JWT_SECRET is not configured.');
    }
    return secret;
  }
}
