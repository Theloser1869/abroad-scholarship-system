import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

export interface RequiredPermission {
  resource: string;
  action: string;
}

/// Declares the (resource, action) a route needs. `AuthGuard` checks this against the
/// caller's role via RolePermission — a role-level check only. Record-scope, case
/// ownership and field-level restriction (SRS section 2/13, MASTER_CONTEXT SECURITY) are
/// NOT evaluated here: that policy engine is Phase 03 (03-security/02_RBAC.md). Treat this
/// decorator as the wiring point Phase 03 will extend, not the finished authorization
/// model.
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { resource, action } satisfies RequiredPermission);
