import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider, StoredObjectMeta } from './storage-provider.interface';

/// Default `StorageProvider` — a private, non-web-served directory on local disk (this
/// project has no cloud storage credentials available; a real S3/GCS/Azure Blob provider
/// is a drop-in replacement behind the same interface, see `docs/ASSUMPTIONS.md` ASM-50).
/// The directory lives OUTSIDE `dist/`/any static-file-serving root — nothing in this
/// codebase ever registers it as a static asset directory, so there is no path by which a
/// stored object is reachable except through `DocumentsService`'s own
/// authorize-then-signed-URL flow.
@Injectable()
export class LocalFilesystemStorageProvider implements StorageProvider {
  private readonly baseDir: string;
  private ready: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    const configured = this.config.get<string>('DOCUMENT_STORAGE_DIR') ?? 'storage/documents';
    this.baseDir = resolve(process.cwd(), configured);
  }

  private async ensureDir(): Promise<void> {
    if (!this.ready) {
      this.ready = mkdir(this.baseDir, { recursive: true }).then(() => undefined);
    }
    return this.ready;
  }

  async store(buffer: Buffer): Promise<StoredObjectMeta> {
    await this.ensureDir();
    // Provider-generated key only — never derived from a caller-supplied filename, which
    // structurally rules out path traversal (no user input ever reaches a filesystem path).
    const storageKey = randomUUID();
    await writeFile(this.objectPath(storageKey), buffer);
    return { storageKey, sizeBytes: buffer.length };
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.objectPath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.objectPath(storageKey), { force: true });
  }

  /// `storageKey` is always our own `randomUUID()` output (validated by `assertSafeKey`
  /// defensively below in case a future caller ever passes through an unexpected value) —
  /// never resolved from external input, so `join` here cannot escape `baseDir`.
  private objectPath(storageKey: string): string {
    this.assertSafeKey(storageKey);
    return join(this.baseDir, storageKey);
  }

  private assertSafeKey(storageKey: string): void {
    if (!/^[0-9a-f-]{36}$/i.test(storageKey)) {
      throw new Error(`Refusing to resolve a non-UUID storage key: ${storageKey}`);
    }
  }
}
