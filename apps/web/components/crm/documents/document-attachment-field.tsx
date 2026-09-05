"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { resolveApiUrl } from "@/lib/api/client";
import { requestDocumentDownload } from "@/lib/documents/api";
import { useDocument, useUploadDocument } from "@/lib/documents/hooks";
import { ALLOWED_DOCUMENT_ACCEPT, validateFileClientSide } from "@/lib/documents/file-validation";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Inline replacement for the old "Document ID minh chứng" raw-UUID text inputs scattered
/// across staff dialogs (visa/pre-departure/application checklists, profile evidence, offers,
/// enrollments, contracts, roadmap milestones, partner documents...). Same upload primitive
/// `EvidenceUploadDialog` already uses on the Portal side (`POST /documents` via
/// `useUploadDocument`, F07's existing subsystem) — never a new upload mechanism. After
/// upload the field shows the attached file (name, view, replace, remove) so staff can
/// confirm/change it without leaving the form or knowing any UUID.
export function DocumentAttachmentField({
  label = "Tài liệu minh chứng",
  documentId,
  onChange,
  ownerEntity,
  ownerId,
  documentType,
  required = false,
}: {
  label?: string;
  documentId: string;
  onChange: (documentId: string) => void;
  ownerEntity: string;
  ownerId: string;
  documentType: string;
  required?: boolean;
}) {
  const { data: doc } = useDocument(documentId || undefined);
  const uploadDocument = useUploadDocument();
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    const clientError = validateFileClientSide(file);
    if (clientError) {
      setError(clientError);
      return;
    }
    setError(null);
    try {
      const uploaded = await uploadDocument.mutateAsync({
        input: { ownerEntity, ownerId, documentType, title: file.name },
        file,
      });
      onChange(uploaded.id);
    } catch (err) {
      setError(crmErrorMessage(err));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleView() {
    setViewing(true);
    try {
      const { downloadUrl } = await requestDocumentDownload(documentId);
      window.open(resolveApiUrl(downloadUrl), "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(crmErrorMessage(err));
    } finally {
      setViewing(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </label>
      {documentId ? (
        <div className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm">
          <span className="flex-1 truncate">{doc?.originalFilename ?? doc?.title ?? "Tài liệu đã đính kèm"}</span>
          <Button type="button" variant="secondary" onClick={handleView} disabled={viewing}>
            {viewing ? "Đang mở..." : "Xem"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploadDocument.isPending}>
            {uploadDocument.isPending ? "Đang tải lên..." : "Thay đổi"}
          </Button>
          {!required ? (
            <Button type="button" variant="secondary" onClick={() => onChange("")}>
              Gỡ
            </Button>
          ) : null}
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploadDocument.isPending}>
          {uploadDocument.isPending ? "Đang tải lên..." : "Tải lên tệp"}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
