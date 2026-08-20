import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { authenticator } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestUser } from './helpers/create-test-user';
import { issueTestSession } from './helpers/issue-session';

const PASSWORD = 'Correct-Horse-Battery-1';

/// Covers every scenario 03-security/01_AUTH.md's "Tests" list names: valid login,
/// invalid login, locked account, expired session, revoked session, MFA allow/deny, reset
/// token replay prevention — plus account suspension (listed under "Implement", tested
/// here since it's directly observable through login). Each mutating scenario (lockout,
/// suspend, MFA enrollment) uses its own disposable user (createTestUser) so this file can
/// run repeatedly without state leaking between runs.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('valid / invalid login', () => {
    it('logs in with correct credentials and issues an access + refresh token pair', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const res = await request(app.getHttpServer()).post('/auth/login').send({ username, password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
      expect(res.headers['set-cookie']?.[0]).toMatch(/refresh_token=/);
    });

    it('rejects a wrong password with a generic INVALID_CREDENTIALS (no enumeration signal)', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const res = await request(app.getHttpServer()).post('/auth/login').send({ username, password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects an unknown username with the SAME generic code as a wrong password', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ username: 'does-not-exist-at-all', password: 'whatever' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('creates a LOGIN audit record on a successful login', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      await request(app.getHttpServer()).post('/auth/login').send({ username, password: PASSWORD });
      const row = await prisma.auditLog.findFirst({ where: { action: 'LOGIN', result: 'SUCCESS' }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
    });
  });

  describe('locked account', () => {
    it('locks the account after AUTH_LOGIN_MAX_ATTEMPTS failed attempts (423) and rejects even the correct password while locked', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const maxAttempts = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? '5');

      let lastRes;
      for (let i = 0; i < maxAttempts; i++) {
        lastRes = await request(app.getHttpServer()).post('/auth/login').send({ username, password: 'wrong-password' });
      }
      expect(lastRes!.status).toBe(423);
      expect(lastRes!.body.error.code).toBe('ACCOUNT_LOCKED');

      const withCorrectPassword = await request(app.getHttpServer()).post('/auth/login').send({ username, password: PASSWORD });
      expect(withCorrectPassword.status).toBe(423);
    });
  });

  describe('account suspension', () => {
    it('rejects login for a suspended account (403 ACCOUNT_SUSPENDED) even with the correct password', async () => {
      const { id, username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const { token: adminToken } = await issueTestSession(prisma, 'admin');
      const suspendRes = await request(app.getHttpServer()).patch(`/users/${id}/suspend`).set('Authorization', `Bearer ${adminToken}`);
      expect(suspendRes.status).toBe(200);

      const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ username, password: PASSWORD });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('expired session', () => {
    it('treats a request bound to an expired session as unauthenticated', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const { token, sessionId } = await issueTestSession(prisma, username);
      await prisma.session.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });

      const res = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

  describe('revoked session', () => {
    it('explicitly revoking one session immediately invalidates it, and does not touch other sessions of the same user', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const sessionA = await issueTestSession(prisma, username);
      const sessionB = await issueTestSession(prisma, username);

      const revokeRes = await request(app.getHttpServer())
        .post(`/auth/sessions/${sessionA.sessionId}/revoke`)
        .set('Authorization', `Bearer ${sessionA.token}`);
      expect(revokeRes.status).toBe(201);

      const afterA = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${sessionA.token}`);
      expect(afterA.status).toBe(401);

      const afterB = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${sessionB.token}`);
      expect(afterB.status).toBe(200);
    });

    it('"revoke all sessions" kills every OTHER session for the user but keeps the caller\'s own current session alive', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const sessionA = await issueTestSession(prisma, username);
      const sessionB = await issueTestSession(prisma, username);

      const revokeAllRes = await request(app.getHttpServer())
        .post('/auth/sessions/revoke-all')
        .set('Authorization', `Bearer ${sessionA.token}`);
      expect(revokeAllRes.status).toBe(201);
      expect(revokeAllRes.body.revokedCount).toBe(1);

      const stillWorksA = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${sessionA.token}`);
      expect(stillWorksA.status).toBe(200);

      const revokedB = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${sessionB.token}`);
      expect(revokedB.status).toBe(401);
    });
  });

  describe('MFA allow/deny', () => {
    it('requires MFA on login once enrolled, accepts a correct code, rejects an incorrect one', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const { token } = await issueTestSession(prisma, username);

      const enrollRes = await request(app.getHttpServer()).post('/auth/mfa/enroll').set('Authorization', `Bearer ${token}`);
      expect(enrollRes.status).toBe(201);
      const { secret } = enrollRes.body;

      const confirmRes = await request(app.getHttpServer())
        .post('/auth/mfa/enroll/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: authenticator.generate(secret) });
      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.backupCodes).toHaveLength(8);

      const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ username, password: PASSWORD });
      expect(loginRes.status).toBe(201);
      expect(loginRes.body.mfaRequired).toBe(true);
      const { mfaToken } = loginRes.body;

      const denyRes = await request(app.getHttpServer()).post('/auth/mfa/login-verify').send({ mfaToken, code: '000000' });
      expect(denyRes.status).toBe(401);
      expect(denyRes.body.error.code).toBe('INVALID_MFA_CODE');

      const allowRes = await request(app.getHttpServer())
        .post('/auth/mfa/login-verify')
        .send({ mfaToken, code: authenticator.generate(secret) });
      expect(allowRes.status).toBe(201);
      expect(allowRes.body.accessToken).toBeTruthy();
    });
  });

  describe('password reset token replay prevention', () => {
    it('confirms once successfully, then rejects reusing the same token', async () => {
      const { username } = await createTestUser(prisma, 'CONSULTANT', PASSWORD);
      const user = await prisma.user.findUniqueOrThrow({ where: { username } });

      const requestRes = await request(app.getHttpServer()).post('/auth/password-reset/request').send({ email: user.email });
      expect(requestRes.status).toBe(201);
      const { devToken } = requestRes.body;
      expect(devToken).toBeTruthy();

      const firstConfirm = await request(app.getHttpServer())
        .post('/auth/password-reset/confirm')
        .send({ token: devToken, newPassword: 'New-Password-1' });
      expect(firstConfirm.status).toBe(201);

      const replay = await request(app.getHttpServer())
        .post('/auth/password-reset/confirm')
        .send({ token: devToken, newPassword: 'Another-Password-2' });
      expect(replay.status).toBe(409);
      expect(replay.body.error.code).toBe('INVALID_OR_USED_RESET_TOKEN');

      const loginWithNewPassword = await request(app.getHttpServer()).post('/auth/login').send({ username, password: 'New-Password-1' });
      expect(loginWithNewPassword.status).toBe(201);
    });

    it('always returns success shape for an unknown email (no enumeration) and no devToken', async () => {
      const res = await request(app.getHttpServer()).post('/auth/password-reset/request').send({ email: 'nobody-at-all@example.local' });
      expect(res.status).toBe(201);
      expect(res.body.devToken).toBeUndefined();
    });
  });
});
