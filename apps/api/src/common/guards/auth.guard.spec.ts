import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { AuthGuard } from './auth.guard';

function contextWithRequest(req: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const rolePermissionFindFirst = jest.fn();
  const prisma = { rolePermission: { findFirst: rolePermissionFindFirst } };

  function makeGuard(metadataByKey: Record<string, unknown>) {
    const reflector = {
      getAllAndOverride: (key: string) => metadataByKey[key],
    } as unknown as Reflector;
    return new AuthGuard(reflector, prisma as never);
  }

  beforeEach(() => {
    rolePermissionFindFirst.mockReset();
  });

  it('allows a route marked @Public() even with no principal', async () => {
    const guard = makeGuard({ [IS_PUBLIC_KEY]: true });
    const ctx = contextWithRequest({ principal: null });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects an unauthenticated caller on a non-public route', async () => {
    const guard = makeGuard({ [IS_PUBLIC_KEY]: false });
    const ctx = contextWithRequest({ principal: null });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows an authenticated caller when no permission is required', async () => {
    const guard = makeGuard({ [IS_PUBLIC_KEY]: false, [REQUIRE_PERMISSION_KEY]: undefined });
    const ctx = contextWithRequest({ principal: { userId: 'u1', roleCode: 'SYSTEM_ADMIN' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('denies when the role has no matching RolePermission grant', async () => {
    rolePermissionFindFirst.mockResolvedValue(null);
    const guard = makeGuard({
      [IS_PUBLIC_KEY]: false,
      [REQUIRE_PERMISSION_KEY]: { resource: 'students', action: 'view' },
    });
    const ctx = contextWithRequest({ principal: { userId: 'u1', roleCode: 'SALES_MARKETING' } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when the role has a matching RolePermission grant', async () => {
    rolePermissionFindFirst.mockResolvedValue({ roleId: 'r1', permissionId: 'p1' });
    const guard = makeGuard({
      [IS_PUBLIC_KEY]: false,
      [REQUIRE_PERMISSION_KEY]: { resource: 'students', action: 'view' },
    });
    const ctx = contextWithRequest({ principal: { userId: 'u1', roleCode: 'SYSTEM_ADMIN' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('denies a syntactically-invalid roleCode without querying the database', async () => {
    const guard = makeGuard({
      [IS_PUBLIC_KEY]: false,
      [REQUIRE_PERMISSION_KEY]: { resource: 'students', action: 'view' },
    });
    const ctx = contextWithRequest({ principal: { userId: 'u1', roleCode: 'NOT_A_REAL_ROLE' } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    expect(rolePermissionFindFirst).not.toHaveBeenCalled();
  });
});
