import { Body, Controller, ForbiddenException, Get, Param, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Principal } from '../../../common/context/principal';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RefreshDto } from './dto/refresh.dto';
import { IssuedTokens, RequestMeta, SessionService } from './session.service';
import { TokenService } from './token.service';

const REFRESH_COOKIE_NAME = 'refresh_token';

/// Reference implementation of 03-security/01_AUTH.md. Every mutating/sensitive route is
/// `@Public()` where it must be reachable pre-login (login, refresh, password reset) and
/// otherwise goes through the standard AuthGuard/@RequirePermission pipeline from
/// docs/api/API_CONVENTIONS.md — no bespoke auth bypass here.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  // Phase 14 — a tighter per-IP throttle on top of the global default (RateLimitModule)
  // and the existing per-account lockout (AuthService.registerFailedAttempt): distributed
  // account-guessing across many usernames from one IP is bounded here even though no
  // single account ever crosses the lockout threshold.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @Audit('LOGIN')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.username, dto.password, requestMeta(req));
    if (result.status === 'mfa_required') {
      return { mfaRequired: true, mfaToken: result.mfaToken };
    }
    this.setRefreshCookie(res, result.tokens);
    return this.loginResponse(result.tokens, result.user);
  }

  @Public()
  @Post('mfa/login-verify')
  @Audit('LOGIN')
  async mfaLoginVerify(@Body() dto: MfaLoginVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyMfaAndIssueTokens(dto.mfaToken, dto.code, requestMeta(req));
    this.setRefreshCookie(res, result.tokens);
    return this.loginResponse(result.tokens, result.user);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = dto.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
    if (!raw) {
      throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN', message: 'No refresh token provided.' });
    }
    const tokens = await this.auth.refresh(raw, requestMeta(req));
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresInMinutes: this.tokens.accessTokenTtlMinutes() };
  }

  @Post('logout')
  @Audit('LOGOUT')
  async logout(@CurrentUser() principal: Principal | null, @Res({ passthrough: true }) res: Response) {
    if (principal) {
      await this.auth.logout(principal.sessionId);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
    return { loggedOut: true };
  }

  @Get('me')
  async me(@CurrentUser() principal: Principal | null) {
    if (!principal) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    return principal;
  }

  @Get('sessions')
  async listSessions(@CurrentUser() principal: Principal | null) {
    if (!principal) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    const active = await this.sessions.listActiveForUser(principal.userId);
    return active.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      current: s.id === principal.sessionId,
    }));
  }

  @Post('sessions/:id/revoke')
  @Audit('EDIT')
  async revokeSession(@CurrentUser() principal: Principal | null, @Param('id') sessionId: string) {
    if (!principal) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    const owned = await this.sessions.listActiveForUser(principal.userId);
    const isSelfSession = owned.some((s) => s.id === sessionId);
    const isAdmin = principal.roleCode === 'SYSTEM_ADMIN';
    if (!isSelfSession && !isAdmin) {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'Cannot revoke a session that is not your own.' });
    }
    await this.sessions.revoke(sessionId);
    return { revoked: true };
  }

  @Post('sessions/revoke-all')
  @Audit('EDIT')
  async revokeAllSessions(@CurrentUser() principal: Principal | null) {
    if (!principal) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    const count = await this.sessions.revokeAllForUser(principal.userId, principal.sessionId);
    return { revokedCount: count };
  }

  @Public()
  @Post('password-reset/request')
  @Audit('EDIT')
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    const { devToken } = await this.auth.requestPasswordReset(dto.email);
    return { message: 'If that email is registered, a reset link has been sent.', ...(devToken ? { devToken } : {}) };
  }

  @Public()
  @Post('password-reset/confirm')
  @Audit('EDIT')
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    await this.auth.confirmPasswordReset(dto.token, dto.newPassword);
    return { reset: true };
  }

  private setRefreshCookie(res: Response, tokens: IssuedTokens): void {
    const secure = (this.config.get<string>('AUTH_COOKIE_SECURE') ?? 'true') !== 'false';
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/auth',
      maxAge: this.tokens.refreshTokenTtlDays() * 24 * 60 * 60 * 1000,
    });
  }

  private loginResponse(tokens: IssuedTokens, user: { id: string; username: string; email: string; fullName: string; roleCode: string }) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInMinutes: this.tokens.accessTokenTtlMinutes(),
      user,
    };
  }
}

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}
