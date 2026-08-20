import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { JobRunnerService } from '../../../common/jobs/job-runner.service';
import { MALWARE_SCAN_PROVIDER, MalwareScanProvider } from '../../../common/storage/malware-scan-provider.interface';
import { STORAGE_PROVIDER, StorageProvider } from '../../../common/storage/storage-provider.interface';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TransientJobError } from '../../../common/jobs/job-error';
import { IdentityModule } from '../../identity/identity.module';
import { DocumentsController } from './documents.controller';
import { DOCUMENT_SCAN_JOB_TYPE, DocumentsService } from './documents.service';

@Module({
  imports: [IdentityModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly documents: DocumentsService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(MALWARE_SCAN_PROVIDER) private readonly scanner: MalwareScanProvider,
  ) {}

  /// Phase 12 — the async half of "Nếu upload scanner là asynchronous: file phải có
  /// trạng thái rõ ràng như pending/scanned/rejected/active." Reads the stored bytes back
  /// via the SAME `StorageProvider` the upload path wrote them through (never assumes a
  /// filesystem path), scans, then applies the result. A storage-read failure is treated
  /// as transient (disk hiccup, not a verdict on the file) so the runner retries rather
  /// than permanently marking a possibly-fine file INFECTED due to an I/O error.
  onModuleInit(): void {
    this.runner.registerProcessor(DOCUMENT_SCAN_JOB_TYPE, async (payload) => {
      const documentId = payload.documentId as string;
      const document = await this.prisma.document.findUnique({ where: { id: documentId } });
      if (!document) return; // Document no longer exists — nothing to scan, not retryable.

      let buffer: Buffer;
      try {
        buffer = await this.storage.read(document.fileReference);
      } catch (err) {
        throw new TransientJobError(`Storage read failed: ${(err as Error).message}`);
      }

      const result = await this.scanner.scan(buffer);
      await this.documents.applyScanResult(documentId, result.clean);
    });
  }
}
