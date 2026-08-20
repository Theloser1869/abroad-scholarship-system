/// Phase 12 (12-platform/01_DOCUMENTS.md "private object storage") — the adapter boundary
/// every document-upload/download path goes through. `DocumentsService` never touches the
/// filesystem/cloud SDK directly; it only calls this interface, so swapping the local-disk
/// default (`LocalFilesystemStorageProvider`) for a real S3/GCS/Azure Blob provider later
/// is a one-file change, never a rewrite of business logic. See `docs/ASSUMPTIONS.md`
/// ASM-50.
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredObjectMeta {
  storageKey: string;
  sizeBytes: number;
}

export interface StorageProvider {
  /// Persists `buffer` under a NEW, provider-generated key — never derived from any
  /// caller-supplied filename/path ("Không cho client kiểm soát object path/key").
  store(buffer: Buffer): Promise<StoredObjectMeta>;

  /// Reads the full object back into memory. Local-disk default only — a real cloud
  /// provider implementation would stream instead; acceptable here given this project's
  /// document-size limits (`DOCUMENT_MAX_SIZE_BYTES`) keep worst-case memory use bounded.
  read(storageKey: string): Promise<Buffer>;

  /// Permanently removes the underlying bytes. Only ever called for a document that was
  /// itself hard-deleted — which, per Hard Rule #5, never happens through any Phase 01-12
  /// API path. Exists for interface completeness / a future retention-purge job, not
  /// currently invoked anywhere.
  delete(storageKey: string): Promise<void>;
}
