import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { issueTestSession } from './helpers/issue-session';

/// 03-security/03_AUDIT.md tests: "every critical event creates audit", "failed
/// unauthorized actions are auditable where appropriate", "ordinary users cannot delete
/// logs". The query/filter capability itself (GET /audit-logs) is exercised here too —
/// see docs/ASSUMPTIONS.md ASM-08 for why there is no admin UI screen to test against,
/// only the API a UI would call.
describe('Audit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    ({ token: managerToken } = await issueTestSession(prisma, 'demo.manager'));
    ({ token: adminToken } = await issueTestSession(prisma, 'admin'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a VIEW audit record for reading a single student', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ fullName: 'Audit Test Subject' });
    const studentId = createRes.body.id;

    await request(app.getHttpServer()).get(`/students/${studentId}`).set('Authorization', `Bearer ${managerToken}`);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'VIEW', objectType: 'Students', objectId: studentId },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect(row?.result).toBe('SUCCESS');
    expect(row?.requestId).toBeTruthy();
  });

  it('creates an ARCHIVE audit record distinct from EDIT when a student is archived', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ fullName: 'Audit Archive Subject' });
    const studentId = createRes.body.id;

    const archiveRes = await request(app.getHttpServer()).patch(`/students/${studentId}/archive`).set('Authorization', `Bearer ${managerToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.archivedAt).toBeTruthy();

    const row = await prisma.auditLog.findFirst({ where: { action: 'ARCHIVE', objectType: 'Students', objectId: studentId } });
    expect(row).not.toBeNull();
  });

  it('records reason, row count and fields exported for an EXPORT (SRS 6.21)', async () => {
    const res = await request(app.getHttpServer())
      .get('/students/export')
      .query({ reason: 'Quarterly compliance review' })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rowCount).toBeGreaterThanOrEqual(1);

    const row = await prisma.auditLog.findFirst({ where: { action: 'EXPORT', actorId: (await prisma.user.findUniqueOrThrow({ where: { username: 'demo.manager' } })).id }, orderBy: { createdAt: 'desc' } });
    expect(row).not.toBeNull();
    const metadata = row?.metadata as { reason?: string; rowCount?: number; fields?: string[] } | null;
    expect(metadata?.reason).toBe('Quarterly compliance review');
    expect(metadata?.rowCount).toBe(res.body.rowCount);
    expect(metadata?.fields).toContain('studentCode');
  });

  it('rejects an EXPORT without a reason (400) before any audit-worthy action happens', async () => {
    const res = await request(app.getHttpServer()).get('/students/export').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  it('audits a DENIED attempt (permission check failure), not just successful ones', async () => {
    // `demo.sales`/`demo.finance` now hold `students:view` (client permission-matrix
    // remediation, 2026-08-25) — `admin` (SYSTEM_ADMIN) is the role with genuinely zero
    // `students` grant, matching rbac.e2e-spec.ts's own "NONE scope" coverage.
    const { token: adminToken } = await issueTestSession(prisma, 'admin');
    const res = await request(app.getHttpServer()).get('/students').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    // The `students` list endpoint itself is not @Audit-decorated (only single-record and
    // mutating routes are — see docs/api/API_CONVENTIONS.md section 7), so exercise a
    // decorated route to observe a DENIED audit row.
    const consultantB = await issueTestSession(prisma, 'demo.consultant.b');
    const studentA = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'HS-2026-90001' } });
    const deniedRes = await request(app.getHttpServer())
      .get(`/students/${studentA.id}`)
      .set('Authorization', `Bearer ${consultantB.token}`);
    expect(deniedRes.status).toBe(404);
    const row = await prisma.auditLog.findFirst({
      where: { actorId: consultantB.userId, objectType: 'Students', action: 'VIEW' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect(row?.result).toBe('ERROR');
  });

  // Phase 13 HIGH-fix regression — NestJS runs Guards strictly before Interceptors, so a
  // `@RequirePermission` denial thrown by `AuthGuard` (a 403, not a service-level 404) used
  // to never reach `AuditInterceptor`, leaving guard-level denials on `@Audit`-decorated
  // routes completely unaudited — contradicting SRS's blanket audit rule and AC-13. This
  // exercises a genuine guard-level 403 (Sales/Marketing holds zero `students` permission at
  // all, unlike the 404 case above which is a service-level scope denial past the guard).
  it('audits a guard-level 403 (role lacks the permission entirely), not just service-level scope denials', async () => {
    const { token: salesToken, userId: salesUserId } = await issueTestSession(prisma, 'demo.sales');
    const studentA = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'HS-2026-90001' } });

    const res = await request(app.getHttpServer()).patch(`/students/${studentA.id}/archive`).set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');

    const row = await prisma.auditLog.findFirst({
      where: { actorId: salesUserId, objectType: 'Students', action: 'ARCHIVE', objectId: studentA.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect(row?.result).toBe('DENIED');
  });

  describe('GET /audit-logs (query/filter capability for authorized admins)', () => {
    it('ALLOWS SYSTEM_ADMIN and filters by action', async () => {
      const res = await request(app.getHttpServer()).get('/audit-logs').query({ action: 'LOGIN', limit: 5 }).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const row of res.body.data) {
        expect(row.action).toBe('LOGIN');
      }
    });

    it('DENIES a role without audit_logs:view (e.g. DEPARTMENT_MANAGER)', async () => {
      const res = await request(app.getHttpServer()).get('/audit-logs').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('ordinary users cannot delete logs', () => {
    it('there is no DELETE route for audit logs at all, for any role including SYSTEM_ADMIN', async () => {
      const someLog = await prisma.auditLog.findFirstOrThrow();
      const res = await request(app.getHttpServer()).delete(`/audit-logs/${someLog.id}`).set('Authorization', `Bearer ${adminToken}`);
      // Nest returns 404 for an unmapped route (no @Delete handler exists on
      // AuditLogsController at all — see apps/api/src/modules/reporting/audit-logs).
      expect(res.status).toBe(404);
      const stillThere = await prisma.auditLog.findUnique({ where: { id: someLog.id } });
      expect(stillThere).not.toBeNull();
    });
  });
});
