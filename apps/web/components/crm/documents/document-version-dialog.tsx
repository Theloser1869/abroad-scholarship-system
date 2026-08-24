"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { ALLOWED_DOCUMENT_ACCEPT, validateFileClientSide } from "@/lib/documents/file-validation";
import type { UploadDocumentResult } from "@/lib/documents/types";

/// Always creates a brand-new Document row (own id, own `documentCode`) chained back via
/// `previousVersionId` — never an in-place content swap ("không overwrite... final/submitted/
/// legal files require versioning"). `onSubmit` returns the new row so the caller can
/// navigate to its own detail page — the old id's cache has nothing to invalidate.
export function DocumentVersionDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (file: File) => Promise<UploadDocumentResult>;
  submitting: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setFile(null);
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const clientError = validateFileClientSide(file);
    if (clientError) {
      setError(clientError);
      return;
    }
    setError(null);
    try {
      await onSubmit(file);
      toast({ title: "Đã tạo phiên bản mới.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Tạo phiên bản mới">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Tệp mới sẽ tạo một tài liệu mới, liên kết tới tài liệu hiện tại là phiên bản trước đó — không ghi đè tệp gốc.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">Tệp phiên bản mới</label>
          <input
            type="file"
            accept={ALLOWED_DOCUMENT_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
            required
          />
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
          <Button type="submit" disabled={submitting || !file}>
            {submitting ? "Đang tải lên..." : "Tạo phiên bản"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
