"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateWritingVersionInput } from "@/lib/writing/types";

/// Always creates a NEW version row — there is no "edit this version" endpoint, so a Final/
/// Submitted artifact's content is structurally immutable, not just policy-forbidden (F04
/// instruction §29). `409 WRITING_ARTIFACT_SUBMITTED` surfaced verbatim if the artifact is
/// already terminal.
export function WritingVersionDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateWritingVersionInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [content, setContent] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setContent("");
    setDocumentId("");
    setChangeSummary("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ content: content || undefined, documentId: documentId || undefined, changeSummary: changeSummary || undefined });
      toast({ title: "Đã tạo phiên bản mới.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Tạo phiên bản mới">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="version-content" className="mb-1 block text-sm font-medium">
            Nội dung
          </label>
          <textarea
            id="version-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="version-document" className="mb-1 block text-sm font-medium">
            Document ID (tệp đính kèm thay thế)
          </label>
          <Input id="version-document" value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
        </div>
        <div>
          <label htmlFor="version-change-summary" className="mb-1 block text-sm font-medium">
            Tóm tắt thay đổi
          </label>
          <Input id="version-change-summary" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
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
            {submitting ? "Đang lưu..." : "Tạo phiên bản"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
