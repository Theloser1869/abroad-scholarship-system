import { randomUUID } from 'node:crypto';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { hashPassword } from '../../src/common/security/password.util';

/// Disposable user for tests that mutate account state (lockout, suspend, offboard, MFA
/// enrollment) — a shared seed fixture would leak state across test runs/files. Unique
/// username per call so parallel/repeated suite runs never collide.
export async function createTestUser(prisma: PrismaService, roleCode: RoleCode, password: string): Promise<{ id: string; username: string }> {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const suffix = randomUUID().slice(0, 8);
  const username = `test.${roleCode.toLowerCase()}.${suffix}`;
  const user = await prisma.user.create({
    data: {
      username,
      email: `${username}@example.local`,
      fullName: `Test User ${suffix}`,
      passwordHash: hashPassword(password),
      roleId: role.id,
    },
  });
  return { id: user.id, username };
}
