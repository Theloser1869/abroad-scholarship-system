import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from './principal';

/// Authentication context (03-security/01_AUTH.md). If the caller sends a valid
/// `Authorization: Bearer <access-token>`, this resolves `req.principal`; otherwise the
/// request stays anonymous (`req.principal = null`) and `AuthGuard` turns that into a 401
/// for non-public routes (deny-by-default, NFR-SEC-01).
///
/// The access token itself is a short-lived, signed JWT (stateless), but its `jti` claim
/// is a Session id that IS re-checked against the database on every request. A pure
/// stateless JWT cannot support "revoke session đang hoạt động" (SRS AC-14) — an
/// already-issued token would keep working until its natural expiry no matter what an
/// admin does. Re-validating the session row means offboarding/suspension/explicit
/// revocation takes effect on the very next request, at the cost of one indexed DB lookup
/// per authenticated request — see docs/security/AUTH_MODEL.md for the full trade-off
/// writeup. A malformed/expired/revoked token is treated the same as "no token"
/// (anonymous) rather than raising an error here, so the decision to reject stays with
/// `AuthGuard`, in one place.
@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    req.principal = await this.resolvePrincipal(req);
    next();
  }

  private async resolvePrincipal(req: Request): Promise<Principal | null> {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice('Bearer '.length).trim();
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    if (!token || !secret) {
      return null;
    }

    let claims: { sub: string; roleCode: string; jti: string };
    try {
      const decoded = jwt.verify(token, secret);
      if (typeof decoded === 'string') {
        return null;
      }
      const { sub, roleCode, jti } = decoded as { sub?: unknown; roleCode?: unknown; jti?: unknown };
      if (typeof sub !== 'string' || typeof roleCode !== 'string' || typeof jti !== 'string') {
        return null;
      }
      claims = { sub, roleCode, jti };
    } catch {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: claims.jti },
      include: { user: { select: { status: true, roleId: true, role: { select: { code: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }
    if (session.user.status !== 'ACTIVE') {
      return null;
    }
    // Trust the session's own current role join over the JWT's roleCode claim — if a
    // user's role changed after the token was issued, the fresher DB value wins rather
    // than a stale permission level baked into an already-issued short-lived token.
    return { userId: session.userId, roleCode: session.user.role.code, sessionId: session.id };
  }
}
