"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { AwardScholarshipInput } from "@/lib/scholarship-applications/types";

/// SCHOLARSHIP RESULT (F05 instruction §23) — records amount/currency/coverage/period/
/// acceptance-deadline/evidence together, atomically, only from UNDER_REVIEW/INTERVIEW.
/// Never creates a Contract/Payment record — deliberately kept separate from the
/// commercial domain (no such fields exist on this entity at all).
export function AwardDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AwardScholarshipInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [awardAmount, setAwardAmount] = useState("");
  const [awardCurrency, setAwardCurrency] = useState("");
  const [awardCoverageType, setAwardCoverageType] = useState("");
  const [awardPeriod, setAwardPeriod] = useState("");
  const [awardAcceptanceDeadline, setAwardAcceptanceDeadline] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setAwardAmount("");
    setAwardCurrency("");
    setAwardCoverageType("");
    setAwardPeriod("");
    setAwardAcceptanceDeadline("");
    setEvidenceDocumentId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        awardAmount: awardAmount ? Number(awardAmount) : undefined,
        awardCurrency: awardCurrency.trim() || undefined,
        awardCoverageType: awardCoverageType.trim() || undefined,
        awardPeriod: awardPeriod.trim() || undefined,
        awardAcceptanceDeadline: awardAcceptanceDeadline || undefined,
        evidenceDocumentId: evidenceDocumentId.trim() || undefined,
      });
      toast({ title: "Đã ghi nhận kết quả trao học bổng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Trao học bổng (Scholarship Result)">
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="award-amount" className="mb-1 block text-sm font-medium">
              Giá trị
            </label>
            <Input id="award-amount" type="number" min="0" step="0.01" value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="award-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ
            </label>
            <Input id="award-currency" value={awardCurrency} onChange={(e) => setAwardCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="award-coverage" className="mb-1 block text-sm font-medium">
              Loại chi trả
            </label>
            <Input id="award-coverage" value={awardCoverageType} onChange={(e) => setAwardCoverageType(e.target.value)} placeholder="Full tuition..." />
          </div>
          <div>
            <label htmlFor="award-period" className="mb-1 block text-sm font-medium">
              Kỳ hạn
            </label>
            <Input id="award-period" value={awardPeriod} onChange={(e) => setAwardPeriod(e.target.value)} placeholder="Per year..." />
          </div>
        </div>
        <div>
          <label htmlFor="award-acceptance-deadline" className="mb-1 block text-sm font-medium">
            Hạn xác nhận nhận học bổng
          </label>
          <Input id="award-acceptance-deadline" type="date" value={awardAcceptanceDeadline} onChange={(e) => setAwardAcceptanceDeadline(e.target.value)} />
        </div>
        <div>
          <label htmlFor="award-evidence-document" className="mb-1 block text-sm font-medium">
            Document ID minh chứng
          </label>
          <Input id="award-evidence-document" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
            {submitting ? "Đang lưu..." : "Xác nhận trao học bổng"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
