"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { useUploadDocument } from "@/lib/documents/hooks";
import { ALLOWED_DOCUMENT_ACCEPT, validateFileClientSide } from "@/lib/documents/file-validation";

/// Shared "submit evidence" flow for both the Roadmap-milestone and Application-checklist
/// Portal actions (F08 instruction §14/§19 — both are a single-document link). Two real
/// backend steps, never one invented combined endpoint: (1) `POST /documents` (F07's existing
/// upload primitive — the caller must be the one who uploaded it, `409 DOCUMENT_NOT_OWNED`
/// otherwise, so this dialog always uploads fresh rather than letting a student attach an
/// already-shared document as if it were their own submission), then (2) the narrow
/// evidence-submit action with that new document's id. Never a general "edit roadmap/
/// checklist" surface (F08 instruction §14: "Do not invent general roadmap editing").
export function EvidenceUploadDialog({
  open,
  onClose,
  title,
  studentId,
  documentType,
  onSubmitEvidence,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  studentId: string;
  documentType: string;
  onSubmitEvidence: (documentId: string) => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const uploadDocument = useUploadDocument();

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
      const uploaded = await uploadDocument.mutateAsync({
        input: { ownerEntity: "Student", ownerId: studentId, documentType, title },
        file,
      });
      await onSubmitEvidence(uploaded.id);
      toast({ title: "Đã gửi minh chứng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  const submitting = uploadDocument.isPending;

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">Chọn tệp minh chứng để gửi. Tệp sẽ được tải lên và gửi ngay.</p>
        <div>
          <label className="mb-1 block text-sm font-medium">Tệp minh chứng</label>
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
            {submitting ? "Đang gửi..." : "Gửi minh chứng"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
