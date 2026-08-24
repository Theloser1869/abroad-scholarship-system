import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { issueTestSession } from './helpers/issue-session';

/// 08-admission/01_MASTER_DATA.md: University/Program/ScholarshipMaster as GLOBAL,
/// permission-gated (not case-scoped) master data — duplicate prevention, master-data
/// curation permission separate from case-scoped transaction permission ("Consultant có
/// thể sử dụng Program nhưng không nhất thiết được chỉnh tuition"), source/verification
/// fields.
describe('Admission Master Data (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let consultantAToken: string;
  let salesToken: string;
  let financeToken: string;
  let studentSelfToken: string;

  let universityAId: string;
  let programAId: string;
  let scholarshipMasterAId: string;

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
    ({ token: consultantAToken } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const universityA = await prisma.university.findUniqueOrThrow({ where: { universityCode: 'UNI-2026-90001' } });
    universityAId = universityA.id;
    const programA = await prisma.program.findUniqueOrThrow({ where: { programCode: 'PRG-2026-90001' } });
    programAId = programA.id;
    const scholarshipMasterA = await prisma.scholarshipMaster.findUniqueOrThrow({ where: { scholarshipCode: 'SCHM-2026-90001' } });
    scholarshipMasterAId = scholarshipMasterA.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('University — CRUD + duplicate detection', () => {
    it('ED can create a university', async () => {
      const res = await request(app.getHttpServer())
        .post('/universities')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ officialName: `Test University ${randomUUID()}`, countryCode: 'GB', city: 'London' });
      expect(res.status).toBe(201);
      expect(res.body.universityCode).toMatch(/^UNI-\d{4}-\d{5}$/);
    });

    it('rejects a duplicate (official name, country) pair', async () => {
      const name = `Duplicate Univ ${randomUUID()}`;
      const first = await request(app.getHttpServer()).post('/universities').set('Authorization', `Bearer ${directorToken}`).send({ officialName: name, countryCode: 'CA' });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer()).post('/universities').set('Authorization', `Bearer ${directorToken}`).send({ officialName: name, countryCode: 'CA' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_UNIVERSITY');
    });

    it('everyone with view access sees the fixture university', async () => {
      for (const token of [directorToken, consultantAToken, salesToken, studentSelfToken]) {
        const res = await request(app.getHttpServer()).get(`/universities/${universityAId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('CONSULTANT can view but cannot create/edit master data (403)', async () => {
      const createRes = await request(app.getHttpServer()).post('/universities').set('Authorization', `Bearer ${consultantAToken}`).send({ officialName: `Nope ${randomUUID()}`, countryCode: 'US' });
      expect(createRes.status).toBe(403);
      const editRes = await request(app.getHttpServer()).patch(`/universities/${universityAId}`).set('Authorization', `Bearer ${consultantAToken}`).send({ city: 'Nope' });
      expect(editRes.status).toBe(403);
    });

    it('ADMIN_FINANCE has zero admission_master grant (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/universities/${universityAId}`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(403);
    });

    it('ED can verify a university, stamping lastVerifiedAt', async () => {
      const res = await request(app.getHttpServer()).post(`/universities/${universityAId}/verify`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(201);
      expect(res.body.lastVerifiedAt).not.toBeNull();
    });

    it('CONSULTANT cannot verify (403) — verification is master-data curation, not a view action', async () => {
      const res = await request(app.getHttpServer()).post(`/universities/${universityAId}/verify`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects an invalid ISO country code', async () => {
      const res = await request(app.getHttpServer()).post('/universities').set('Authorization', `Bearer ${directorToken}`).send({ officialName: `Bad Country ${randomUUID()}`, countryCode: 'ZZZ' });
      expect(res.status).toBe(400);
    });
  });

  describe('Program — must belong to a real University, duplicate detection', () => {
    it('ED can create a program under the fixture university', async () => {
      const res = await request(app.getHttpServer())
        .post('/programs')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ universityId: universityAId, degreeLevel: 'Master', major: `Data Science ${randomUUID()}`, tuitionCurrency: 'USD', tuition: 30000 });
      expect(res.status).toBe(201);
      expect(res.body.programCode).toMatch(/^PRG-\d{4}-\d{5}$/);
    });

    it('rejects a program referencing a non-existent university', async () => {
      const res = await request(app.getHttpServer())
        .post('/programs')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ universityId: randomUUID(), degreeLevel: 'Master', major: 'Nowhere' });
      expect(res.status).toBe(404);
    });

    it('rejects a duplicate (university, degree, major, intake) combination', async () => {
      const major = `Dup Major ${randomUUID()}`;
      const first = await request(app.getHttpServer()).post('/programs').set('Authorization', `Bearer ${directorToken}`).send({ universityId: universityAId, degreeLevel: 'Bachelor', major, intake: 'Fall 2027' });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer()).post('/programs').set('Authorization', `Bearer ${directorToken}`).send({ universityId: universityAId, degreeLevel: 'Bachelor', major, intake: 'Fall 2027' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_PROGRAM');
    });

    it('rejects an invalid (non-ISO4217) tuition currency', async () => {
      const res = await request(app.getHttpServer())
        .post('/programs')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ universityId: universityAId, degreeLevel: 'Bachelor', major: `Bad Currency ${randomUUID()}`, tuitionCurrency: 'XXXX' });
      expect(res.status).toBe(400);
    });

    it('list supports filtering by universityId', async () => {
      const res = await request(app.getHttpServer()).get('/programs').query({ universityId: universityAId, limit: 50 }).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((p: { id: string }) => p.id === programAId)).toBe(true);
    });

    /// DEC-11 — list/detail embed a University summary so a Program row can show which
    /// university it belongs to without a per-row N+1 fetch (mirrors DEC-09/DEC-10).
    it('list and detail embed the University summary (DEC-11)', async () => {
      const listRes = await request(app.getHttpServer()).get('/programs').query({ universityId: universityAId, limit: 50 }).set('Authorization', `Bearer ${consultantAToken}`);
      expect(listRes.status).toBe(200);
      const row = listRes.body.data.find((p: { id: string }) => p.id === programAId);
      expect(row.university).toEqual({ id: universityAId, officialName: expect.any(String), countryCode: expect.any(String) });

      const detailRes = await request(app.getHttpServer()).get(`/programs/${programAId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.university).toEqual({ id: universityAId, officialName: expect.any(String), countryCode: expect.any(String) });
    });
  });

  describe('ScholarshipMaster — separate from ScholarshipApplication, duplicate detection', () => {
    it('ED can create a scholarship master tied to the fixture university/program', async () => {
      const res = await request(app.getHttpServer())
        .post('/scholarship-masters')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ provider: 'Test Provider', name: `Test Scholarship ${randomUUID()}`, universityId: universityAId, programId: programAId, percentage: 25 });
      expect(res.status).toBe(201);
      expect(res.body.scholarshipCode).toMatch(/^SCHM-\d{4}-\d{5}$/);
    });

    it('rejects a duplicate (provider, name, university, program) combination', async () => {
      const name = `Dup Scholarship ${randomUUID()}`;
      const first = await request(app.getHttpServer())
        .post('/scholarship-masters')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ provider: 'Dup Provider', name, universityId: universityAId });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer())
        .post('/scholarship-masters')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ provider: 'Dup Provider', name, universityId: universityAId });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_SCHOLARSHIP_MASTER');
    });

    it('the fixture ScholarshipMaster is a master row, never a per-application copy', async () => {
      const res = await request(app.getHttpServer()).get(`/scholarship-masters/${scholarshipMasterAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.scholarshipCode).toBe('SCHM-2026-90001');
    });
  });

  describe('pagination / search', () => {
    it('universities list supports search and pagination', async () => {
      const res = await request(app.getHttpServer()).get('/universities').query({ search: 'RBAC Fixture', page: 1, limit: 10 }).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.data.some((u: { id: string }) => u.id === universityAId)).toBe(true);
    });
  });
});
