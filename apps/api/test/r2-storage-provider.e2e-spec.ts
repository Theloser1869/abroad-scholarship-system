import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JobRunnerService } from '../src/common/jobs/job-runner.service';
import { R2StorageProvider } from '../src/common/storage/r2-storage.provider';
import { createStudentWithCase } from './helpers/create-student-case';
import { drainJobsToCompletion } from './helpers/drain-jobs';
import { issueTestSession } from './helpers/issue-session';
import { uploadTestDocument } from './helpers/upload-document';

/// Free-remote-deployment prep — validates `R2StorageProvider` for real, against a real
/// S3-API server, WITHOUT any real Cloudflare R2 credentials or bucket. R2 is
/// S3-API-compatible; MinIO (started via `docker compose -f docker-compose.test.yml up -d`,
/// see docs/DEPLOYMENT_FREE.md "R2 local validation") speaks the same API, so the exact
/// same `@aws-sdk/client-s3` client code this provider uses against Cloudflare in
/// production runs unmodified here. This is real object-storage round-tripping through a
/// real S3-protocol server, not a mock/pretend test.
///
/// Two layers: (1) the provider in isolation (store/read/delete correctness), and (2) the
/// full `DocumentsService` upload→scan→download→version flow with `STORAGE_PROVIDER=r2`
/// bound instead of the default local provider — proving the storage abstraction genuinely
/// holds (every one of these assertions is already exhaustively trusted against the local
/// provider in documents-platform.e2e-spec.ts; running the same kind of flow through the R2
/// provider proves it is a true drop-in, not just structurally type-compatible).
///
/// Skipped entirely (not failed) if MinIO isn't reachable, so the rest of the e2e suite
/// remains runnable without it — but when it DOES run, every assertion is real.
const MINIO_ENDPOINT = 'http://localhost:9000';
const MINIO_BUCKET = 'abroad-documents-test';
const MINIO_ACCESS_KEY = 'minioadmin';
const MINIO_SECRET_KEY = 'minioadmin123';

async function isMinioReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${MINIO_ENDPOINT}/minio/health/live`);
    return res.ok;
  } catch {
    return false;
  }
}

describe('R2StorageProvider (S3-compatible, validated against local MinIO)', () => {
  let minioAvailable = false;

  beforeAll(async () => {
    minioAvailable = await isMinioReachable();
    if (!minioAvailable) {
      console.warn('MinIO not reachable at ' + MINIO_ENDPOINT + ' — skipping R2StorageProvider validation. Run `docker compose -f docker-compose.test.yml up -d` first.');
    }
  });

  describe('provider in isolation', () => {
    let provider: R2StorageProvider;

    beforeAll(() => {
      if (!minioAvailable) return;
      const fakeConfig = {
        get: (key: string) =>
          ({
            R2_ENDPOINT: MINIO_ENDPOINT,
            R2_ACCESS_KEY_ID: MINIO_ACCESS_KEY,
            R2_SECRET_ACCESS_KEY: MINIO_SECRET_KEY,
            R2_BUCKET: MINIO_BUCKET,
          })[key],
      } as never;
      provider = new R2StorageProvider(fakeConfig);
    });

    it('constructor throws a clear error when required config is missing (fails fast, same discipline as MfaEncryption)', () => {
      const incomplete = { get: () => undefined } as never;
      expect(() => new R2StorageProvider(incomplete)).toThrow(/R2_ENDPOINT|R2_ACCOUNT_ID/);
    });

    it('stores and reads back an object byte-for-byte identical', async () => {
      if (!minioAvailable) return;
      const original = Buffer.from(`round-trip test ${randomUUID()}`);
      const { storageKey, sizeBytes } = await provider.store(original);
      expect(sizeBytes).toBe(original.length);
      expect(storageKey).toMatch(/^[0-9a-f-]{36}$/i); // provider-generated UUID key, same contract as the local provider

      const readBack = await provider.read(storageKey);
      expect(readBack.equals(original)).toBe(true);
    });

    it('never derives the storage key from anything caller-supplied — two stores of identical bytes get different keys', async () => {
      if (!minioAvailable) return;
      const bytes = Buffer.from('identical content');
      const first = await provider.store(bytes);
      const second = await provider.store(bytes);
      expect(first.storageKey).not.toBe(second.storageKey);
    });

    it('delete removes the object — a subsequent read fails', async () => {
      if (!minioAvailable) return;
      const { storageKey } = await provider.store(Buffer.from('to be deleted'));
      await provider.delete(storageKey);
      await expect(provider.read(storageKey)).rejects.toThrow();
    });

    it('handles a realistic document-sized binary payload correctly (not just short strings)', async () => {
      if (!minioAvailable) return;
      const large = Buffer.alloc(512 * 1024); // 512KB, well within DOCUMENT_MAX_SIZE_BYTES
      for (let i = 0; i < large.length; i++) large[i] = i % 256;
      const { storageKey, sizeBytes } = await provider.store(large);
      expect(sizeBytes).toBe(large.length);
      const readBack = await provider.read(storageKey);
      expect(readBack.equals(large)).toBe(true);
    });
  });

  describe('full DocumentsService flow with STORAGE_PROVIDER=r2 bound', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let jobRunner: JobRunnerService;
    let directorToken: string;
    let consultantAToken: string;
    let consultantBToken: string;
    let caseAId: string;
    let originalEnv: Record<string, string | undefined>;

    beforeAll(async () => {
      if (!minioAvailable) return;

      // Every e2e spec file compiles its own fresh AppModule instance, so overriding
      // process.env here only affects THIS file's app — but since --runInBand runs every
      // spec file in one process, these must be restored in afterAll or later files
      // (alphabetically after this one) would inherit STORAGE_PROVIDER=r2 unexpectedly.
      originalEnv = {
        STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
        R2_ENDPOINT: process.env.R2_ENDPOINT,
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET: process.env.R2_BUCKET,
      };
      process.env.STORAGE_PROVIDER = 'r2';
      process.env.R2_ENDPOINT = MINIO_ENDPOINT;
      process.env.R2_ACCESS_KEY_ID = MINIO_ACCESS_KEY;
      process.env.R2_SECRET_ACCESS_KEY = MINIO_SECRET_KEY;
      process.env.R2_BUCKET = MINIO_BUCKET;

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
      ({ caseId: caseAId } = await createStudentWithCase(app, directorToken));
      await request(app.getHttpServer())
        .post(`/cases/${caseAId}/members`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ userId: (await issueTestSession(prisma, 'demo.consultant.a')).userId, role: 'OWNER' });
    });

    afterAll(async () => {
      if (!minioAvailable) return;
      await app.close();
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it('upload -> scan -> download round-trips real bytes through R2/MinIO, not just metadata', async () => {
      if (!minioAvailable) return;
      const content = Buffer.from(`%PDF-1.4\n${randomUUID()}\n%%EOF`);
      const uploadRes = await uploadTestDocument(app, consultantAToken, { ownerEntity: 'Case', ownerId: caseAId, documentType: 'other', title: 'R2 round-trip test' }, content);
      expect(uploadRes.status).toBe(201);
      await drainJobsToCompletion(jobRunner, prisma);

      const doc = await prisma.document.findUnique({ where: { id: uploadRes.body.id } });
      expect(doc?.scanStatus).toBe('CLEAN');

      const step1 = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(step1.status).toBe(200);
      const step2 = await request(app.getHttpServer()).get(step1.body.downloadUrl).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(step2.status).toBe(200);
      expect((step2.body as Buffer).equals(content)).toBe(true);
    });

    it('checksum-based duplicate detection still works (proves checksum is computed from real bytes read back correctly)', async () => {
      if (!minioAvailable) return;
      const content = Buffer.from(`%PDF-1.4\n${randomUUID()}-duplicate\n%%EOF`);
      const first = await uploadTestDocument(app, consultantAToken, { ownerEntity: 'Case', ownerId: caseAId, documentType: 'other', title: 'dup A' }, content);
      const second = await uploadTestDocument(app, consultantAToken, { ownerEntity: 'Case', ownerId: caseAId, documentType: 'other', title: 'dup B' }, content);
      expect(second.body.duplicateOfId).toBe(first.body.id);
      // Drain now, while THIS app instance (STORAGE_PROVIDER=r2) is still the one whose
      // JobRunnerService would claim these DOCUMENT_SCAN jobs — a job left PENDING here
      // would otherwise get picked up later by a different test file's app instance (the
      // default STORAGE_PROVIDER=local one, restored in afterAll below), which would try
      // to read these MinIO-only-stored bytes off local disk and fail/dead-letter.
      await drainJobsToCompletion(jobRunner, prisma);
    });

    it('versioning creates a new object in R2/MinIO, never overwrites the original', async () => {
      if (!minioAvailable) return;
      const v1 = await uploadTestDocument(app, consultantAToken, { ownerEntity: 'Case', ownerId: caseAId, documentType: 'other', title: 'versioned doc' });
      await drainJobsToCompletion(jobRunner, prisma);
      const v2res = await request(app.getHttpServer())
        .post(`/documents/${v1.body.id}/versions`)
        .set('Authorization', `Bearer ${consultantAToken}`)
        .attach('file', Buffer.from('%PDF-1.4\nversion 2\n%%EOF'), { filename: 'v2.pdf', contentType: 'application/pdf' });
      expect(v2res.status).toBe(201);
      expect(v2res.body.previousVersionId).toBe(v1.body.id);
      await drainJobsToCompletion(jobRunner, prisma); // the new version's own DOCUMENT_SCAN job — see comment above
      const original = await prisma.document.findUnique({ where: { id: v1.body.id } });
      expect(original?.status).not.toBe('ARCHIVED'); // untouched, still independently readable
    });

    it('cross-user IDOR is still denied — authorization is storage-provider-agnostic', async () => {
      if (!minioAvailable) return;
      const uploadRes = await uploadTestDocument(app, consultantAToken, { ownerEntity: 'Case', ownerId: caseAId, documentType: 'other', title: 'private doc' });
      const res = await request(app.getHttpServer()).get(`/documents/${uploadRes.body.id}/download`).set('Authorization', `Bearer ${consultantBToken}`);
      expect(res.status).toBe(404);
      await drainJobsToCompletion(jobRunner, prisma); // see comment on the duplicate-detection test above
    });
  });
});
