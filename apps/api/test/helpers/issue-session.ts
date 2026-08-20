import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/// Test-only shortcut that goes through the SAME validation path production traffic does
/// (AuthContextMiddleware looks up this exact Session row by `jti` on every request) —
/// it just skips the HTTP round-trip through POST /auth/login (password hashing + a
/// second request) since these tests are about authorization on OTHER endpoints, not
/// about re-proving login works (that's apps/api/test/auth.e2e-spec.ts). A revoked/
/// expired/missing session behaves identically whether it got here via real login or this
/// helper, because it's the real `sessions` table either way.
export async function issueTestSession(prisma: PrismaService, username: string): Promise<{ token: string; userId: string; sessionId: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { role: true } });
  const sessionId = randomUUID();
  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: `test-unused-${sessionId}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const token = jwt.sign({ sub: user.id, roleCode: user.role.code, jti: sessionId }, process.env.AUTH_JWT_SECRET!, { expiresIn: '15m' });
  return { token, userId: user.id, sessionId };
}
