"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { DocumentRecord, UpdateDocumentInput } from "@/lib/documents/types";

/// Metadata-only edit (title/documentType) — mirrors `UpdateDocumentDto` exactly. Never
/// offers to replace the file itself (that is `DocumentVersionDialog`'s job).
export function DocumentEditDialog({
  open,
  onClose,
  document,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  document: DocumentRecord;
  onSubmit: (input: UpdateDocumentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(document.title);
  const [documentType, setDocumentType] = useState(document.documentType);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const titleId = useId();
  const typeId = useId();

  useResetOnOpen(open, () => {
    setTitle(document.title);
    setDocumentType(document.documentType);
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ title: title.trim(), documentType: documentType.trim() });
      toast({ title: "Đã cập nhật tài liệu.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chỉnh sửa tài liệu">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor={titleId} className="mb-1 block text-sm font-medium">
            Tiêu đề
          </label>
          <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required />
        </div>
        <div>
          <label htmlFor={typeId} className="mb-1 block text-sm font-medium">
            Loại tài liệu
          </label>
          <Input id={typeId} value={documentType} onChange={(e) => setDocumentType(e.target.value)} maxLength={100} required />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
