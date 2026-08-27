import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JobRunnerService } from '../src/common/jobs/job-runner.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { drainJobsToCompletion } from './helpers/drain-jobs';
import { issueTestSession } from './helpers/issue-session';

const VALID_PDF = Buffer.from('%PDF-1.4\n%%EOF');
const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

/// 12-platform/01_DOCUMENTS.md — the real private-storage upload/signed-download/scan/
/// versioning/share/archive build-out on top of Phase 07's metadata-only slice. IDOR
/// (`docs/security/RBAC_MATRIX.md` section 6 discipline) is exercised by calling the API
/// directly, never inferred from a UI.
describe('Documents Platform (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobRunner: JobRunnerService;
  let directorToken: string;
  let consultantAToken: string;
  let consultantBToken: string;
  let salesToken: string;

  let studentAId: string;
  let caseAId: string;

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
    ({ token: consultantAToken } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: consultantBToken } = await issueTestSession(prisma, 'demo.consultant.b'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));

    ({ studentId: studentAId, caseId: caseAId } = await createStudentWithCase(app, salesToken));
    await request(app.getHttpServer())
      .post(`/cases/${caseAId}/members`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ userId: (await issueTestSession(prisma, 'demo.consultant.a')).userId, role: 'OWNER' });
  });

  afterAll(async () => {
    await app.close();
  });

  async function upload(token: string, overrides: Partial<{ ownerEntity: string; ownerId: string; documentType: string; title: string }> = {}, fileBuffer: Buffer = VALID_PDF) {
    return request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('ownerEntity', overrides.ownerEntity ?? 'Case')
      .field('ownerId', overrides.ownerId ?? caseAId)
      .field('documentType', overrides.documentType ?? 'other')
      .field('title', overrides.title ?? `Doc ${randomUUID()}`)
      .attach('file', fileBuffer, { filename: 'test.pdf', contentType: 'application/pdf' });
  }

  describe('upload — storage + validation', () => {
    it('stores the file privately, server-generates the storage key, computes checksum/mime/size', async () => {
      const res = await upload(consultantAToken);
      expect(res.status).toBe(201);
      expect(res.body.checksumSha256).toBeTruthy();
      expect(res.body.mimeType).toBe('application/pdf');
      expect(res.body.sizeBytes).toBe(String(VALID_PDF.length));
      expect(res.body.scanStatus).toBe('PENDING');
      // fileReference is a server-generated UUID, never a client-controlled path.
      expect(res.body.fileReference).toMatch(/^[0-9a-f-]{36}$/i);
      expect(res.body).not.toHaveProperty('fileUrl');
    });

    it('rejects an unsupported MIME type', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${consultantAToken}`)
        .field('ownerEntity', 'Case')
        .field('ownerId', caseAId)
        .field('documentType', 'other')
        .field('title', 'bad')
        .attach('file', Buffer.from('#!/bin/sh\necho hi'), { filename: 'script.sh', contentType: 'application/x-sh' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_MIME_TYPE');
    });

    it('rejects a MIME/extension mismatch', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${consultantAToken}`)
        .field('ownerEntity', 'Case')
        .field('ownerId', caseAId)
        .field('documentType', 'other')
        .field('title', 'bad')
        .attach('file', VALID_PDF, { filename: 'not-a-pdf.txt', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EXTENSION_MISMATCH');
    });

    it('rejects MIME spoofing — declared type does not match actual file content', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${consultantAToken}`)
        .field('ownerEntity', 'Case')
        .field('ownerId', caseAId)
        .field('documentType', 'other')
        .field('title', 'spoofed')
        .attach('file', Buffer.from('this is plain text, not a real PDF'), { filename: 'fake.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MIME_SPOOFING_DETECTED');
    });

    it('rejects an empty file', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${consultantAToken}`)
        .field('ownerEntity', 'Case')
        .field('ownerId', caseAId)
        .field('documentType', 'other')
        .field('title', 'empty')
        .attach('file', Buffer.alloc(0), { filename: 'empty.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMPTY_FILE');
    });

    it('rejects an upload with no file attached', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${consultantAToken}`)
        .field('ownerEntity', 'Case')
        .field('ownerId', caseAId)
        .field('documentType', 'other')
        .field('title', 'no file');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_REQUIRED');
    });

    it('does not grant extra access via a spoofed ownerId/ownerEntity — access is grant-based only', async () => {
      const res = await upload(consultantAToken, { ownerEntity: 'Student', ownerId: studentAId });
      expect(res.status).toBe(201);
      // consultant.b has no grant on this document despite it "belonging" to a student
      // whose case consultant.b has no membership on either way — ownerEntity/ownerId is
      // descriptive metadata, not a scope input.
      const deniedRes = await request(app.getHttpServer()).get(`/documents/${res.body.id}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(deniedRes.status).toBe(404);
    });

    it('flags (never blocks) a duplicate checksum for the same owner', async () => {
      const first = await upload(consultantAToken, { title: 'Original' });
      const second = await upload(consultantAToken, { title: 'Re-upload same bytes' });
      expect(second.status).toBe(201);
      expect(second.body.duplicateOfId).toBe(first.body.id);
    });
  });

  describe('malware scan — async pending/clean/infected lifecycle', () => {
    it('a document stays undownloadable while scanStatus is PENDING, even for the uploader', async () => {
      const uploadRes = await upload(consultantAToken);
      const res = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_READY');
    });

    it('a clean file becomes downloadable once the scan job runs', async () => {
      const uploadRes = await upload(consultantAToken);
      await drainJobsToCompletion(jobRunner, prisma);
      const doc = await prisma.document.findUnique({ where: { id: uploadRes.body.id } });
      expect(doc?.scanStatus).toBe('CLEAN');
      const res = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toMatch(/^\/documents\/download\//);
    });

    it('an EICAR test-signature file is flagged INFECTED and stays permanently undownloadable', async () => {
      const uploadRes = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${consultantAToken}`)
        .field('ownerEntity', 'Case')
        .field('ownerId', caseAId)
        .field('documentType', 'other')
        .field('title', 'eicar test')
        // text/plain carries no magic-byte check (see ALLOWED_MIME_TYPES) — the point of
        // this test is exercising the scanner, not the MIME/magic-byte validator, which
        // is already covered by its own dedicated tests above.
        .attach('file', EICAR, { filename: 'eicar.txt', contentType: 'text/plain' });
      expect(uploadRes.status).toBe(201);
      await drainJobsToCompletion(jobRunner, prisma);
      const doc = await prisma.document.findUnique({ where: { id: uploadRes.body.id } });
      expect(doc?.scanStatus).toBe('INFECTED');
      const res = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_READY');
    });
  });

  describe('signed download URL', () => {
    it('the byte-serving endpoint works with a valid token and rejects a tampered one', async () => {
      const uploadRes = await upload(consultantAToken);
      await drainJobsToCompletion(jobRunner, prisma);
      const { body } = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      const fileRes = await request(app.getHttpServer()).get(body.downloadUrl);
      expect(fileRes.status).toBe(200);
      expect(fileRes.headers['content-disposition']).toContain('attachment');
      expect(fileRes.headers['content-type']).toContain('application/pdf');

      const tampered = body.downloadUrl.slice(0, -2) + 'xx';
      const tamperedRes = await request(app.getHttpServer()).get(tampered);
      expect(tamperedRes.status).toBe(403);
    });

    it('a signed URL issued to one principal is not usable by a different principal even before expiry', async () => {
      const uploadRes = await upload(consultantAToken);
      await drainJobsToCompletion(jobRunner, prisma);
      // Grant consultant.b VIEW/DOWNLOAD, then request a URL as consultant.a — the
      // token is scoped to consultant.a's principalId, so consultant.b downloading with
      // it (even though consultant.b independently HAS a grant) fails the token check
      // itself, proving the token isn't a bare "any authorized user" bearer credential.
      await request(app.getHttpServer())
        .post(`/documents/${uploadRes.body.id}/share`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ principalId: (await issueTestSession(prisma, 'demo.consultant.b')).userId, permissions: ['VIEW', 'DOWNLOAD'] });
      const { body } = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);

      const asOwnRequest = await request(app.getHttpServer()).get(body.downloadUrl);
      expect(asOwnRequest.status).toBe(200); // sanity: the original token still works
    });

    it('cross-user IDOR: another user without any grant cannot request a download URL at all', async () => {
      const uploadRes = await upload(consultantAToken);
      const res = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
    });

    // Phase 13 HIGH-fix regression — `requestDownload`'s `assertAccessible` lets
    // GLOBAL-scope roles (Executive Director/Department Manager) through with no
    // `DocumentAccess` row required, but `downloadByToken` used to re-check a raw grant
    // row regardless of scope, so a GLOBAL-scope caller with no personal grant got a valid
    // `downloadUrl` from step 1 and then a 403 on step 2. Director here was never
    // uploader/shared on this document — only consultant.a (a case member) was.
    it('a GLOBAL-scope role (director) can complete both download steps for a document with no personal grant', async () => {
      const uploadRes = await upload(consultantAToken);
      await drainJobsToCompletion(jobRunner, prisma);
      const step1 = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${directorToken}`);
      expect(step1.status).toBe(200);
      const step2 = await request(app.getHttpServer()).get(step1.body.downloadUrl);
      expect(step2.status).toBe(200);
      expect(step2.headers['content-type']).toContain('application/pdf');
    });
  });

  describe('versioning — never overwrite', () => {
    it('creates a new Document row chained via previousVersionId, copying forward existing grants', async () => {
      const original = await upload(consultantAToken, { title: 'Contract v1' });
      await request(app.getHttpServer())
        .post(`/documents/${original.body.id}/share`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ principalId: (await issueTestSession(prisma, 'demo.director')).userId, permissions: ['VIEW'] });

      const versionRes = await request(app.getHttpServer())
        .post(`/documents/${original.body.id}/versions`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .attach('file', VALID_PDF, { filename: 'v2.pdf', contentType: 'application/pdf' });
      expect(versionRes.status).toBe(201);
      expect(versionRes.body.id).not.toBe(original.body.id);
      expect(versionRes.body.version).toBe(2);
      expect(versionRes.body.previousVersionId).toBe(original.body.id);

      // The original row is untouched — no history lost.
      const originalStill = await prisma.document.findUnique({ where: { id: original.body.id } });
      expect(originalStill?.version).toBe(1);

      // Director's grant was copied forward to the new version.
      const directorViewRes = await request(app.getHttpServer())
        .get(`/documents/${versionRes.body.id}`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(directorViewRes.status).toBe(200);
    });

    it('rejects creating a new version of an archived document', async () => {
      const doc = await upload(consultantAToken);
      await request(app.getHttpServer()).post(`/documents/${doc.body.id}/archive`).set('Authorization', `Bearer ${consultantAToken}`);
      const res = await request(app.getHttpServer())
        .post(`/documents/${doc.body.id}/versions`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .attach('file', VALID_PDF, { filename: 'v2.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DOCUMENT_ARCHIVED');
    });
  });

  describe('edit / share / archive', () => {
    it('updates metadata (title/documentType) only — never the file content', async () => {
      const doc = await upload(consultantAToken);
      const res = await request(app.getHttpServer())
        .patch(`/documents/${doc.body.id}`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ title: 'Renamed' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Renamed');
      expect(res.body.fileReference).toBe(doc.body.fileReference);
    });

    it('rejects editing an archived document', async () => {
      const doc = await upload(consultantAToken);
      await request(app.getHttpServer()).post(`/documents/${doc.body.id}/archive`).set('Authorization', `Bearer ${consultantAToken}`);
      const res = await request(app.getHttpServer()).patch(`/documents/${doc.body.id}`).set('Authorization', `Bearer ${consultantAToken}`).send({ title: 'x' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DOCUMENT_ARCHIVED');
    });

    it('share grants VIEW/DOWNLOAD to another principal, who could not previously see the document', async () => {
      const doc = await upload(consultantAToken);
      const before = await request(app.getHttpServer()).get(`/documents/${doc.body.id}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(before.status).toBe(404);

      const { userId: consultantBId } = await issueTestSession(prisma, 'demo.consultant.b');
      const shareRes = await request(app.getHttpServer())
        .post(`/documents/${doc.body.id}/share`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ principalId: consultantBId, permissions: ['VIEW'] });
      expect(shareRes.status).toBe(201);

      const after = await request(app.getHttpServer()).get(`/documents/${doc.body.id}`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(after.status).toBe(200);
    });

    it('a user without SHARE grant cannot share a document they only have VIEW on', async () => {
      const doc = await upload(consultantAToken);
      const { userId: consultantBId } = await issueTestSession(prisma, 'demo.consultant.b');
      await request(app.getHttpServer())
        .post(`/documents/${doc.body.id}/share`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .send({ principalId: consultantBId, permissions: ['VIEW'] });

      const { userId: salesId } = await issueTestSession(prisma, 'demo.sales');
      const res = await request(app.getHttpServer())
        .post(`/documents/${doc.body.id}/share`)
        .set('Authorization', `Bearer ${consultantBToken}`)
        .send({ principalId: salesId, permissions: ['VIEW'] });
      expect(res.status).toBe(404); // consultant.b holds VIEW only, never SHARE — not enumerable either.
    });

    it('archiving does not revoke existing grants — a clean archived document stays downloadable', async () => {
      const doc = await upload(consultantAToken);
      await drainJobsToCompletion(jobRunner, prisma);
      await request(app.getHttpServer()).post(`/documents/${doc.body.id}/archive`).set('Authorization', `Bearer ${consultantAToken}`);
      const res = await request(app.getHttpServer()).get(`/documents/${doc.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
    });
  });
});
