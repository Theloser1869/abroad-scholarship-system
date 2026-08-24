"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { RecordVisaResultInput, VisaResult } from "@/lib/visas/types";

/// {SUBMITTED, APPOINTMENT, INTERVIEW} → {GRANTED, REFUSED}, terminal (F06 instruction §11).
/// `reason` is visible to the affected Student/Parent (their own outcome) — never redacted.
export function VisaResultDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: RecordVisaResultInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [result, setResult] = useState<VisaResult>("GRANTED");
  const [resultDate, setResultDate] = useState("");
  const [resultEvidenceDocumentId, setResultEvidenceDocumentId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setResult("GRANTED");
    setResultDate("");
    setResultEvidenceDocumentId("");
    setReason("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        result,
        resultDate: resultDate || undefined,
        resultEvidenceDocumentId: resultEvidenceDocumentId.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      toast({ title: result === "GRANTED" ? "Đã ghi nhận visa được cấp." : "Đã ghi nhận visa bị từ chối.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ghi nhận kết quả visa">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="visa-result" className="mb-1 block text-sm font-medium">
            Kết quả *
          </label>
          <select id="visa-result" value={result} onChange={(e) => setResult(e.target.value as VisaResult)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
            <option value="GRANTED">Đã cấp</option>
            <option value="REFUSED">Bị từ chối</option>
          </select>
        </div>
        <div>
          <label htmlFor="visa-result-date" className="mb-1 block text-sm font-medium">
            Ngày có kết quả
          </label>
          <Input id="visa-result-date" type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="visa-result-evidence" className="mb-1 block text-sm font-medium">
            Document ID minh chứng kết quả
          </label>
          <Input id="visa-result-evidence" value={resultEvidenceDocumentId} onChange={(e) => setResultEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
        </div>
        <div>
          <label htmlFor="visa-result-reason" className="mb-1 block text-sm font-medium">
            Lý do {result === "REFUSED" ? "từ chối" : "(nếu có)"}
          </label>
          <Textarea
            id="visa-result-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
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
          <Button type="submit" variant={result === "REFUSED" ? "danger" : "primary"} disabled={submitting}>
            {submitting ? "Đang lưu..." : "Ghi nhận kết quả"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
