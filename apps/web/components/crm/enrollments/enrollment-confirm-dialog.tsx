"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";
import type { ConfirmEnrollmentInput } from "@/lib/enrollments/types";

/// Confirm Enrollment (F06 instruction §15) — `409 CONFIRMED_ENROLLMENT_EXISTS` (at-most-one-
/// confirmed-Enrollment-per-Case) is surfaced verbatim, never pre-checked client-side.
export function EnrollmentConfirmDialog({
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
  onSubmit: (input: ConfirmEnrollmentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [confirmationDate, setConfirmationDate] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setConfirmationDate("");
    setEvidenceDocumentId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        confirmationDate: confirmationDate || undefined,
        evidenceDocumentId: evidenceDocumentId.trim() || undefined,
      });
      toast({ title: "Đã xác nhận nhập học.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Xác nhận nhập học">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="enrollment-confirmation-date" className="mb-1 block text-sm font-medium">
            Ngày xác nhận
          </label>
          <Input id="enrollment-confirmation-date" type="date" value={confirmationDate} onChange={(e) => setConfirmationDate(e.target.value)} />
        </div>
        <DocumentAttachmentField
          documentId={evidenceDocumentId}
          onChange={setEvidenceDocumentId}
          ownerEntity="Case"
          ownerId={caseId}
          documentType="ENROLLMENT_CONFIRMATION_EVIDENCE"
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
            {submitting ? "Đang lưu..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
