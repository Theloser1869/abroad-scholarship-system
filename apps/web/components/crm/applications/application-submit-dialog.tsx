"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { SubmitApplicationInput } from "@/lib/applications/types";

/// READY_FOR_REVIEW → SUBMITTED. The backend is the sole checklist-completeness gate
/// (`409 CHECKLIST_INCOMPLETE`) — this dialog never pre-checks the loaded checklist itself,
/// it only submits and shows whatever the server says (F05 instruction §16).
export function ApplicationSubmitDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: SubmitApplicationInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [submissionChannel, setSubmissionChannel] = useState("");
  const [submissionReference, setSubmissionReference] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setSubmissionChannel("");
    setSubmissionReference("");
    setEvidenceDocumentId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        submissionChannel: submissionChannel.trim() || undefined,
        submissionReference: submissionReference.trim() || undefined,
        evidenceDocumentId: evidenceDocumentId.trim() || undefined,
      });
      toast({ title: "Đã nộp hồ sơ ứng tuyển.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nộp hồ sơ ứng tuyển">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">Mọi hạng mục checklist bắt buộc phải ở trạng thái Hoàn tất hoặc Miễn trừ trước khi nộp.</p>
        <div>
          <label htmlFor="application-submission-channel" className="mb-1 block text-sm font-medium">
            Kênh nộp
          </label>
          <Input id="application-submission-channel" value={submissionChannel} onChange={(e) => setSubmissionChannel(e.target.value)} placeholder="Cổng trực tuyến, email..." />
        </div>
        <div>
          <label htmlFor="application-submission-reference" className="mb-1 block text-sm font-medium">
            Mã tham chiếu
          </label>
          <Input id="application-submission-reference" value={submissionReference} onChange={(e) => setSubmissionReference(e.target.value)} />
        </div>
        <div>
          <label htmlFor="application-evidence-document" className="mb-1 block text-sm font-medium">
            Document ID minh chứng nộp hồ sơ
          </label>
          <Input id="application-evidence-document" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
            {submitting ? "Đang nộp..." : "Nộp hồ sơ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
