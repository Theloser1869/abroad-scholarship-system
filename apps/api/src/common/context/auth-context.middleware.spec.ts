import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { AuthContextMiddleware } from './auth-context.middleware';

const SECRET = 'test-secret';
const NOW = new Date();
const FUTURE = new Date(NOW.getTime() + 60 * 60 * 1000);
const PAST = new Date(NOW.getTime() - 60 * 60 * 1000);

function makeReq(authorization?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
  } as unknown as Request;
}

function sign(claims: Record<string, unknown>) {
  return jwt.sign(claims, SECRET);
}

describe('AuthContextMiddleware', () => {
  const config = { get: () => SECRET } as unknown as ConfigService;
  const res = {} as Response;
  const sessionFindUnique = jest.fn();
  const prisma = { session: { findUnique: sessionFindUnique } };

  function makeMiddleware() {
    return new AuthContextMiddleware(config, prisma as never);
  }

  beforeEach(() => {
    sessionFindUnique.mockReset();
  });

  async function run(req: Request): Promise<void> {
    const middleware = makeMiddleware();
    await new Promise<void>((resolve) => {
      void middleware.use(req, res, () => resolve());
    });
  }

  it('leaves the request anonymous when there is no Authorization header', async () => {
    const req = makeReq(undefined);
    await run(req);
    expect(req.principal).toBeNull();
  });

  it('leaves the request anonymous on an invalid/malformed token', async () => {
    const req = makeReq('Bearer not-a-real-token');
    await run(req);
    expect(req.principal).toBeNull();
  });

  it('rejects a token missing required claims (no jti)', async () => {
    const token = sign({ sub: 'user-123', roleCode: 'SYSTEM_ADMIN' });
    const req = makeReq(`Bearer ${token}`);
    await run(req);
    expect(req.principal).toBeNull();
    expect(sessionFindUnique).not.toHaveBeenCalled();
  });

  it('resolves a Principal when the session is active and the user is ACTIVE', async () => {
    sessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-123',
      revokedAt: null,
      expiresAt: FUTURE,
      user: { status: 'ACTIVE', role: { code: 'SYSTEM_ADMIN' } },
    });
    const token = sign({ sub: 'user-123', roleCode: 'SYSTEM_ADMIN', jti: 'session-1' });
    const req = makeReq(`Bearer ${token}`);
    await run(req);
    expect(req.principal).toEqual({ userId: 'user-123', roleCode: 'SYSTEM_ADMIN', sessionId: 'session-1' });
  });

  it('rejects when the session was revoked (immediate revocation)', async () => {
    sessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-123',
      revokedAt: NOW,
      expiresAt: FUTURE,
      user: { status: 'ACTIVE', role: { code: 'SYSTEM_ADMIN' } },
    });
    const token = sign({ sub: 'user-123', roleCode: 'SYSTEM_ADMIN', jti: 'session-1' });
    const req = makeReq(`Bearer ${token}`);
    await run(req);
    expect(req.principal).toBeNull();
  });

  it('rejects when the session has expired', async () => {
    sessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-123',
      revokedAt: null,
      expiresAt: PAST,
      user: { status: 'ACTIVE', role: { code: 'SYSTEM_ADMIN' } },
    });
    const token = sign({ sub: 'user-123', roleCode: 'SYSTEM_ADMIN', jti: 'session-1' });
    const req = makeReq(`Bearer ${token}`);
    await run(req);
    expect(req.principal).toBeNull();
  });

  it('rejects a session whose user was suspended after the token was issued', async () => {
    sessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-123',
      revokedAt: null,
      expiresAt: FUTURE,
      user: { status: 'SUSPENDED', role: { code: 'SYSTEM_ADMIN' } },
    });
    const token = sign({ sub: 'user-123', roleCode: 'SYSTEM_ADMIN', jti: 'session-1' });
    const req = makeReq(`Bearer ${token}`);
    await run(req);
    expect(req.principal).toBeNull();
  });

  it('rejects when the session no longer exists', async () => {
    sessionFindUnique.mockResolvedValue(null);
    const token = sign({ sub: 'user-123', roleCode: 'SYSTEM_ADMIN', jti: 'missing-session' });
    const req = makeReq(`Bearer ${token}`);
    await run(req);
    expect(req.principal).toBeNull();
  });

  it("uses the user's current role from the database over a stale JWT claim", async () => {
    sessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-123',
      revokedAt: null,
      expiresAt: FUTURE,
      user: { status: 'ACTIVE', role: { code: 'DEPARTMENT_MANAGER' } },
    });
    const token = sign({ sub: 'user-123', roleCode: 'SYSTEM_ADMIN', jti: 'session-1' });
    const req = makeReq(`Bearer ${token}`);
    await run(req);
    expect(req.principal?.roleCode).toBe('DEPARTMENT_MANAGER');
  });
});
