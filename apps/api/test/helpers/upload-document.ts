import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/// Phase 12 — `POST /documents` is now a real multipart upload (private object storage,
/// server-computed checksum/MIME/size — see `docs/ASSUMPTIONS.md` ASM-50), not a JSON body
/// with a caller-supplied `fileReference`. This is a minimal, valid PDF byte buffer (just
/// the `%PDF` magic header, enough to pass `validateMagicBytes`) shared by every e2e spec
/// that needs a real Document fixture.
const MINIMAL_PDF_BUFFER = Buffer.from('%PDF-1.4\n%%EOF');

export interface UploadDocumentFields {
  ownerEntity: string;
  ownerId: string;
  documentType: string;
  title: string;
}

export async function uploadTestDocument(
  app: INestApplication,
  token: string,
  fields: UploadDocumentFields,
  fileBuffer: Buffer = MINIMAL_PDF_BUFFER,
  filename = 'evidence.pdf',
) {
  return request(app.getHttpServer())
    .post('/documents')
    .set('Authorization', `Bearer ${token}`)
    .field('ownerEntity', fields.ownerEntity)
    .field('ownerId', fields.ownerId)
    .field('documentType', fields.documentType)
    .field('title', fields.title)
    .attach('file', fileBuffer, { filename, contentType: 'application/pdf' });
}
