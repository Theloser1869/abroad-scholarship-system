import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Session } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../../common/security/token.util';
import { TokenService } from './token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  session: Session;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async issue(userId: string, roleCode: string, meta: RequestMeta): Promise<IssuedTokens> {
    const sessionId = randomUUID();
    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.tokens.refreshTokenTtlDays() * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: hashOpaqueToken(refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    const accessToken = this.tokens.signAccessToken({ sub: userId, roleCode, jti: sessionId });
    return { accessToken, refreshToken, session };
  }

  /// Refresh-token rotation: the presented token is single-use — a successful refresh
  /// revokes it and issues a brand new (access, refresh) pair under a NEW session row.
  /// Reusing an already-rotated refresh token is treated as a revoked/invalid session
  /// (standard refresh-token-theft mitigation), not silently accepted.
  async rotate(rawRefreshToken: string, meta: RequestMeta): Promise<IssuedTokens> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const existing = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: { include: { role: true } } },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid, expired, or already used.' });
    }
    if (existing.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Account is not active.' });
    }

    await this.prisma.session.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    return this.issue(existing.userId, existing.user.role.code, meta);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async listActiveForUser(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
