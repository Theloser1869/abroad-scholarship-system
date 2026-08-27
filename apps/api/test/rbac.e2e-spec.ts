import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestUser } from './helpers/create-test-user';
import { issueTestSession } from './helpers/issue-session';

/// 03-security/02_RBAC.md: "For every role test: allow + deny." This file is that matrix,
/// exercised against real HTTP endpoints and the real database — not just the
/// ScopePolicyService/FieldPolicyService unit tests (which check the mapping logic in
/// isolation). Fixtures come from database/seeds/seed.ts's RBAC section: Student A has a
/// Case that `demo.consultant.a` is a member of and `demo.consultant.b` is not, is
/// self-linked to `demo.student.self` and parent-linked to `demo.parent.linked`, while
/// `demo.parent.unlinked` and Student B are deliberately out of everyone's scope.
describe('RBAC allow/deny (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentAId: string;
  let studentBId: string;
  let caseAId: string;

  const tokenFor = async (username: string) => (await issueTestSession(prisma, username)).token;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const studentA = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'HS-2026-90001' } });
    const studentB = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'HS-2026-90002' } });
    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    studentAId = studentA.id;
    studentBId = studentB.id;
    caseAId = caseA.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GLOBAL scope (EXECUTIVE_DIRECTOR, DEPARTMENT_MANAGER)', () => {
    it.each(['demo.director', 'demo.manager'])('%s can read any student, in or out of any case', async (username) => {
      const token = await tokenFor(username);
      const resA = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      const resB = await request(app.getHttpServer()).get(`/students/${studentBId}`).set('Authorization', `Bearer ${token}`);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
    });
  });

  describe('CASE_MEMBER scope (CONSULTANT, DOCUMENT_SPECIALIST)', () => {
    it('ALLOWS a consultant who is a member of the case to read the student', async () => {
      const token = await tokenFor('demo.consultant.a');
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('DENIES a consultant who is NOT a member of that case, with 404 (not 403 — AC-02: existence must not be confirmed)', async () => {
      const token = await tokenFor('demo.consultant.b');
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('the same ALLOW/DENY pattern holds for the Cases endpoint', async () => {
      const memberToken = await tokenFor('demo.consultant.a');
      const nonMemberToken = await tokenFor('demo.consultant.b');
      const allowRes = await request(app.getHttpServer()).get(`/cases/${caseAId}`).set('Authorization', `Bearer ${memberToken}`);
      const denyRes = await request(app.getHttpServer()).get(`/cases/${caseAId}`).set('Authorization', `Bearer ${nonMemberToken}`);
      expect(allowRes.status).toBe(200);
      expect(denyRes.status).toBe(404);
    });

    it('a case-member-scoped list only returns students the caller is a member of', async () => {
      const token = await tokenFor('demo.consultant.a');
      const res = await request(app.getHttpServer()).get('/students').query({ limit: 100 }).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((s: { id: string }) => s.id);
      expect(ids).toContain(studentAId);
      expect(ids).not.toContain(studentBId);
    });
  });

  describe('OWN_STUDENT scope (STUDENT_PARENT: self and linked parent)', () => {
    it('ALLOWS the student to read their own record', async () => {
      const token = await tokenFor('demo.student.self');
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('ALLOWS a linked parent to read their child\'s record', async () => {
      const token = await tokenFor('demo.parent.linked');
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('DENIES an unlinked parent/student account (404)', async () => {
      const token = await tokenFor('demo.parent.unlinked');
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('DENIES the linked parent from reading an UNRELATED student (Student B)', async () => {
      const token = await tokenFor('demo.parent.linked');
      const res = await request(app.getHttpServer()).get(`/students/${studentBId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('NONE scope on students (SALES_MARKETING, ADMIN_FINANCE hold view-only students:view per the client permission matrix, but NONE record-scope; SYSTEM_ADMIN has no grant at all)', () => {
    /// Client permission-matrix remediation (2026-08-25) granted SALES_MARKETING/
    /// ADMIN_FINANCE a view-only `students:view` permission (sheet03 Phan_quyen_module:
    /// both = "Hạn chế", previously mis-seeded as zero) — but their record-SCOPE for
    /// Student stays `ScopeKind.NONE` (`scope-policy.service.ts` `ROLE_SCOPE`, unchanged).
    /// So the permission GUARD now passes (no longer 403), and the caller is denied at the
    /// scope layer instead — 404, per AC-02 ("a 403 would confirm the record exists").
    it.each(['demo.sales', 'demo.finance'])('%s passes the permission guard (students:view) but is denied at the NONE scope layer (404)', async (username) => {
      const token = await tokenFor(username);
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('SYSTEM_ADMIN is denied at the permission layer (403) — identity admin does not imply business-data access (SRS section 3), and it holds no students grant at all', async () => {
      const token = await tokenFor('admin');
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Field-level protection: Budget/Finance (SRS section 13)', () => {
    it('redacts budget for DOCUMENT_SPECIALIST and SALES_MARKETING-equivalent-denied roles, keeps it for roles with "V"/"Hạn chế"', async () => {
      const docSpecialistToken = await tokenFor('demo.docspecialist');
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${docSpecialistToken}`);
      expect(res.status).toBe(200);
      expect(res.body.budget).toBeNull();
      expect(res.body.budgetCurrency).toBeNull();

      const directorToken = await tokenFor('demo.director');
      const directorRes = await request(app.getHttpServer()).get(`/students/${studentAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(directorRes.body.budget).not.toBeNull();
    });
  });

  describe('Users admin resource — SYSTEM_ADMIN only', () => {
    it('ALLOWS SYSTEM_ADMIN to list users', async () => {
      const token = await tokenFor('admin');
      const res = await request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('ALLOWS EXECUTIVE_DIRECTOR read-only oversight (users:view) but DENIES suspend/offboard — separation of duties, SRS: System Admin alone owns User/Role/Permission', async () => {
      const token = await tokenFor('demo.director');
      const listRes = await request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);

      const { username } = await createTestUser(prisma, 'CONSULTANT', 'irrelevant-password-1');
      const targetUser = await prisma.user.findUniqueOrThrow({ where: { username } });
      const suspendRes = await request(app.getHttpServer()).patch(`/users/${targetUser.id}/suspend`).set('Authorization', `Bearer ${token}`);
      expect(suspendRes.status).toBe(403);
    });
  });
});
