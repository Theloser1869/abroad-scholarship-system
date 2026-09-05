"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";
import type { CreateWritingVersionInput } from "@/lib/writing/types";

/// Always creates a NEW version row — there is no "edit this version" endpoint, so a Final/
/// Submitted artifact's content is structurally immutable, not just policy-forbidden (F04
/// instruction §29). `409 WRITING_ARTIFACT_SUBMITTED` surfaced verbatim if the artifact is
/// already terminal.
export function WritingVersionDialog({
  open,
  onClose,
  caseId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Owner for any evidence document uploaded inline through this dialog. */
  caseId: string;
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
          <Textarea
            id="version-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        </div>
        <DocumentAttachmentField
          label="Tệp đính kèm thay thế"
          documentId={documentId}
          onChange={setDocumentId}
          ownerEntity="Case"
          ownerId={caseId}
          documentType="WRITING_VERSION_ATTACHMENT"
        />
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
