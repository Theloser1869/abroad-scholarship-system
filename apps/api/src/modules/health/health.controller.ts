import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

/// Phase 14 hardening — 14-production/01_PRODUCTION_HARDENING.md "health/readiness/
/// liveness". Deliberately unauthenticated (`@Public()`, no `@RequirePermission`) and
/// exempt from rate limiting (`@SkipThrottle()`) — a container orchestrator/load balancer
/// polls these frequently from inside the deployment, before any user session exists, and
/// must never itself get rate-limited or auth-blocked. Carries no `@Audit` (routine
/// infrastructure polling, not a business/security event — matches the `PATCH /notifications/
/// :id/read` precedent noted in docs/security/SECURITY_TEST_REPORT.md §12).
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /// Liveness — "is the process itself up and able to handle a request at all," with no
  /// dependency checks. A container orchestrator restarts the process on failure here, so
  /// this must never fail merely because a downstream dependency (DB) is temporarily down
  /// — that is what readiness (below) is for.
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /// Readiness — "can this instance actually serve real traffic right now." Checks the one
  /// hard dependency this application has (PostgreSQL via Prisma); a `503` here tells an
  /// orchestrator/load balancer to stop routing new traffic to this instance without
  /// killing/restarting it (that stays liveness's job). A lightweight `SELECT 1`, never a
  /// query against application tables.
  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'Database is not reachable.' });
    }
    return { status: 'ok', database: 'ok' };
  }
}
