/// Client-side mirror of `apps/api/src/common/storage/file-validation.util.ts`'s
/// `ALLOWED_MIME_TYPES`/`DEFAULT_MAX_DOCUMENT_SIZE_BYTES` — for UX only (an early, friendly
/// error before a doomed upload), never the security boundary. The backend re-validates
/// MIME/extension/size/magic-bytes authoritatively regardless of what passes here (F07
/// instruction §8 — "Backend remains authoritative"; the real configured
/// `DOCUMENT_MAX_SIZE_BYTES` env value is not readable from the frontend, so this is the
/// documented default, a hint, not a guarantee).
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "xls",
  "ppt",
  "docx",
  "xlsx",
  "pptx",
  "zip",
  "txt",
] as const;

export const ALLOWED_DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export const DEFAULT_MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — mirrors the backend default.

export function validateFileClientSide(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !(ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Loại tệp này không được hỗ trợ.";
  }
  if (file.size <= 0) {
    return "Tệp đang trống.";
  }
  if (file.size > DEFAULT_MAX_DOCUMENT_SIZE_BYTES) {
    return "Tệp vượt quá kích thước tối đa cho phép (25MB).";
  }
  return null;
}

export function formatFileSize(bytes: string | number | null): string {
  if (bytes === null) return "—";
  const n = Number(bytes);
  if (Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
