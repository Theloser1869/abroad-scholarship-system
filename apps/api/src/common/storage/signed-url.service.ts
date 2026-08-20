import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeStringEqual } from '../security/token.util';

export interface SignedDownloadPayload {
  documentId: string;
  principalId: string;
  expiresAt: number;
}

/// Phase 12 (12-platform/01_DOCUMENTS.md "signed URL, short expiry"). Stateless HMAC-signed
/// token — the same class of mechanism a real cloud provider's presigned URL uses
/// underneath, reimplemented here since this project has no cloud storage credentials.
/// `DOCUMENT_DOWNLOAD_URL_TTL_SECONDS` (default 60s) bounds how long a token stays valid;
/// there is no server-side single-use tracking (a real S3 presigned URL has the same
/// property — time-limited, not single-use), so "không reuse vô hạn" is satisfied by the
/// short TTL rather than a consumed-token ledger. The token is scoped to exactly one
/// document AND the principal it was issued to — a token generated for one user's session
/// cannot be replayed by a different principalId even if intercepted before expiry, since
/// verification re-checks both fields.
@Injectable()
export class SignedUrlService {
  constructor(private readonly config: ConfigService) {}

  sign(documentId: string, principalId: string): string {
    const ttlSeconds = Number(this.config.get<string>('DOCUMENT_DOWNLOAD_URL_TTL_SECONDS') ?? '60');
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const payload = `${documentId}.${principalId}.${expiresAt}`;
    const signature = this.hmac(payload);
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  verify(token: string): SignedDownloadPayload | null {
    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      return null;
    }
    const parts = decoded.split('.');
    if (parts.length !== 4) return null;
    const [documentId, principalId, expiresAtRaw, signature] = parts;
    const payload = `${documentId}.${principalId}.${expiresAtRaw}`;
    const expected = this.hmac(payload);
    if (!timingSafeStringEqual(signature, expected)) return null;
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
    return { documentId, principalId, expiresAt };
  }

  private hmac(payload: string): string {
    const secret = this.config.get<string>('DOCUMENT_SIGNING_SECRET');
    if (!secret) {
      throw new Error('DOCUMENT_SIGNING_SECRET is not configured.');
    }
    return createHmac('sha256', secret).update(payload).digest('base64url');
  }
}
