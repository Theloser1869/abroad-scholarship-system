import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider, StoredObjectMeta } from './storage-provider.interface';

/// Cloudflare R2 `StorageProvider` — prepared for free-remote-deployment (Render + Supabase
/// + R2), NOT yet connected to a real R2 bucket (no credentials exist in this development
/// environment). R2 is S3-API-compatible, so the AWS SDK's S3 client works against it
/// unchanged with a custom `endpoint` — the same client also works unmodified against a
/// local S3-compatible emulator (MinIO, see `docker-compose.test.yml`), which is how this
/// provider's actual behavior is verified in this environment (real object round-trips
/// against a real S3-API server, just not Cloudflare's) rather than only unit-tested in
/// isolation.
///
/// Same contract as `LocalFilesystemStorageProvider`: a provider-generated key only, never
/// derived from caller input — `DocumentsService` cannot tell which implementation is
/// bound (see `storage-provider.interface.ts`).
@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    const endpoint = config.get<string>('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = config.get<string>('R2_BUCKET');

    // Fail fast at construction (same discipline as `MfaEncryption`'s constructor check) —
    // a storage provider silently unable to store/read anything is a much worse failure
    // mode than refusing to boot with a clear message.
    const missing = [
      !endpoint && 'R2_ENDPOINT (or R2_ACCOUNT_ID, to derive it)',
      !accessKeyId && 'R2_ACCESS_KEY_ID',
      !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
      !bucket && 'R2_BUCKET',
    ].filter((v): v is string => Boolean(v));
    if (missing.length > 0) {
      throw new Error(`R2StorageProvider is selected (STORAGE_PROVIDER=r2) but missing required configuration: ${missing.join(', ')}.`);
    }

    this.bucket = bucket!;
    this.client = new S3Client({
      region: 'auto', // R2 has no region concept; 'auto' is Cloudflare's documented value.
      endpoint,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
      // R2 (and most S3-compatible servers, including MinIO used for local validation)
      // require path-style addressing rather than AWS's virtual-hosted-style bucket URLs.
      forcePathStyle: true,
    });
  }

  async store(buffer: Buffer): Promise<StoredObjectMeta> {
    const storageKey = randomUUID();
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: buffer }));
    return { storageKey, sizeBytes: buffer.length };
  }

  async read(storageKey: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    const chunks: Buffer[] = [];
    // @aws-sdk/client-s3's Node runtime returns a Node Readable for `Body`.
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }
}
