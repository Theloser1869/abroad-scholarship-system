"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { ApiError } from "@/lib/api/types";
import type { Payment, RecordPaymentInput } from "@/lib/payments/types";

/// Records a payment against one installment. Mirrors F03's `LeadConvertDialog` conflict-
/// resubmit pattern: a first attempt without `allowOverpayment` that comes back
/// `409 OVERPAYMENT_NOT_ALLOWED { outstandingBeforePayment }` re-renders with that amount and
/// an explicit confirm checkbox — never client-pre-decided (F04 instruction §13).
export function PaymentRecordDialog({
  open,
  onClose,
  payment,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  onSubmit: (input: RecordPaymentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overpaymentPrompt, setOverpaymentPrompt] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setAmount(payment?.outstandingAmount ?? "");
    setPaidDate("");
    setMethod("");
    setReference("");
    setError(null);
    setOverpaymentPrompt(null);
  });

  async function attemptSubmit(allow: boolean) {
    setError(null);
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Số tiền không hợp lệ.");
      return;
    }
    try {
      await onSubmit({
        amount: numericAmount,
        paidDate: paidDate || undefined,
        method: method || undefined,
        reference: reference || undefined,
        allowOverpayment: allow,
      });
      toast({ title: "Đã ghi nhận thanh toán.", variant: "success" });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "OVERPAYMENT_NOT_ALLOWED") {
        const outstanding = typeof err.raw.outstandingBeforePayment === "string" ? err.raw.outstandingBeforePayment : undefined;
        setOverpaymentPrompt(outstanding ?? "0");
        return;
      }
      setError(crmErrorMessage(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await attemptSubmit(false);
  }

  async function handleConfirmOverpayment() {
    await attemptSubmit(true);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ghi nhận thanh toán">
      {overpaymentPrompt ? (
        <div className="space-y-3">
          <p className="text-sm text-warning-foreground">
            Số tiền nhập vượt quá số còn phải thu (còn lại: {overpaymentPrompt}). Xác nhận cho phép ghi nhận trả dư?
          </p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOverpaymentPrompt(null)} disabled={submitting}>
              Quay lại
            </Button>
            <Button type="button" onClick={handleConfirmOverpayment} disabled={submitting}>
              {submitting ? "Đang ghi nhận..." : "Xác nhận cho phép trả dư"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <p className="text-xs text-muted-foreground">Còn phải thu: {payment?.outstandingAmount ?? "—"} {payment?.currency ?? ""}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="record-amount" className="mb-1 block text-sm font-medium">
                Số tiền *
              </label>
              <Input id="record-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="record-paid-date" className="mb-1 block text-sm font-medium">
                Ngày thanh toán
              </label>
              <Input id="record-paid-date" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="record-method" className="mb-1 block text-sm font-medium">
                Phương thức
              </label>
              <Input id="record-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Chuyển khoản, tiền mặt..." />
            </div>
            <div>
              <label htmlFor="record-reference" className="mb-1 block text-sm font-medium">
                Mã tham chiếu
              </label>
              <Input id="record-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
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
              {submitting ? "Đang ghi nhận..." : "Ghi nhận"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
