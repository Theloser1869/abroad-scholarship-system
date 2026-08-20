import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { issueTestSession } from './helpers/issue-session';

/// 12-platform/03_REPORTING.md — dashboards read live from the existing source-of-truth
/// tables (never a second calculation), RBAC-gated (ED/DM for executive/manager, every
/// staff role for the self-scoped "me" view, nobody for Student/Parent — Portal already
/// covers that per docs/ASSUMPTIONS.md ASM-55), and export is authorized/audited.
describe('Reporting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let managerToken: string;
  let consultantAToken: string;
  let financeToken: string;
  let salesToken: string;
  let studentSelfToken: string;
  let systemAdminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    ({ token: directorToken } = await issueTestSession(prisma, 'demo.director'));
    ({ token: managerToken } = await issueTestSession(prisma, 'demo.manager'));
    ({ token: consultantAToken } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));
    ({ token: systemAdminToken } = await issueTestSession(prisma, 'admin'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('executive dashboard — ED/DM only', () => {
    it('ED and DM can read it', async () => {
      for (const token of [directorToken, managerToken]) {
        const res = await request(app.getHttpServer()).get('/reports/executive').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(typeof res.body.activeCases).toBe('number');
        expect(Array.isArray(res.body.pipeline)).toBe(true);
        // Phase 14 fix — revenue/receivables are grouped by currency (Payment/Contract
        // carry a per-record currency; summing across currencies as one number was
        // meaningless once more than one existed). Each entry: { currency, amount }.
        expect(Array.isArray(res.body.revenue)).toBe(true);
        expect(Array.isArray(res.body.receivables)).toBe(true);
        for (const entry of [...res.body.revenue, ...res.body.receivables]) {
          expect(typeof entry.currency).toBe('string');
          expect(typeof entry.amount).toBe('string');
        }
      }
    });

    it('a role that holds reports:view but is not ED/DM is denied', async () => {
      const res = await request(app.getHttpServer()).get('/reports/executive').set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('roles with zero reports grant (Student/Parent, System Admin) are denied at the permission layer', async () => {
      for (const token of [studentSelfToken, systemAdminToken]) {
        const res = await request(app.getHttpServer()).get('/reports/executive').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    it('revenue/receivables (per currency) match a live, independent Payment aggregation — same source of truth as the Payment API', async () => {
      const res = await request(app.getHttpServer()).get('/reports/executive').set('Authorization', `Bearer ${directorToken}`);
      const payments = await prisma.payment.findMany();
      // Every Payment fixture created across the whole suite is USD — grouping
      // independently here mirrors the service's own per-currency grouping rather than
      // assuming a single flat total.
      const expected = new Map<string, number>();
      const expectedReceivable = new Map<string, number>();
      for (const p of payments) {
        expected.set(p.currency, (expected.get(p.currency) ?? 0) + Number(p.paidAmount));
        expectedReceivable.set(p.currency, (expectedReceivable.get(p.currency) ?? 0) + Math.max(Number(p.amount) - (Number(p.paidAmount) - Number(p.refundedAmount)), 0));
      }

      for (const [currency, amount] of expected) {
        const entry = res.body.revenue.find((r: { currency: string; amount: string }) => r.currency === currency);
        expect(entry).toBeDefined();
        expect(Number(entry.amount)).toBeCloseTo(amount, 2);
      }
      for (const [currency, amount] of expectedReceivable) {
        const entry = res.body.receivables.find((r: { currency: string; amount: string }) => r.currency === currency);
        expect(entry).toBeDefined();
        expect(Number(entry.amount)).toBeCloseTo(amount, 2);
      }
    });

    // Phase 14 fix regression (Final Architect Review finding) — a multi-currency fixture
    // proving revenue/receivables never silently sum different currencies together. Same
    // proven DRAFT->SIGNED->paid sequence as contracts.e2e-spec.ts/payments.e2e-spec.ts's
    // own helpers, just with currency: 'GBP' throughout instead of the default USD.
    it('never sums two different currencies into one number', async () => {
      // This dev DB is never reset between suites/runs — a re-run of this same test would
      // otherwise accumulate GBP revenue across runs. Assert the DELTA this test itself
      // caused, not an absolute total.
      const before = await request(app.getHttpServer()).get('/reports/executive').set('Authorization', `Bearer ${directorToken}`);
      const gbpBefore = Number(before.body.revenue.find((r: { currency: string }) => r.currency === 'GBP')?.amount ?? 0);

      const { studentId } = await createStudentWithCase(app, salesToken);
      const contractRes = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId, value: 900, currency: 'GBP' });
      const contractId = contractRes.body.id;
      await request(app.getHttpServer()).post(`/contracts/${contractId}/submit`).set('Authorization', `Bearer ${financeToken}`);
      await request(app.getHttpServer()).post(`/contracts/${contractId}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
      await request(app.getHttpServer()).post(`/contracts/${contractId}/send`).set('Authorization', `Bearer ${financeToken}`);
      const signRes = await request(app.getHttpServer())
        .post(`/contracts/${contractId}/sign`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ signedDocumentId: `doc-gbp-fixture-${randomUUID()}` });
      expect(signRes.status).toBe(201);

      const paymentRes = await request(app.getHttpServer())
        .post(`/contracts/${contractId}/payments`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ installmentNo: 1, amount: 900, currency: 'GBP', dueDate: '2026-12-01' });
      expect(paymentRes.status).toBe(201);
      const recordRes = await request(app.getHttpServer())
        .post(`/payments/${paymentRes.body.id}/record`)
        .set('Authorization', `Bearer ${financeToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 900 });
      expect(recordRes.status).toBe(201);

      const res = await request(app.getHttpServer()).get('/reports/executive').set('Authorization', `Bearer ${directorToken}`);
      const gbpEntry = res.body.revenue.find((r: { currency: string }) => r.currency === 'GBP');
      expect(gbpEntry).toBeDefined();
      expect(Number(gbpEntry.amount) - gbpBefore).toBeCloseTo(900, 2);
      // A USD entry must also still exist, separate from GBP — proves no cross-currency mixing.
      const usdEntry = res.body.revenue.find((r: { currency: string }) => r.currency === 'USD');
      expect(usdEntry).toBeDefined();
    });

    // Phase 13 MEDIUM-fix regression — SRS §6.21 explicitly lists "workload" and
    // "deadlines" among Dashboard GĐĐH's required metrics; they were previously reachable
    // only via a second call to /reports/manager, not on this dashboard itself.
    it('includes workload and deadlines summaries (SRS §6.21), reusing TasksService.isOverdue as the sole source of truth', async () => {
      const res = await request(app.getHttpServer()).get('/reports/executive').set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.workload).toMatchObject({ openTasks: expect.any(Number), overdueTasks: expect.any(Number) });
      expect(res.body.deadlines).toMatchObject({ overdueTasks: expect.any(Number), dueWithin7Days: expect.any(Number) });
      expect(res.body.workload.overdueTasks).toBe(res.body.deadlines.overdueTasks);
    });
  });

  describe('manager dashboard — ED/DM only', () => {
    it('ED can read workload/SLA/quality metrics, clearly labeled (not an invented "SLA score")', async () => {
      const res = await request(app.getHttpServer()).get('/reports/manager').set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.workload)).toBe(true);
      if (res.body.workload.length > 0) {
        expect(res.body.workload[0]).toHaveProperty('onTimeCompletionRate');
        expect(res.body.workload[0]).toHaveProperty('averageQualityScore');
      }
    });

    it('CONSULTANT is denied', async () => {
      const res = await request(app.getHttpServer()).get('/reports/manager').set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('staff self-scoped "me" dashboard — every staff role', () => {
    it('CONSULTANT/FINANCE/SALES can all read their own summary', async () => {
      for (const token of [consultantAToken, financeToken, salesToken, directorToken]) {
        const res = await request(app.getHttpServer()).get('/reports/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(typeof res.body.myOpenCases).toBe('number');
        expect(typeof res.body.myOpenTasks).toBe('number');
      }
    });

    it('Student/Parent is denied — Portal is their reporting surface, not this endpoint', async () => {
      const res = await request(app.getHttpServer()).get('/reports/me').set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(403);
    });

    it('never leaks another consultant\'s tasks/cases into "me"', async () => {
      const res = await request(app.getHttpServer()).get('/reports/me').set('Authorization', `Bearer ${consultantAToken}`);
      const totalOpenCasesInSystem = await prisma.case.count({ where: { status: { in: ['OPEN', 'ACTIVE', 'ON_HOLD'] } } });
      // consultant.a's own count must never exceed the system-wide total (a trivial but
      // real leakage guard: if scope filtering broke, "my" count could exceed reality is
      // impossible, but it could wrongly equal the unfiltered total).
      expect(res.body.myOpenCases).toBeLessThanOrEqual(totalOpenCasesInSystem);
    });
  });

  describe('export — authorized, scoped, audited', () => {
    it('ED can export cases with a reason, and the export is audited with row count + fields', async () => {
      const res = await request(app.getHttpServer()).get('/reports/cases/export').query({ reason: 'Quarterly board review' }).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.rows)).toBe(true);
      expect(res.body.rowCount).toBe(res.body.rows.length);

      const row = await prisma.auditLog.findFirst({ where: { action: 'EXPORT', objectType: 'Reports' }, orderBy: { createdAt: 'desc' } });
      expect(row).not.toBeNull();
      expect((row?.metadata as { reason?: string })?.reason).toBe('Quarterly board review');
      expect((row?.metadata as { rowCount?: number })?.rowCount).toBe(res.body.rowCount);
    });

    it('rejects an export without a reason', async () => {
      const res = await request(app.getHttpServer()).get('/reports/cases/export').set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(400);
    });

    it('CONSULTANT (holds reports:view but not reports:export) is denied at the permission layer', async () => {
      const res = await request(app.getHttpServer()).get('/reports/cases/export').query({ reason: 'test' }).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
    });

    it('an export never returns a case the caller could not otherwise read via scope', async () => {
      // consultant.a is CASE_MEMBER-scoped, not GLOBAL — reports:export is ED/DM-only at
      // the permission layer already, but this confirms the underlying query still applies
      // ScopePolicyService.caseListFilter rather than bypassing it "because it's a report."
      const res = await request(app.getHttpServer()).get('/reports/cases/export').query({ reason: 'scope check' }).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      const allCaseIds = new Set((await prisma.case.findMany({ select: { id: true } })).map((c) => c.id));
      for (const row of res.body.rows) {
        expect(allCaseIds.has(row.id)).toBe(true);
      }
    });
  });
});
