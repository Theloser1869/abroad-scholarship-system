"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";
import type { SubmitVisaInput } from "@/lib/visas/types";

/// READY → SUBMITTED. The backend re-verifies the mandatory-checklist gate server-side
/// (`409 CHECKLIST_INCOMPLETE`) — this dialog never pre-checks the loaded checklist itself
/// (F06 instruction §9).
export function VisaSubmitDialog({
  open,
  onClose,
  studentId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Owner for any evidence document uploaded inline through this dialog. */
  studentId: string;
  onSubmit: (input: SubmitVisaInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [submissionReference, setSubmissionReference] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setSubmissionReference("");
    setEvidenceDocumentId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ submissionReference: submissionReference.trim() || undefined, evidenceDocumentId: evidenceDocumentId.trim() || undefined });
      toast({ title: "Đã nộp hồ sơ visa.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nộp hồ sơ visa">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">Mọi hạng mục checklist bắt buộc phải ở trạng thái Hoàn tất hoặc Miễn trừ trước khi nộp.</p>
        <div>
          <label htmlFor="visa-submission-reference" className="mb-1 block text-sm font-medium">
            Mã tham chiếu nộp hồ sơ
          </label>
          <Input id="visa-submission-reference" value={submissionReference} onChange={(e) => setSubmissionReference(e.target.value)} />
        </div>
        <DocumentAttachmentField
          documentId={evidenceDocumentId}
          onChange={setEvidenceDocumentId}
          ownerEntity="Student"
          ownerId={studentId}
          documentType="VISA_SUBMISSION_EVIDENCE"
        />
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
            {submitting ? "Đang nộp..." : "Nộp hồ sơ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
