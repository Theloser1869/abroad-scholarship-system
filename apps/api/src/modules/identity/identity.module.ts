import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { MfaController } from './auth/mfa.controller';
import { MfaService } from './auth/mfa.service';
import { SessionService } from './auth/session.service';
import { TokenService } from './auth/token.service';
import { FieldPolicyService } from './rbac/field-policy.service';
import { ScopePolicyService } from './rbac/scope-policy.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

/// docs/architecture/DOMAIN_MAP.md domain 1 (Identity): owns User, Role, Permission,
/// RolePermission, AuditLog (Phase 02) plus Session, PasswordResetToken, MfaSecret,
/// MfaBackupCode (Phase 03). ScopePolicyService/FieldPolicyService are exported for other
/// domain modules (starting with case-management) to depend on — RBAC scope/field policy
/// is identity's concern, evaluated on behalf of the resource being accessed, not
/// duplicated per module.
@Module({
  controllers: [AuthController, MfaController, UsersController],
  providers: [AuthService, SessionService, TokenService, MfaService, UsersService, ScopePolicyService, FieldPolicyService],
  exports: [ScopePolicyService, FieldPolicyService, SessionService],
})
export class IdentityModule {}
