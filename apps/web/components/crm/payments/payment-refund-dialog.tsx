"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { Payment, RefundPaymentInput } from "@/lib/payments/types";

/// Refund is allowed even on a terminal (LIQUIDATED/ARCHIVED) contract (confirmed against
/// `PaymentsService.refund` — no contract-state block, unlike `record`/`create`) —
/// `409 REFUND_EXCEEDS_NET_PAID { netPaid }` surfaced verbatim, never pre-checked here.
export function PaymentRefundDialog({
  open,
  onClose,
  payment,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  onSubmit: (input: RefundPaymentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setAmount("");
    setReason("");
    setReference("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0 || !reason.trim()) {
      setError("Vui lòng nhập số tiền và lý do hợp lệ.");
      return;
    }
    setError(null);
    try {
      await onSubmit({ amount: numericAmount, reason: reason.trim(), reference: reference || undefined });
      toast({ title: "Đã hoàn tiền.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Hoàn tiền">
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <p className="text-sm text-warning-foreground">
          Thao tác tài chính nhạy cảm — kiểm tra kỹ trước khi xác nhận. Đã thanh toán thực nhận: {payment?.paidAmount ?? "—"}{" "}
          {payment?.currency ?? ""} (đã hoàn: {payment?.refundedAmount ?? "0"}).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="refund-amount" className="mb-1 block text-sm font-medium">
              Số tiền hoàn *
            </label>
            <Input id="refund-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="refund-reference" className="mb-1 block text-sm font-medium">
              Mã tham chiếu
            </label>
            <Input id="refund-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="refund-reason" className="mb-1 block text-sm font-medium">
            Lý do *
          </label>
          <Textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
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
          <Button type="submit" variant="danger" disabled={submitting || !amount || !reason.trim()}>
            {submitting ? "Đang xử lý..." : "Xác nhận hoàn tiền"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
