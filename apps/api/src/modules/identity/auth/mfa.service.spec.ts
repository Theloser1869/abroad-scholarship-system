import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import { MfaService } from './mfa.service';

function makeConfig(): ConfigService {
  const values: Record<string, string> = {
    AUTH_MFA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    AUTH_MFA_ISSUER: 'Test Issuer',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('MfaService', () => {
  function makePrismaStub() {
    const mfaSecrets = new Map<string, { userId: string; secretCiphertext: string; enabled: boolean; confirmedAt: Date | null }>();
    const backupCodes: { id: string; userId: string; codeHash: string; usedAt: Date | null }[] = [];
    let nextId = 1;

    return {
      mfaSecret: {
        findUnique: jest.fn(async ({ where: { userId } }: any) => mfaSecrets.get(userId) ?? null),
        upsert: jest.fn(async ({ where: { userId }, update, create }: any) => {
          const row = mfaSecrets.has(userId) ? { ...mfaSecrets.get(userId)!, ...update } : { userId, ...create };
          mfaSecrets.set(userId, row);
          return row;
        }),
        update: jest.fn(async ({ where: { userId }, data }: any) => {
          const row = { ...mfaSecrets.get(userId)!, ...data };
          mfaSecrets.set(userId, row);
          return row;
        }),
      },
      mfaBackupCode: {
        deleteMany: jest.fn(async ({ where: { userId } }: any) => {
          for (let i = backupCodes.length - 1; i >= 0; i--) {
            if (backupCodes[i].userId === userId && !backupCodes[i].usedAt) backupCodes.splice(i, 1);
          }
          return { count: 0 };
        }),
        createMany: jest.fn(async ({ data }: any) => {
          for (const row of data) {
            backupCodes.push({ id: String(nextId++), usedAt: null, ...row });
          }
          return { count: data.length };
        }),
        findFirst: jest.fn(async ({ where: { userId, codeHash, usedAt } }: any) => {
          return backupCodes.find((c) => c.userId === userId && c.codeHash === codeHash && c.usedAt === usedAt) ?? null;
        }),
        update: jest.fn(async ({ where: { id }, data }: any) => {
          const row = backupCodes.find((c) => c.id === id)!;
          Object.assign(row, data);
          return row;
        }),
      },
      _backupCodes: backupCodes,
    };
  }

  it('enrolls, confirms with a valid TOTP code, and issues single-use backup codes', async () => {
    const prisma = makePrismaStub();
    const service = new MfaService(prisma as never, makeConfig());

    const { secret } = await service.startEnrollment('user-1', 'user1@example.com');
    const code = authenticator.generate(secret);

    const backupCodes = await service.confirmEnrollment('user-1', code);
    expect(backupCodes).toHaveLength(8);
    expect(await service.isEnabled('user-1')).toBe(true);

    const usedOnce = await service.consumeBackupCode('user-1', backupCodes[0]);
    expect(usedOnce).toBe(true);
    const usedTwice = await service.consumeBackupCode('user-1', backupCodes[0]);
    expect(usedTwice).toBe(false);
  });

  it('rejects confirmation with an invalid TOTP code and does not enable MFA', async () => {
    const prisma = makePrismaStub();
    const service = new MfaService(prisma as never, makeConfig());

    await service.startEnrollment('user-1', 'user1@example.com');
    const backupCodes = await service.confirmEnrollment('user-1', '000000');
    expect(backupCodes).toEqual([]);
    expect(await service.isEnabled('user-1')).toBe(false);
  });

  it('refuses to start a new enrollment while one is already enabled', async () => {
    const prisma = makePrismaStub();
    const service = new MfaService(prisma as never, makeConfig());

    const { secret } = await service.startEnrollment('user-1', 'user1@example.com');
    await service.confirmEnrollment('user-1', authenticator.generate(secret));

    await expect(service.startEnrollment('user-1', 'user1@example.com')).rejects.toMatchObject({
      response: { code: 'MFA_ALREADY_ENABLED' },
    });
  });

  it('verifyTotp returns false for a user with no enrolled secret', async () => {
    const prisma = makePrismaStub();
    const service = new MfaService(prisma as never, makeConfig());
    expect(await service.verifyTotp('nobody', '123456')).toBe(false);
  });
});
