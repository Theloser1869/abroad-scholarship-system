"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";

/// `signedDocumentId` references an already-uploaded signed artifact — manual ID entry, same
/// documented limitation as every other picker in this phase (no document upload/browse UI
/// exists yet, F07 scope). Irreversible: SENT→SIGNED requires the Student already have
/// exactly one active Case (`409 NO_ACTIVE_CASE_FOR_STUDENT`/`CASE_ALREADY_LINKED`).
export function ContractSignDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
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
        <div>
          <label htmlFor="contract-signed-document-id" className="mb-1 block text-sm font-medium">
            Document ID bản đã ký *
          </label>
          <Input
            id="contract-signed-document-id"
            value={signedDocumentId}
            onChange={(e) => setSignedDocumentId(e.target.value)}
            placeholder="UUID tài liệu đã ký"
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
          <Button type="submit" variant="danger" disabled={submitting || !signedDocumentId.trim()}>
            {submitting ? "Đang ký..." : "Xác nhận ký"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
