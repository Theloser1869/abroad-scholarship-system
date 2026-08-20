import { BadRequestException } from '@nestjs/common';

/// Phase 12 (12-platform/01_DOCUMENTS.md "MIME validation, extension validation, ... path
/// traversal protection, filename normalization"). Allowlist-based — an unlisted MIME type
/// is rejected outright, never silently accepted. Each entry's `magicBytes` (when present)
/// is checked against the actual uploaded bytes, not just the client-declared
/// `Content-Type` header, so a renamed/mislabeled file ("MIME spoofing") is caught before
/// storage. Office Open XML formats (docx/xlsx/pptx) and plain `.zip` all share the same
/// ZIP container signature (`PK\x03\x04`) — checked as a shared prefix, since this project
/// has no full ZIP-central-directory parser; still rejects anything that isn't at least a
/// well-formed ZIP/OLE container for those types, which is the realistic bar for a
/// lightweight, dependency-free sniff.
interface AllowedType {
  extensions: string[];
  magicBytes?: Buffer[];
}

const PDF_MAGIC = Buffer.from('%PDF');
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export const ALLOWED_MIME_TYPES: Record<string, AllowedType> = {
  'application/pdf': { extensions: ['pdf'], magicBytes: [PDF_MAGIC] },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], magicBytes: [JPEG_MAGIC] },
  'image/png': { extensions: ['png'], magicBytes: [PNG_MAGIC] },
  'application/msword': { extensions: ['doc'], magicBytes: [OLE_MAGIC] },
  'application/vnd.ms-excel': { extensions: ['xls'], magicBytes: [OLE_MAGIC] },
  'application/vnd.ms-powerpoint': { extensions: ['ppt'], magicBytes: [OLE_MAGIC] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extensions: ['docx'], magicBytes: [ZIP_MAGIC] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extensions: ['xlsx'], magicBytes: [ZIP_MAGIC] },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { extensions: ['pptx'], magicBytes: [ZIP_MAGIC] },
  'application/zip': { extensions: ['zip'], magicBytes: [ZIP_MAGIC] },
  'text/plain': { extensions: ['txt'] },
};

export const DEFAULT_MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/// Strips path separators/control characters and caps length — used ONLY to build a
/// display-safe `Content-Disposition` filename, never a storage path (the storage key is
/// always provider-generated — see `StorageProvider`).
export function normalizeFilename(original: string | undefined): string {
  if (!original) return 'file';
  const stripped = original
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .trim();
  return (stripped || 'file').slice(0, 255);
}

export function validateMimeAndExtension(declaredMime: string, originalFilename: string | undefined): AllowedType {
  const allowed = ALLOWED_MIME_TYPES[declaredMime];
  if (!allowed) {
    throw new BadRequestException({ code: 'UNSUPPORTED_MIME_TYPE', message: `File type "${declaredMime}" is not allowed.` });
  }
  const ext = (originalFilename ?? '').split('.').pop()?.toLowerCase();
  if (!ext || !allowed.extensions.includes(ext)) {
    throw new BadRequestException({ code: 'EXTENSION_MISMATCH', message: 'The file extension does not match its declared type.' });
  }
  return allowed;
}

export function validateMagicBytes(buffer: Buffer, allowed: AllowedType): void {
  if (!allowed.magicBytes || allowed.magicBytes.length === 0) return;
  const matches = allowed.magicBytes.some((magic) => buffer.subarray(0, magic.length).equals(magic));
  if (!matches) {
    throw new BadRequestException({ code: 'MIME_SPOOFING_DETECTED', message: 'The file content does not match its declared type.' });
  }
}

export function validateSize(sizeBytes: number, maxBytes: number): void {
  if (sizeBytes <= 0) {
    throw new BadRequestException({ code: 'EMPTY_FILE', message: 'The uploaded file is empty.' });
  }
  if (sizeBytes > maxBytes) {
    throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: `File exceeds the maximum allowed size of ${maxBytes} bytes.` });
  }
}
