import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EXPORT_ROW_CAP } from '../src/common/export/export-row-cap';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { issueTestSession } from './helpers/issue-session';

/// Integration test — real NestJS app instance + the real Postgres container started by
/// docker-compose.yml, through Prisma. No mocking of the database or HTTP layer: this is
/// what 02_API_FOUNDATION.md's "authentication context / authorization context / error
/// contract / pagination / idempotency" conventions look like end-to-end, using the
/// `students` reference endpoints as the vehicle. Role/scope ALLOW-vs-DENY coverage lives
/// in apps/api/test/rbac.e2e-spec.ts — this file focuses on the API-foundation
/// conventions, using `demo.manager` (DEPARTMENT_MANAGER, GLOBAL scope) as "a role that
/// can do everything on this resource". Requires `docker compose up -d`, migrations
/// applied and the foundation+RBAC-fixture seed run before executing.
describe('Students (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies an unauthenticated request with a 401 error contract', async () => {
    const res = await request(app.getHttpServer()).get('/students');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.requestId).toBeTruthy();
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
  });

  it('denies an authenticated caller whose role lacks the permission (403)', async () => {
    // `demo.sales` (SALES_MARKETING) now holds `students:view` (client permission-matrix
    // remediation, 2026-08-25) — `admin` (SYSTEM_ADMIN) is a role with genuinely zero
    // `students` grant, same choice `rbac.e2e-spec.ts`'s "NONE scope" block uses.
    const { token: adminToken } = await issueTestSession(prisma, 'admin');
    const res = await request(app.getHttpServer()).get('/students').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('rejects a payload that fails DTO validation (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'not-a-valid-email', fullName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('creates a student with a generated HS-YYYY-NNNNN business code, then reads it back', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ fullName: 'Nguyen Van A', targetCountry: 'us', budget: 50000, budgetCurrency: 'USD' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.studentCode).toMatch(/^HS-\d{4}-\d{5}$/);
    expect(createRes.body.targetCountry).toBe('US');

    const getRes = await request(app.getHttpServer())
      .get(`/students/${createRes.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.studentCode).toBe(createRes.body.studentCode);

    const auditRow = await prisma.auditLog.findFirst({
      where: { objectType: 'Students', objectId: createRes.body.id, action: 'CREATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.result).toBe('SUCCESS');
  });

  it('lists students with pagination metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/students')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
    expect(res.body.meta.totalItems).toBeGreaterThanOrEqual(1);
  });

  // Phase 13 CRITICAL fix regression — `StudentsService.list` used to flat-spread the
  // `search` filter's top-level `OR` key over `studentListFilter`'s OWN_STUDENT `OR` key,
  // silently overwriting (not narrowing) the scope filter, so a STUDENT_PARENT calling
  // `?search=` could enumerate every student in the system, not just their own linked
  // child. Verified against the RBAC fixture graph: `demo.parent.linked` is linked only to
  // HS-2026-90001 ("RBAC Fixture Student A..."); HS-2026-90002 ("RBAC Fixture Student
  // B...") is unrelated and must never appear in this parent's results, search or no.
  it('never leaks an unlinked student to a STUDENT_PARENT via ?search=, even with a matching substring', async () => {
    const { token: parentToken } = await issueTestSession(prisma, 'demo.parent.linked');

    const unscoped = await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(unscoped.status).toBe(200);
    const unscopedCodes = unscoped.body.data.map((s: { studentCode: string }) => s.studentCode);
    expect(unscopedCodes).toContain('HS-2026-90001');
    expect(unscopedCodes).not.toContain('HS-2026-90002');

    const searched = await request(app.getHttpServer())
      .get('/students')
      .query({ search: 'RBAC Fixture Student' })
      .set('Authorization', `Bearer ${parentToken}`);
    expect(searched.status).toBe(200);
    const searchedCodes = searched.body.data.map((s: { studentCode: string }) => s.studentCode);
    expect(searchedCodes).toContain('HS-2026-90001');
    expect(searchedCodes).not.toContain('HS-2026-90002');
  });

  it('rejects an unknown sort field with a 400 error contract', async () => {
    const res = await request(app.getHttpServer())
      .get('/students')
      .query({ sort: 'passportNumber:asc' })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SORT');
  });

  it('replays the stored response for a repeated Idempotency-Key instead of creating a duplicate', async () => {
    const idempotencyKey = `test-idem-${Date.now()}`;
    // Unique per test run so repeated suite executions can't accumulate false positives
    // against a fixed name — the assertion below must reflect only this run's requests.
    const payload = { fullName: `Idempotent Student ${idempotencyKey}` };

    const first = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const countWithThatName = await prisma.student.count({ where: { fullName: payload.fullName } });
    expect(countWithThatName).toBe(1);
  });

  it('rejects reusing the same Idempotency-Key with a different body (409)', async () => {
    const idempotencyKey = `test-idem-conflict-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ fullName: 'First Body' });

    const res = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ fullName: 'Different Body' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('echoes a caller-supplied X-Request-Id back on the response', async () => {
    const res = await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('X-Request-Id', 'my-fixed-request-id');
    expect(res.headers['x-request-id']).toBe('my-fixed-request-id');
  });

  /// Client Acceptance Remediation GAP-001 (CRITICAL) — export must be authorized, audited
  /// with a mandatory reason, and hard-capped server-side (never unbounded). Same pattern
  /// already covered for /contracts/export and /payments/export.
  describe('export — reason required, row-capped, audited (SRS 6.21, GAP-001)', () => {
    it('rejects export without a reason (400)', async () => {
      const res = await request(app.getHttpServer()).get('/students/export').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });

    it('denies a role without the students:export grant (403)', async () => {
      const { token: salesToken } = await issueTestSession(prisma, 'demo.sales');
      const res = await request(app.getHttpServer()).get('/students/export').query({ reason: 'attempt' }).set('Authorization', `Bearer ${salesToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('records reason, row count and fields exported for a Student EXPORT, within the cap', async () => {
      const reason = `E2E export check ${Date.now()}`;
      const res = await request(app.getHttpServer()).get('/students/export').query({ reason }).set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.rowCount).toBe(res.body.rows.length);
      expect(res.body.rowCount).toBeLessThanOrEqual(EXPORT_ROW_CAP);

      const auditRow = await prisma.auditLog.findFirst({
        where: { action: 'EXPORT', objectType: 'Students' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.result).toBe('SUCCESS');
      const metadata = auditRow?.metadata as { reason?: string; rowCount?: number } | null;
      expect(metadata?.reason).toBe(reason);
      expect(metadata?.rowCount).toBe(res.body.rowCount);
    });

    /// Deliberately NOT tested here with a live 5000+ row insert: this e2e suite runs in
    /// parallel Jest workers against ONE shared local Postgres instance (no per-suite
    /// transaction isolation), and `managerToken` (DEPARTMENT_MANAGER, GLOBAL scope) is
    /// reused by several other suites (e.g. audit.e2e-spec.ts's own export test). A
    /// temporary bulk-insert fixture here was tried and confirmed to leak into a
    /// concurrently-running suite's assertions (that suite's export unexpectedly received
    /// 409 while this fixture existed) — inserting-then-deleting thousands of rows around a
    /// GLOBAL-scope query is not safe in this test architecture. The exactly-at-cap and
    /// one-over-cap behavior of `enforceExportRowCap` itself is fully covered instead by
    /// `export-row-cap.spec.ts` (pure unit test, no shared state); this e2e suite only
    /// proves the endpoint is wired to call it (via the "within the cap" test above) and
    /// that the resulting error shape/code would be `EXPORT_ROW_LIMIT_EXCEEDED` (proven at
    /// the unit level).
  });
});
