import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_ACTION_KEY } from '../audit/audit.interceptor';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';

/// Global, deny-by-default authorization gate (NFR-SEC-01; MASTER_CONTEXT "Backend phải
/// kiểm authorization"). Every route is denied unless:
///   1. it is marked `@Public()`, or
///   2. the caller resolved to a `Principal` (see AuthContextMiddleware), AND
///   3. if the route declares `@RequirePermission(resource, action)`, the caller's role
///      actually has that permission (checked against RolePermission — the ONLY
///      authorization dimension this phase implements).
///
/// What this guard deliberately does NOT do (left to Phase 03 — 03-security/02_RBAC.md):
/// record-scope checks, case ownership/membership checks, field-level filtering. A route
/// passing this guard is authenticated and role-permitted, not yet fully authorized in the
/// SRS section 2 sense ("role + action + record scope + case ownership + field-level").
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.principal) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }

    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const hasPermission = await this.roleHasPermission(req.principal.roleCode, required);
    if (!hasPermission) {
      // Phase 13 fix (SRS "mọi thao tác nhạy cảm... phải có audit trail", AC-13 "mọi export
      // thành công/thất bại đều có audit"): NestJS runs Guards strictly before Interceptors,
      // so a denial thrown here never reaches `AuditInterceptor` — its DENIED-write path
      // only ever fired for denials thrown *inside* a handler (scope/ownership checks), not
      // this permission check. Write the same shape of row here for any `@Audit`-decorated
      // route so a guard-level denial is never silently unaudited.
      await this.writeDeniedAudit(context, req);
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: `Role does not have permission ${required.resource}:${required.action}.`,
      });
    }
    return true;
  }

  private async writeDeniedAudit(context: ExecutionContext, req: Request): Promise<void> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return; // route isn't `@Audit`-decorated at all — nothing to record.

    const objectType = context.getClass().name.replace(/Controller$/, '');
    const objectId = typeof req.params?.id === 'string' && req.params.id.length > 0 ? req.params.id : undefined;
    const onStudentsPath = req.path.startsWith('/students');
    const onCasesPath = req.path.startsWith('/cases/') || req.path === '/cases';

    await this.prisma.auditLog.create({
      data: {
        actorId: req.principal?.userId,
        action,
        objectType,
        objectId,
        studentId: onStudentsPath ? objectId : undefined,
        caseId: onCasesPath ? objectId : undefined,
        result: 'DENIED',
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
        requestId: req.requestId,
      },
    });
  }

  private async roleHasPermission(roleCode: string, required: RequiredPermission): Promise<boolean> {
    if (!(Object.values(RoleCode) as string[]).includes(roleCode)) {
      return false;
    }
    const grant = await this.prisma.rolePermission.findFirst({
      where: {
        role: { code: roleCode as RoleCode },
        permission: { resource: required.resource, action: required.action },
      },
    });
    return grant !== null;
  }
}
