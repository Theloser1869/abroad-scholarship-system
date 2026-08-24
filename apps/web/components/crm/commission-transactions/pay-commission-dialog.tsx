"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { PayCommissionTransactionInput } from "@/lib/commission-transactions/types";

/// PAYABLE → PAID (terminal, F06 instruction §23) — records the settlement reference.
export function PayCommissionDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: PayCommissionTransactionInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [paymentReference, setPaymentReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setPaymentReference("");
    setPaidAt("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ paymentReference: paymentReference.trim(), paidAt: paidAt || undefined });
      toast({ title: "Đã ghi nhận thanh toán hoa hồng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Xác nhận thanh toán hoa hồng">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">Thao tác này không thể hoàn tác — giao dịch sẽ chuyển sang trạng thái Đã thanh toán (kết thúc).</p>
        <div>
          <label htmlFor="pay-commission-reference" className="mb-1 block text-sm font-medium">
            Mã tham chiếu thanh toán *
          </label>
          <Input id="pay-commission-reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="pay-commission-date" className="mb-1 block text-sm font-medium">
            Ngày thanh toán
          </label>
          <Input id="pay-commission-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
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
          <Button type="submit" variant="primary" disabled={submitting || !paymentReference.trim()}>
            {submitting ? "Đang xử lý..." : "Xác nhận thanh toán"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
