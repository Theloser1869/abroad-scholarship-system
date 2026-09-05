"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";

/// `signedDocumentId` is uploaded inline via `DocumentAttachmentField` — no more manual UUID
/// entry (F07's existing upload primitive, same as `EvidenceUploadDialog`). Irreversible:
/// SENT→SIGNED requires the Student already have exactly one active Case (`409
/// NO_ACTIVE_CASE_FOR_STUDENT`/`CASE_ALREADY_LINKED`).
export function ContractSignDialog({
  open,
  onClose,
  studentId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Owner for the signed document uploaded inline through this dialog. */
  studentId: string;
  onSubmit: (signedDocumentId: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [signedDocumentId, setSignedDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setSignedDocumentId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedDocumentId.trim()) return;
    setError(null);
    try {
      await onSubmit(signedDocumentId.trim());
      toast({ title: "Đã ký hợp đồng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ký hợp đồng">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-danger">
          Thao tác này không thể hoàn tác — hợp đồng sẽ trở thành bất biến (chỉ có thể sửa qua Amendment sau khi ký).
        </p>
        <DocumentAttachmentField
          label="Bản hợp đồng đã ký"
          documentId={signedDocumentId}
          onChange={setSignedDocumentId}
          ownerEntity="Student"
          ownerId={studentId}
          documentType="CONTRACT_SIGNED"
          required
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
          <Button type="submit" variant="danger" disabled={submitting || !signedDocumentId.trim()}>
            {submitting ? "Đang ký..." : "Xác nhận ký"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
