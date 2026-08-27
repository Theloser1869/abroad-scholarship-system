import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { issueTestSession } from './helpers/issue-session';

/// 04-core-crm/02_STUDENT_CASE.md: assignment, collaborators, stage transitions, case
/// timeline, closure checks — plus the explicit "Cross-case isolation is mandatory" for
/// WRITES, not just the reads Phase 03's rbac.e2e-spec.ts already covers.
describe('Case management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;
  let consultantAToken: string; // OWNER of the Phase 03 seed fixture case
  let consultantAUserId: string;
  let consultantBToken: string; // not a member of anything
  let docSpecialistToken: string; // COLLABORATOR on the fixture case, not OWNER

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
    ({ token: consultantAToken, userId: consultantAUserId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: docSpecialistToken } = await issueTestSession(prisma, 'demo.docspecialist'));
  });

  afterAll(async () => {
    await app.close();
  });

  async function createStandaloneStudent(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ fullName: `Case Mgmt Test Student ${Date.now()}-${Math.random()}` });
    return res.body.id;
  }

  describe('creating a new Case for an existing Student', () => {
    it('creates a Case (OPEN) and adds the owner as an OWNER CaseMember', async () => {
      const studentId = await createStandaloneStudent();
      const res = await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ stage: 'ASSESSMENT' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.studentId).toBe(studentId);

      const members = await request(app.getHttpServer()).get(`/cases/${res.body.id}/members`).set('Authorization', `Bearer ${managerToken}`);
      expect(members.body).toHaveLength(1);
      expect(members.body[0].role).toBe('OWNER');
    });

    it('never creates a duplicate active Case for the same Student ("one lifecycle at a time")', async () => {
      const studentId = await createStandaloneStudent();
      const first = await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('DUPLICATE_ACTIVE_CASE');
      expect(second.body.error.existingCaseId).toBe(first.body.id);

      const count = await prisma.case.count({ where: { studentId } });
      expect(count).toBe(1);
    });

    it('allows a new Case once the previous one is closed', async () => {
      const studentId = await createStandaloneStudent();
      const first = await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      await request(app.getHttpServer())
        .post(`/cases/${first.body.id}/closure/handover`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ overrideReason: 'DEPARTMENT_MANAGER exercising the DEC-06 exception path in this test.' });
      await request(app.getHttpServer())
        .post(`/cases/${first.body.id}/closure/close`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ closureReason: 'Service completed for this lifecycle.', overrideReason: 'DEPARTMENT_MANAGER exercising the DEC-06 exception path in this test.' });

      const second = await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });
  });

  /// Phase F03 (frontend CRM) fix regression: `GET /cases` previously returned bare
  /// `studentId`/`ownerId` with no `studentId` filter at all — both added so the frontend's
  /// Student 360 view and Case list can work without an N+1 fetch or a full-table client
  /// scan (see `docs/DECISIONS.md`).
  describe('GET /cases — studentId filter + student/owner relation summaries (Phase F03 fix)', () => {
    it('includes a display-safe student/owner summary on both list and detail, never the full User row', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      const detail = await request(app.getHttpServer()).get(`/cases/${created.body.id}`).set('Authorization', `Bearer ${managerToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.student).toMatchObject({ id: studentId });
      expect(detail.body.student).toHaveProperty('fullName');
      expect(detail.body.owner).toHaveProperty('fullName');
      expect(detail.body.owner).not.toHaveProperty('passwordHash');

      const list = await request(app.getHttpServer())
        .get('/cases')
        .query({ studentId })
        .set('Authorization', `Bearer ${managerToken}`);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].id).toBe(created.body.id);
      expect(list.body.data[0].student.fullName).toBeDefined();
    });

    it('the studentId filter never bypasses scope — a non-member still sees zero rows for that student', async () => {
      const studentId = await createStandaloneStudent();
      await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      const asOutsider = await request(app.getHttpServer())
        .get('/cases')
        .query({ studentId })
        .set('Authorization', `Bearer ${consultantBToken}`); // not a member of this new case
      expect(asOutsider.status).toBe(200);
      expect(asOutsider.body.data).toHaveLength(0);
    });

    it('GET /cases/:id/members includes a display-safe user summary per member, never the full User row', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer())
        .post(`/students/${studentId}/cases`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      const members = await request(app.getHttpServer()).get(`/cases/${created.body.id}/members`).set('Authorization', `Bearer ${managerToken}`);
      expect(members.status).toBe(200);
      expect(members.body).toHaveLength(1);
      expect(members.body[0].user).toHaveProperty('fullName');
      expect(members.body[0].user).not.toHaveProperty('passwordHash');
    });
  });

  describe('stage and status transitions', () => {
    it('updates the (sheet08-controlled-enum, REQ-CASE-016) stage', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      const res = await request(app.getHttpServer())
        .patch(`/cases/${created.body.id}/stage`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ stage: 'ROADMAP', department: 'counseling' });
      expect(res.status).toBe(200);
      expect(res.body.stage).toBe('ROADMAP');
      expect(res.body.department).toBe('counseling');
    });

    it('rejects an invalid stage value (no longer free text)', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      const res = await request(app.getHttpServer())
        .patch(`/cases/${created.body.id}/stage`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ stage: 'not_a_real_stage' });
      expect(res.status).toBe(400);
    });

    it('walks the legal status chain OPEN -> ACTIVE -> ON_HOLD -> ACTIVE -> COMPLETED -> ARCHIVED', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      for (const status of ['ACTIVE', 'ON_HOLD', 'ACTIVE', 'COMPLETED', 'ARCHIVED']) {
        const res = await request(app.getHttpServer())
          .patch(`/cases/${created.body.id}/status`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
    });

    it('rejects an illegal jump (OPEN -> COMPLETED directly)', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      const res = await request(app.getHttpServer())
        .patch(`/cases/${created.body.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejects setting status to CLOSED directly via the generic status route (400 DTO validation — only close() may do it)', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      const res = await request(app.getHttpServer())
        .patch(`/cases/${created.body.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CLOSED' });
      expect(res.status).toBe(400);
    });
  });

  /// Client Acceptance Remediation DEC-06/07/08 (2026-08-26) — closure moved to the unified
  /// `ClosureService` (`POST /cases/:id/closure/close`). Full precondition/RBAC/override/
  /// liquidation coverage lives in `case-closure.e2e-spec.ts` and
  /// `pre-departure-enrollment-closure.e2e-spec.ts`; this block keeps only the two
  /// Case-status-machine-level assertions this file already owned.
  describe('closure checks', () => {
    it('requires a closure reason (400 DTO validation without one)', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      const res = await request(app.getHttpServer())
        .post(`/cases/${created.body.id}/closure/close`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ overrideReason: 'DEPARTMENT_MANAGER exercising the DEC-06 exception path in this test.' });
      expect(res.status).toBe(400);
    });

    it('closes successfully with a reason once handover is confirmed, setting closedAt', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      const overrideReason = 'DEPARTMENT_MANAGER exercising the DEC-06 exception path in this test.';
      await request(app.getHttpServer())
        .post(`/cases/${created.body.id}/closure/handover`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ overrideReason });
      const res = await request(app.getHttpServer())
        .post(`/cases/${created.body.id}/closure/close`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ closureReason: 'Student enrolled successfully.', overrideReason });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CLOSED');
      expect(res.body.closureReason).toBe('Student enrolled successfully.');
      expect(res.body.closedAt).toBeTruthy();
    });
  });

  describe('collaborators — OWNER-only management, cross-case isolation on writes', () => {
    it('DENIES a non-member from adding a collaborator to a case (404 — cannot even see it exists)', async () => {
      const seedCase = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
      const target = await createStandaloneStudent();
      const res = await request(app.getHttpServer())
        .post(`/cases/${seedCase.id}/members`)
        .set('Authorization', `Bearer ${consultantBToken}`)
        .send({ userId: target, role: 'COLLABORATOR' });
      expect(res.status).toBe(404);
    });

    it('DENIES a COLLABORATOR (not OWNER) from adding another member — must be the case OWNER', async () => {
      const seedCase = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
      const { userId: someOtherUserId } = await issueTestSession(prisma, 'demo.sales');
      const res = await request(app.getHttpServer())
        .post(`/cases/${seedCase.id}/members`)
        .set('Authorization', `Bearer ${docSpecialistToken}`) // COLLABORATOR on this case, not OWNER
        .send({ userId: someOtherUserId, role: 'COLLABORATOR' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('ALLOWS the case OWNER to add and then remove a collaborator', async () => {
      const seedCase = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
      const newMemberUserId = (await issueTestSession(prisma, 'demo.finance')).userId;

      const addRes = await request(app.getHttpServer())
        .post(`/cases/${seedCase.id}/members`)
        .set('Authorization', `Bearer ${consultantAToken}`) // OWNER
        .send({ userId: newMemberUserId, role: 'COLLABORATOR' });
      expect(addRes.status).toBe(201);

      const removeRes = await request(app.getHttpServer())
        .delete(`/cases/${seedCase.id}/members/${newMemberUserId}`)
        .set('Authorization', `Bearer ${consultantAToken}`);
      expect(removeRes.status).toBe(200);

      const membership = await prisma.caseMember.findUnique({ where: { caseId_userId: { caseId: seedCase.id, userId: newMemberUserId } } });
      expect(membership?.removedAt).not.toBeNull();
    });

    // Phase 13 MEDIUM-fix regression — `addMember(role: OWNER)` alone left two co-existing
    // OWNER rows and a stale `Case.ownerId`; `reassignOwner` must demote every prior OWNER
    // and update `Case.ownerId` atomically. Uses a fresh case (never the shared seed
    // fixture other spec files depend on consultantA owning).
    it('reassigns the case owner: demotes the prior OWNER to COLLABORATOR and updates Case.ownerId', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});
      const caseId = created.body.id;
      expect(created.body.ownerId).not.toBe(consultantAUserId);

      const reassignRes = await request(app.getHttpServer())
        .post(`/cases/${caseId}/reassign-owner`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ userId: consultantAUserId });
      expect(reassignRes.status).toBe(201);
      expect(reassignRes.body.ownerId).toBe(consultantAUserId);

      const members = await request(app.getHttpServer()).get(`/cases/${caseId}/members`).set('Authorization', `Bearer ${managerToken}`);
      const owners = members.body.filter((m: { role: string }) => m.role === 'OWNER');
      expect(owners).toHaveLength(1);
      expect(owners[0].userId).toBe(consultantAUserId);

      const stored = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
      expect(stored.ownerId).toBe(consultantAUserId);
    });

    it('DENIES a non-member from updating stage/status (cross-case isolation on writes)', async () => {
      const seedCase = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
      // A VALID enum value on purpose — this test proves the scope check (404) fires, not
      // DTO validation (400); an invalid value would be rejected before the scope check ever ran.
      const stageRes = await request(app.getHttpServer())
        .patch(`/cases/${seedCase.id}/stage`)
        .set('Authorization', `Bearer ${consultantBToken}`)
        .send({ stage: 'ARCHIVE' });
      expect(stageRes.status).toBe(404);

      // The case must be completely untouched by the denied attempt.
      const stillOpen = await prisma.case.findUniqueOrThrow({ where: { id: seedCase.id } });
      expect(stillOpen.stage).not.toBe('ARCHIVE');
      expect(stillOpen.status).not.toBe('CLOSED');
    });

    /// Client Acceptance Remediation DEC-06 (2026-08-26) — CONSULTANT has no
    /// `case-closure:execute` grant at all (standard closure is HCTH-only; CONSULTANT may
    /// only `request`), so a non-member consultant is denied at the permission-guard layer
    /// (403) before the case-ownership scope check ever runs — unlike `stage`/`status`
    /// above, which CONSULTANT does hold a role-level grant for.
    it('DENIES closing the case to a CONSULTANT entirely (403, no case-closure:execute grant)', async () => {
      const seedCase = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
      const closeRes = await request(app.getHttpServer())
        .post(`/cases/${seedCase.id}/closure/close`)
        .set('Authorization', `Bearer ${consultantBToken}`)
        .send({ closureReason: 'unauthorized attempt' });
      expect(closeRes.status).toBe(403);

      const stillOpen = await prisma.case.findUniqueOrThrow({ where: { id: seedCase.id } });
      expect(stillOpen.status).not.toBe('CLOSED');
    });
  });

  describe('notes + timeline', () => {
    it('records a note visible on the case timeline alongside audit events', async () => {
      const studentId = await createStandaloneStudent();
      const created = await request(app.getHttpServer()).post(`/students/${studentId}/cases`).set('Authorization', `Bearer ${managerToken}`).send({});

      const noteRes = await request(app.getHttpServer())
        .post(`/cases/${created.body.id}/notes`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ body: 'Kickoff call completed.' });
      expect(noteRes.status).toBe(201);

      const timelineRes = await request(app.getHttpServer()).get(`/cases/${created.body.id}/timeline`).set('Authorization', `Bearer ${managerToken}`);
      expect(timelineRes.status).toBe(200);
      expect(timelineRes.body.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(['NOTE', 'AUDIT']));
    });
  });

  describe('audit', () => {
    it('creates an ASSIGN audit record when a member is added', async () => {
      const seedCase = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
      const memberUserId = (await issueTestSession(prisma, 'admin')).userId;
      await request(app.getHttpServer())
        .post(`/cases/${seedCase.id}/members`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ userId: memberUserId, role: 'COLLABORATOR' });

      const row = await prisma.auditLog.findFirst({
        where: { action: 'ASSIGN', objectType: 'Cases', objectId: seedCase.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      expect(row?.result).toBe('SUCCESS');
    });
  });

  it("consultant A's owned-case membership is unaffected by another consultant's separate fixture", async () => {
    // Sanity check that the shared seed fixture (Phase 03) still reflects consultant A as
    // OWNER after all the mutation tests above ran against OTHER cases.
    const seedCase = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    const membership = await prisma.caseMember.findUnique({ where: { caseId_userId: { caseId: seedCase.id, userId: consultantAUserId } } });
    expect(membership?.role).toBe('OWNER');
    expect(membership?.removedAt).toBeNull();
  });
});
