import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { issueTestSession } from './helpers/issue-session';

/// 04-core-crm/01_LEAD.md + 02_STUDENT_CASE.md: the Lead → Student → Case chain, duplicate
/// detection, status transitions, and Case ownership that conversion creates. Uses
/// `demo.sales` (SALES_MARKETING, OWN_LEAD scope) as the primary actor — matches who
/// actually runs this flow per docs/security/RBAC_MATRIX.md.
describe('Lead conversion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let salesToken: string;
  let salesUserId: string;
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

    ({ token: salesToken, userId: salesUserId } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: managerToken } = await issueTestSession(prisma, 'demo.manager'));
  });

  afterAll(async () => {
    await app.close();
  });

  async function createLead(overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ contactName: 'E2E Lead Contact', email: `lead-${Date.now()}-${Math.random()}@example.local`, ...overrides });
    expect(res.status).toBe(201);
    return res.body;
  }

  it('creates a Lead with status NEW and the creating user as owner by default', async () => {
    const lead = await createLead();
    expect(lead.status).toBe('NEW');
    expect(lead.ownerId).toBe(salesUserId);
    expect(lead.leadCode).toMatch(/^LEAD-\d{4}-\d{5}$/);
  });

  /// Phase F03 (frontend CRM) fix regression: `GET /leads`/`GET /leads/:id` previously
  /// returned bare `ownerId` with no way to show the owner's name without an N+1 fetch.
  it('GET /leads and GET /leads/:id include a display-safe owner summary, never the full User row', async () => {
    const lead = await createLead();

    const detail = await request(app.getHttpServer()).get(`/leads/${lead.id}`).set('Authorization', `Bearer ${salesToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.owner).toMatchObject({ id: salesUserId });
    expect(detail.body.owner).toHaveProperty('fullName');
    expect(detail.body.owner).not.toHaveProperty('passwordHash');

    const list = await request(app.getHttpServer()).get('/leads').query({ ownerId: salesUserId }).set('Authorization', `Bearer ${salesToken}`);
    expect(list.status).toBe(200);
    const found = list.body.data.find((l: { id: string }) => l.id === lead.id);
    expect(found.owner.fullName).toBeDefined();
  });

  describe('status transitions', () => {
    it('walks the legal chain NEW -> CONTACTED -> QUALIFIED -> CONSULTATION -> CONTRACTING', async () => {
      const lead = await createLead();
      for (const status of ['CONTACTED', 'QUALIFIED', 'CONSULTATION', 'CONTRACTING']) {
        const res = await request(app.getHttpServer())
          .patch(`/leads/${lead.id}/status`)
          .set('Authorization', `Bearer ${salesToken}`)
          .send({ status });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
    });

    it('rejects an illegal jump (NEW -> CONTRACTING directly)', async () => {
      const lead = await createLead();
      const res = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'CONTRACTING' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejects setting status to CONVERTED directly (only convert() may do that) — 400 DTO validation', async () => {
      const lead = await createLead();
      const res = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'CONVERTED' });
      expect(res.status).toBe(400);
    });

    it('allows moving straight to LOST from any active state', async () => {
      const lead = await createLead();
      const res = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'LOST' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('LOST');
    });
  });

  it('reassigns ownership via PATCH :id/assign', async () => {
    const lead = await createLead();
    const { userId: managerUserId } = await issueTestSession(prisma, 'demo.manager');
    const res = await request(app.getHttpServer())
      .patch(`/leads/${lead.id}/assign`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ ownerId: managerUserId });
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(managerUserId);
  });

  describe('conversion — Student identity + Case ownership', () => {
    async function progressToContracting(leadId: string) {
      for (const status of ['CONTACTED', 'QUALIFIED', 'CONSULTATION', 'CONTRACTING']) {
        await request(app.getHttpServer()).patch(`/leads/${leadId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status });
      }
    }

    it('creates a new Student + Case and marks the Lead CONVERTED when there is no duplicate', async () => {
      const unique = `${Date.now()}-${Math.random()}`;
      const email = `unique-${unique}@example.local`;
      // Name is unique per run too, not just email — the duplicate matcher also checks
      // fullName+DOB, and this test's dateOfBirth is a fixed value, so a repeat run
      // against a persistent (non-reset) database must not collide with a Student left
      // over from a previous run of this exact test.
      const lead = await createLead({ email, contactName: `Brand New Contact ${unique}` });
      await progressToContracting(lead.id);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ dateOfBirth: '2007-05-01' });

      expect(res.status).toBe(201);
      expect(res.body.merged).toBe(false);
      expect(res.body.student.studentCode).toMatch(/^HS-\d{4}-\d{5}$/);
      expect(res.body.case.caseCode).toMatch(/^CASE-\d{4}-\d{5}$/);

      const leadAfter = await request(app.getHttpServer()).get(`/leads/${lead.id}`).set('Authorization', `Bearer ${salesToken}`);
      expect(leadAfter.body.status).toBe('CONVERTED');
      expect(leadAfter.body.convertedStudentId).toBe(res.body.student.id);

      // The Case owner (defaults to the Lead's owner) must be an OWNER CaseMember —
      // verified directly against the database, not just the API response.
      const membership = await prisma.caseMember.findUnique({
        where: { caseId_userId: { caseId: res.body.case.id, userId: salesUserId } },
      });
      expect(membership?.role).toBe('OWNER');
    });

    it('never creates a duplicate Student — blocks with candidates when email matches an existing Student', async () => {
      const email = `dup-${Date.now()}@example.local`;
      const first = await createLead({ email, contactName: 'First Contact' });
      await progressToContracting(first.id);
      const firstConvert = await request(app.getHttpServer())
        .post(`/leads/${first.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({});
      expect(firstConvert.status).toBe(201);
      const existingStudentId = firstConvert.body.student.id;

      const second = await createLead({ email, contactName: 'Second Contact Same Email' });
      await progressToContracting(second.id);
      const secondConvert = await request(app.getHttpServer())
        .post(`/leads/${second.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({});
      expect(secondConvert.status).toBe(409);
      expect(secondConvert.body.error.code).toBe('DUPLICATE_STUDENT_CANDIDATES');
      expect(secondConvert.body.error.candidates.map((c: { id: string }) => c.id)).toContain(existingStudentId);

      // No new Student was created by the blocked attempt.
      const countWithEmail = await prisma.student.count({ where: { email } });
      expect(countWithEmail).toBe(1);
      const leadStillOpen = await prisma.lead.findUniqueOrThrow({ where: { id: second.id } });
      expect(leadStillOpen.status).toBe('CONTRACTING');
    });

    it('merges into the existing Student (and reuses its active Case, not a new one) when confirmMatch=MERGE', async () => {
      const email = `merge-${Date.now()}@example.local`;
      const first = await createLead({ email, contactName: 'Merge Target Contact' });
      await progressToContracting(first.id);
      const firstConvert = await request(app.getHttpServer())
        .post(`/leads/${first.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({});
      const existingStudentId = firstConvert.body.student.id;
      const existingCaseId = firstConvert.body.case.id;

      const second = await createLead({ email, contactName: 'Merge Source Contact' });
      await progressToContracting(second.id);
      const mergeRes = await request(app.getHttpServer())
        .post(`/leads/${second.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ confirmMatch: 'MERGE', mergeIntoStudentId: existingStudentId });

      expect(mergeRes.status).toBe(201);
      expect(mergeRes.body.merged).toBe(true);
      expect(mergeRes.body.student.id).toBe(existingStudentId);
      // "Không tạo duplicate Case cho cùng một lifecycle" — the already-active Case is
      // reused, not duplicated.
      expect(mergeRes.body.case.id).toBe(existingCaseId);

      const countWithEmail = await prisma.student.count({ where: { email } });
      expect(countWithEmail).toBe(1);
    });

    it('honors an explicit CREATE_NEW override despite a detected duplicate', async () => {
      const email = `override-${Date.now()}@example.local`;
      const first = await createLead({ email, contactName: 'Override Contact 1' });
      await progressToContracting(first.id);
      await request(app.getHttpServer()).post(`/leads/${first.id}/convert`).set('Authorization', `Bearer ${salesToken}`).send({});

      const second = await createLead({ email, contactName: 'Override Contact 2' });
      await progressToContracting(second.id);
      const res = await request(app.getHttpServer())
        .post(`/leads/${second.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ confirmMatch: 'CREATE_NEW' });

      expect(res.status).toBe(201);
      expect(res.body.merged).toBe(false);
      const countWithEmail = await prisma.student.count({ where: { email } });
      expect(countWithEmail).toBe(2);
    });

    it('rejects converting an already-converted lead', async () => {
      const lead = await createLead();
      await progressToContracting(lead.id);
      await request(app.getHttpServer()).post(`/leads/${lead.id}/convert`).set('Authorization', `Bearer ${salesToken}`).send({});

      const secondAttempt = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({});
      expect(secondAttempt.status).toBe(409);
      expect(secondAttempt.body.error.code).toBe('LEAD_ALREADY_CONVERTED');
    });

    it('rejects converting a lost lead', async () => {
      const lead = await createLead();
      await request(app.getHttpServer()).patch(`/leads/${lead.id}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'LOST' });
      const res = await request(app.getHttpServer()).post(`/leads/${lead.id}/convert`).set('Authorization', `Bearer ${salesToken}`).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAD_LOST');
    });
  });

  describe('notes + timeline', () => {
    it('records a note and surfaces it, merged with audit events, on the timeline', async () => {
      const lead = await createLead();
      const noteRes = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/notes`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ body: 'Called the family, interested in Fall intake.' });
      expect(noteRes.status).toBe(201);

      const timelineRes = await request(app.getHttpServer()).get(`/leads/${lead.id}/timeline`).set('Authorization', `Bearer ${salesToken}`);
      expect(timelineRes.status).toBe(200);
      const types = timelineRes.body.map((e: { type: string }) => e.type);
      expect(types).toContain('NOTE');
      expect(types).toContain('AUDIT');
    });
  });

  describe('permission / scope (OWN_LEAD)', () => {
    it('a different SALES_MARKETING user cannot read a lead they do not own (404)', async () => {
      const lead = await createLead();
      const { token: otherSalesToken } = await issueTestSession(prisma, 'demo.sales.b');
      const res = await request(app.getHttpServer()).get(`/leads/${lead.id}`).set('Authorization', `Bearer ${otherSalesToken}`);
      expect(res.status).toBe(404);
    });

    it('a role with no leads grant is denied at the permission layer (403)', async () => {
      const { token: consultantToken } = await issueTestSession(prisma, 'demo.consultant.a');
      const res = await request(app.getHttpServer()).get('/leads').set('Authorization', `Bearer ${consultantToken}`);
      expect(res.status).toBe(403);
    });

    it('GLOBAL-scope roles (manager) can read a lead they do not own', async () => {
      const lead = await createLead();
      const res = await request(app.getHttpServer()).get(`/leads/${lead.id}`).set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });
  });
});
