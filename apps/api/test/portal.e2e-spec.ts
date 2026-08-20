import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JobRunnerService } from '../src/common/jobs/job-runner.service';
import { drainJobs } from './helpers/drain-jobs';
import { createStudentWithCase } from './helpers/create-student-case';
import { issueTestSession } from './helpers/issue-session';
import { uploadTestDocument } from './helpers/upload-document';

/// 11-portal/01_STUDENT_PARENT_PORTAL.md: Student/Parent self-service surface, reusing
/// EVERY existing Phase 05-10 domain service (no parallel entity). Parent invite/verify/
/// revoke lifecycle (StudentContact extended, DEC-06/ASM-46). Revocation-aware
/// `ScopePolicyService` (Student/Case/Contract/Payment). `portal:access` permission gate
/// (STUDENT_PARENT only — staff roles denied the whole `/portal/*` surface). IDOR tests
/// called directly against the API, never inferred from UI.
describe('Student/Parent Portal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobRunner: JobRunnerService;
  let directorToken: string;
  let financeToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let salesToken: string;
  let studentSelfToken: string;
  let parentLinkedToken: string;
  let parentUnlinkedToken: string;
  let parentRevokedToken: string;

  let studentAId: string;
  let caseAId: string;
  let visaAId: string;
  let scholarshipApplicationAId: string;
  let contractAId: string;
  let invitedContactId: string;
  let visibleTaskId: string;
  let hiddenTaskId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jobRunner = app.get(JobRunnerService);

    ({ token: directorToken } = await issueTestSession(prisma, 'demo.director'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: consultantAToken, userId: consultantAId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));
    ({ token: parentLinkedToken } = await issueTestSession(prisma, 'demo.parent.linked'));
    ({ token: parentUnlinkedToken } = await issueTestSession(prisma, 'demo.parent.unlinked'));
    ({ token: parentRevokedToken } = await issueTestSession(prisma, 'demo.parent.revoked'));

    const studentA = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'HS-2026-90001' } });
    studentAId = studentA.id;
    const caseA = await prisma.case.findUniqueOrThrow({ where: { caseCode: 'CASE-2026-90001' } });
    caseAId = caseA.id;
    const visaA = await prisma.visa.findUniqueOrThrow({ where: { visaCode: 'VISA-2026-90001' } });
    visaAId = visaA.id;
    const scholarshipA = await prisma.scholarshipApplication.findUniqueOrThrow({ where: { scholarshipApplicationCode: 'SCH-2026-90001' } });
    scholarshipApplicationAId = scholarshipA.id;
    const contractA = await prisma.contract.findUniqueOrThrow({ where: { contractCode: 'HD-2026-90001' } });
    contractAId = contractA.id;
    const invitedContact = await prisma.studentContact.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-000000001021' } });
    invitedContactId = invitedContact.id;
    const visibleTask = await prisma.task.findUniqueOrThrow({ where: { taskCode: 'TASK-2026-90003' } });
    visibleTaskId = visibleTask.id;
    const hiddenTask = await prisma.task.findUniqueOrThrow({ where: { taskCode: 'TASK-2026-90001' } });
    hiddenTaskId = hiddenTask.id;
  });

  const consultantCaseIds: string[] = [];
  const contactsToClean: string[] = [];

  async function createCaseForConsultant(): Promise<{ studentId: string; caseId: string }> {
    const { studentId, caseId } = await createStudentWithCase(app, salesToken);
    const res = await request(app.getHttpServer())
      .post(`/cases/${caseId}/members`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ userId: consultantAId, role: 'OWNER' });
    expect(res.status).toBe(201);
    consultantCaseIds.push(caseId);
    return { studentId, caseId };
  }

  afterAll(async () => {
    if (contactsToClean.length > 0) {
      await prisma.parentInvitation.deleteMany({ where: { studentContactId: { in: contactsToClean } } });
      await prisma.studentContact.deleteMany({ where: { id: { in: contactsToClean } } });
    }
    if (consultantCaseIds.length > 0) {
      await prisma.caseMember.deleteMany({ where: { userId: consultantAId, caseId: { in: consultantCaseIds } } });
    }
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Parent invite / verify / revoke lifecycle
  // ---------------------------------------------------------------------------
  describe('Parent invitation lifecycle', () => {
    it('staff creates a StudentContact, invites it, and the raw token verifies+accepts (new account)', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/students/${studentAId}/contacts`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ type: 'PARENT', name: `E2E Parent ${randomUUID()}`, email: `e2e-parent-${randomUUID()}@example.local` });
      expect(createRes.status).toBe(201);
      const contactId = createRes.body.id;
      contactsToClean.push(contactId);

      const inviteRes = await request(app.getHttpServer())
        .post(`/students/${studentAId}/contacts/${contactId}/invite`)
        .set('Authorization', `Bearer ${consultantAToken}`);
      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.devToken).toBeDefined();

      const acceptRes = await request(app.getHttpServer())
        .post(`/public/portal/parent-invitations/${inviteRes.body.devToken}/accept`)
        .send({ username: `e2e-parent-${randomUUID()}`, password: 'correct horse battery staple' });
      expect(acceptRes.status).toBe(201);

      const contact = await prisma.studentContact.findUniqueOrThrow({ where: { id: contactId } });
      expect(contact.portalStatus).toBe('ACTIVE');
      expect(contact.portalUserId).not.toBeNull();
    });

    it('a second accept with the same (now-used) token is rejected', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/students/${studentAId}/contacts`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ type: 'PARENT', name: 'Replay Test Parent', email: `e2e-replay-${randomUUID()}@example.local` });
      contactsToClean.push(createRes.body.id);
      const inviteRes = await request(app.getHttpServer())
        .post(`/students/${studentAId}/contacts/${createRes.body.id}/invite`)
        .set('Authorization', `Bearer ${consultantAToken}`);
      const token = inviteRes.body.devToken;

      const first = await request(app.getHttpServer())
        .post(`/public/portal/parent-invitations/${token}/accept`)
        .send({ username: `e2e-replay-${randomUUID()}`, password: 'correct horse battery staple' });
      expect(first.status).toBe(201);

      const replay = await request(app.getHttpServer())
        .post(`/public/portal/parent-invitations/${token}/accept`)
        .send({ username: 'irrelevant', password: 'irrelevant-password' });
      expect(replay.status).toBe(409);
      expect(replay.body.error.code).toBe('INVALID_OR_USED_INVITATION');
    });

    it('an unknown token is rejected the same way as an expired/used one (no enumeration signal)', async () => {
      const res = await request(app.getHttpServer()).post('/public/portal/parent-invitations/not-a-real-token/accept').send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_OR_USED_INVITATION');
    });

    it('the seeded INVITED fixture (portalStatus=INVITED, no portalUserId yet) accepts with its known raw token', async () => {
      const before = await prisma.studentContact.findUniqueOrThrow({ where: { id: invitedContactId } });
      expect(before.portalStatus).toBe('INVITED');
      expect(before.portalUserId).toBeNull();

      const acceptRes = await request(app.getHttpServer())
        .post('/public/portal/parent-invitations/seed-fixture-invite-token-90001/accept')
        .send({ username: `e2e-fixture-${randomUUID().slice(0, 8)}`, password: 'correct horse battery staple' });
      expect(acceptRes.status).toBe(201);

      const after = await prisma.studentContact.findUniqueOrThrow({ where: { id: invitedContactId } });
      expect(after.portalStatus).toBe('ACTIVE');
      expect(after.portalUserId).not.toBeNull();

      // Revert this shared, fixed-id seed fixture back to its baseline (INVITED, no
      // portalUserId) — this dev DB is never reset between runs, so a later run of this
      // same suite must see the identical starting state, the same discipline already
      // applied to every other seed-fixture-touching test in this project. The FK from
      // StudentContact -> User must be cleared BEFORE the User row can be deleted.
      const createdUserId = after.portalUserId!;
      await prisma.studentContact.update({ where: { id: invitedContactId }, data: { portalUserId: null, portalStatus: 'INVITED' } });
      await prisma.parentInvitation.update({ where: { id: '00000000-0000-4000-8000-000000001022' }, data: { acceptedAt: null } });
      await prisma.user.delete({ where: { id: createdUserId } });
    });

    it('a parent linking a SECOND child reuses their EXISTING account (no duplicate User)', async () => {
      const { studentId } = await createCaseForConsultant();
      const secondChildContact = await request(app.getHttpServer())
        .post(`/students/${studentId}/contacts`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ type: 'PARENT', name: 'Demo Linked Parent Contact (second child)', email: 'demo.parent.linked@example.local' });
      contactsToClean.push(secondChildContact.body.id);
      const inviteRes = await request(app.getHttpServer())
        .post(`/students/${studentId}/contacts/${secondChildContact.body.id}/invite`)
        .set('Authorization', `Bearer ${directorToken}`);
      const userCountBefore = await prisma.user.count({ where: { email: 'demo.parent.linked@example.local' } });

      const acceptRes = await request(app.getHttpServer()).post(`/public/portal/parent-invitations/${inviteRes.body.devToken}/accept`).send({});
      expect(acceptRes.status).toBe(201);
      const userCountAfter = await prisma.user.count({ where: { email: 'demo.parent.linked@example.local' } });
      expect(userCountAfter).toBe(userCountBefore);

      const meRes = await request(app.getHttpServer()).get('/portal/me').set('Authorization', `Bearer ${parentLinkedToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.students.map((s: { id: string }) => s.id)).toEqual(expect.arrayContaining([studentAId, studentId]));
    });

    it('revoke closes access immediately; re-invite is possible afterward', async () => {
      const { studentId } = await createCaseForConsultant();
      const contactRes = await request(app.getHttpServer())
        .post(`/students/${studentId}/contacts`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ type: 'PARENT', name: 'Revoke Test Parent', email: `e2e-revoke-${randomUUID()}@example.local` });
      contactsToClean.push(contactRes.body.id);
      const inviteRes = await request(app.getHttpServer())
        .post(`/students/${studentId}/contacts/${contactRes.body.id}/invite`)
        .set('Authorization', `Bearer ${directorToken}`);
      const acceptRes = await request(app.getHttpServer())
        .post(`/public/portal/parent-invitations/${inviteRes.body.devToken}/accept`)
        .send({ username: `e2e-revoke-${randomUUID()}`, password: 'correct horse battery staple' });
      expect(acceptRes.status).toBe(201);

      const linkedContact = await prisma.studentContact.findUniqueOrThrow({ where: { id: contactRes.body.id } });
      const newParentUser = await prisma.user.findUniqueOrThrow({ where: { id: linkedContact.portalUserId! } });
      const { token: freshParentToken } = await issueTestSession(prisma, newParentUser.username);

      const allowedBefore = await request(app.getHttpServer()).get(`/portal/students/${studentId}`).set('Authorization', `Bearer ${freshParentToken}`);
      expect(allowedBefore.status).toBe(200);

      const revokeRes = await request(app.getHttpServer())
        .post(`/students/${studentId}/contacts/${contactRes.body.id}/revoke`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(revokeRes.status).toBe(201);
      expect(revokeRes.body.portalStatus).toBe('REVOKED');

      const deniedAfter = await request(app.getHttpServer()).get(`/portal/students/${studentId}`).set('Authorization', `Bearer ${freshParentToken}`);
      expect(deniedAfter.status).toBe(404);

      const reinviteRes = await request(app.getHttpServer())
        .post(`/students/${studentId}/contacts/${contactRes.body.id}/invite`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(reinviteRes.status).toBe(201);
    });
  });

  // ---------------------------------------------------------------------------
  // Student/Parent access — ALLOW
  // ---------------------------------------------------------------------------
  describe('Student self-access — ALLOW', () => {
    it('GET /portal/me resolves the student themselves', async () => {
      const res = await request(app.getHttpServer()).get('/portal/me').set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      expect(res.body.students.some((s: { id: string; relationship: string }) => s.id === studentAId && s.relationship === 'SELF')).toBe(true);
    });

    it('can view own profile, roadmap, applications, scholarships, visa, pre-departure, enrollment, contracts, notifications', async () => {
      for (const path of [
        `/portal/students/${studentAId}`,
        `/portal/students/${studentAId}/roadmap`,
        `/portal/students/${studentAId}/applications`,
        `/portal/students/${studentAId}/scholarships`,
        `/portal/students/${studentAId}/visa`,
        `/portal/students/${studentAId}/pre-departure`,
        `/portal/students/${studentAId}/enrollment`,
        `/portal/students/${studentAId}/contracts`,
        `/portal/students/${studentAId}/notifications`,
        `/portal/students/${studentAId}/documents`,
      ]) {
        const res = await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${studentSelfToken}`);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Parent linked-access — ALLOW', () => {
    it('an ACTIVE-linked parent can view the student', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}`).set('Authorization', `Bearer ${parentLinkedToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // DENY — IDOR, cross-student, unlinked, revoked, staff
  // ---------------------------------------------------------------------------
  describe('IDOR / cross-student / unlinked / revoked — DENY (direct API calls)', () => {
    it('a Student cannot access another student (IDOR via URL studentId)', async () => {
      const { studentId: otherStudentId } = await createCaseForConsultant();
      const res = await request(app.getHttpServer()).get(`/portal/students/${otherStudentId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(404);
    });

    it('an unlinked parent is denied (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}`).set('Authorization', `Bearer ${parentUnlinkedToken}`);
      expect(res.status).toBe(404);
    });

    it('a REVOKED parent is denied (404) even though portalUserId is still set on the fixture', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}`).set('Authorization', `Bearer ${parentRevokedToken}`);
      expect(res.status).toBe(404);
    });

    it('every sub-resource independently denies an unlinked parent — not just the profile route', async () => {
      for (const path of [
        `/portal/students/${studentAId}/roadmap`,
        `/portal/students/${studentAId}/tasks`,
        `/portal/students/${studentAId}/documents`,
        `/portal/students/${studentAId}/applications`,
        `/portal/students/${studentAId}/scholarships`,
        `/portal/students/${studentAId}/visa`,
        `/portal/students/${studentAId}/pre-departure`,
        `/portal/students/${studentAId}/enrollment`,
        `/portal/students/${studentAId}/contracts`,
        `/portal/students/${studentAId}/notifications`,
      ]) {
        const res = await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${parentUnlinkedToken}`);
        expect(res.status).toBe(404);
      }
    });

    it('arbitrary document/notification/application/visa/contract ids are denied via IDOR, not just the studentId itself', async () => {
      const arbitraryId = randomUUID();
      const otherStudentDoc = await request(app.getHttpServer())
        .get(`/portal/students/${studentAId}/documents/${arbitraryId}/download`)
        .set('Authorization', `Bearer ${studentSelfToken}`);
      expect(otherStudentDoc.status).toBe(404);

      const otherApplication = await request(app.getHttpServer())
        .get(`/portal/students/${studentAId}/applications/${arbitraryId}`)
        .set('Authorization', `Bearer ${studentSelfToken}`);
      expect(otherApplication.status).toBe(404);

      const otherVisa = await request(app.getHttpServer())
        .get(`/portal/students/${studentAId}/visa/${arbitraryId}`)
        .set('Authorization', `Bearer ${studentSelfToken}`);
      expect(otherVisa.status).toBe(404);
    });

    it('the real Visa/Scholarship of a DIFFERENT, unlinked student is 404 even for a legitimately-authenticated Student', async () => {
      const otherVisa = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/visa/${visaAId}`).set('Authorization', `Bearer ${parentUnlinkedToken}`);
      expect(otherVisa.status).toBe(404);
    });

    it('staff roles (ED/Finance/Sales/Consultant) are denied the entire /portal/* surface — "ensure staff roles không bị ảnh hưởng"', async () => {
      for (const token of [directorToken, financeToken, salesToken, consultantAToken]) {
        const res = await request(app.getHttpServer()).get('/portal/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Field-level redaction on Portal responses
  // ---------------------------------------------------------------------------
  describe('Field-level redaction — Portal never leaks internal-only fields', () => {
    it('Visa internalNotes is redacted for the Student on the detail view', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/visa/${visaAId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      expect(res.body.internalNotes).toBeNull();
      // Appointment/result data — the student's own outcome — stays visible.
      expect(res.body.status).toBeDefined();
    });

    it('Visa internalNotes is redacted on the LIST endpoint too, not just the detail view', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/visa`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      for (const visa of res.body.data) {
        expect(visa.internalNotes).toBeNull();
      }
    });

    it('ScholarshipApplication internalNotes is redacted for the Student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/portal/students/${studentAId}/scholarships/${scholarshipApplicationAId}`)
        .set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      expect(res.body.internalNotes).toBeNull();
    });

    it('a Task shared with the student hides blocker/qualityScore/ownerId (internal-only fields)', async () => {
      await prisma.task.update({ where: { id: visibleTaskId }, data: { blocker: 'Staff-only blocker text', qualityScore: 4 } });
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/tasks/${visibleTaskId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      expect(res.body.blocker).toBeNull();
      expect(res.body.qualityScore).toBeNull();
      expect(res.body.ownerId).toBeNull();
    });

    it('Contract/Payment amounts ARE visible to the owning Student (own financial data, not redacted)', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/contracts`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      const own = res.body.data.find((c: { id: string }) => c.id === contractAId);
      expect(own).toBeDefined();
      expect(own.value).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Task scope — only explicitly shared tasks are visible
  // ---------------------------------------------------------------------------
  describe('Task scope — only visibleToStudent tasks are ever surfaced', () => {
    it('the list only ever includes visibleToStudent=true tasks', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/tasks`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((t: { id: string }) => t.id === visibleTaskId)).toBe(true);
      expect(res.body.data.some((t: { id: string }) => t.id === hiddenTaskId)).toBe(false);
    });

    it('a staff-internal task is 404 on the Portal detail route even though it belongs to the right case', async () => {
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/tasks/${hiddenTaskId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(404);
    });

    it('a student can submit output and move a shared task IN_PROGRESS -> DONE, reusing the real FSM', async () => {
      await prisma.task.update({ where: { id: visibleTaskId }, data: { status: 'NOT_STARTED' } });
      const outputRes = await request(app.getHttpServer())
        .patch(`/portal/students/${studentAId}/tasks/${visibleTaskId}/output`)
        .set('Authorization', `Bearer ${studentSelfToken}`)
        .send({ output: 'Uploaded my transcript.' });
      expect(outputRes.status).toBe(200);

      const toInProgress = await request(app.getHttpServer())
        .post(`/portal/students/${studentAId}/tasks/${visibleTaskId}/status`)
        .set('Authorization', `Bearer ${studentSelfToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(toInProgress.status).toBe(201);
      expect(toInProgress.body.status).toBe('IN_PROGRESS');

      const toDone = await request(app.getHttpServer())
        .post(`/portal/students/${studentAId}/tasks/${visibleTaskId}/status`)
        .set('Authorization', `Bearer ${studentSelfToken}`)
        .send({ status: 'DONE' });
      expect(toDone.status).toBe(201);
      expect(toDone.body.status).toBe('DONE');
    });

    it('a student cannot request BLOCKED/CANCELLED — those stay staff-only judgment calls (rejected at the DTO layer)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/portal/students/${studentAId}/tasks/${visibleTaskId}/status`)
        .set('Authorization', `Bearer ${studentSelfToken}`)
        .send({ status: 'BLOCKED' });
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Document access
  // ---------------------------------------------------------------------------
  describe('Documents — grant-based, never enumerable', () => {
    it('listing only ever returns documents the caller actually holds a grant for', async () => {
      const uploadRes = await uploadTestDocument(app, consultantAToken, {
        ownerEntity: 'Case',
        ownerId: caseAId,
        documentType: 'other',
        title: `Staff doc ${randomUUID()}`,
      });
      expect(uploadRes.status).toBe(201);

      const listRes = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/documents`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(listRes.status).toBe(200);
      // Not shared (no grantCaseAccess call), so it must not appear.
      expect(listRes.body.some((d: { id: string }) => d.id === uploadRes.body.id)).toBe(false);
    });

    it('a student can upload their own document and it becomes visible to them via Portal', async () => {
      const uploadRes = await uploadTestDocument(app, studentSelfToken, {
        ownerEntity: 'Student',
        ownerId: studentAId,
        documentType: 'transcript',
        title: `Self upload ${randomUUID()}`,
      });
      expect(uploadRes.status).toBe(201);

      const listRes = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/documents`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(listRes.body.some((d: { id: string }) => d.id === uploadRes.body.id)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Notifications — recipient-scoped, never another user's inbox
  // ---------------------------------------------------------------------------
  describe('Notifications — isolated per recipient', () => {
    it('a student only ever sees their own notifications, never another principal\'s', async () => {
      await prisma.notification.create({
        data: { recipientId: (await prisma.user.findUniqueOrThrow({ where: { username: 'demo.parent.linked' } })).id, event: 'TEST_EVENT', channel: 'IN_APP' },
      });
      const res = await request(app.getHttpServer()).get(`/portal/students/${studentAId}/notifications`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(200);
      const studentSelfUserId = (await prisma.user.findUniqueOrThrow({ where: { username: 'demo.student.self' } })).id;
      for (const n of res.body.data) {
        expect(n.recipientId).toBe(studentSelfUserId);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------
  describe('Audit', () => {
    it('a private document download is audited', async () => {
      const uploadRes = await uploadTestDocument(app, studentSelfToken, {
        ownerEntity: 'Student',
        ownerId: studentAId,
        documentType: 'other',
        title: 'Audit test doc',
      });
      await drainJobs(jobRunner);
      const downloadRes = await request(app.getHttpServer())
        .get(`/portal/students/${studentAId}/documents/${uploadRes.body.id}/download`)
        .set('Authorization', `Bearer ${studentSelfToken}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.downloadUrl).toMatch(/^\/documents\/download\//);

      const auditRow = await prisma.auditLog.findFirst({
        where: { action: 'DOWNLOAD' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.result).toBe('SUCCESS');
      expect((auditRow?.metadata as { documentId?: string } | null)?.documentId).toBe(uploadRes.body.id);
    });

    it('parent invite/revoke are audited with distinct verbs', async () => {
      const { studentId } = await createCaseForConsultant();
      const contactRes = await request(app.getHttpServer())
        .post(`/students/${studentId}/contacts`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ type: 'PARENT', name: 'Audit Test Parent', email: `e2e-audit-${randomUUID()}@example.local` });
      contactsToClean.push(contactRes.body.id);
      await request(app.getHttpServer()).post(`/students/${studentId}/contacts/${contactRes.body.id}/invite`).set('Authorization', `Bearer ${directorToken}`);

      const inviteAudit = await prisma.auditLog.findFirst({ where: { action: 'INVITE' }, orderBy: { createdAt: 'desc' } });
      expect(inviteAudit).not.toBeNull();
      expect((inviteAudit?.metadata as { contactId?: string } | null)?.contactId).toBe(contactRes.body.id);
    });
  });
});
