"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreatePaymentInput } from "@/lib/payments/types";

/// Adds one installment to a SIGNED contract — `409 CONTRACT_NOT_YET_SIGNED`/
/// `409 CURRENCY_MISMATCH`/`409 DUPLICATE_INSTALLMENT` surfaced verbatim, never
/// pre-validated here.
export function PaymentCreateDialog({
  open,
  onClose,
  contractCurrency,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  contractCurrency: string | null;
  onSubmit: (input: CreatePaymentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [installmentNo, setInstallmentNo] = useState("1");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setInstallmentNo("1");
    setAmount("");
    setDueDate("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numericAmount = Number(amount);
    const numericInstallment = Number(installmentNo);
    if (Number.isNaN(numericAmount) || numericAmount <= 0 || Number.isNaN(numericInstallment) || numericInstallment < 1 || !dueDate) {
      setError("Vui lòng nhập đầy đủ và hợp lệ.");
      return;
    }
    try {
      await onSubmit({ installmentNo: numericInstallment, amount: numericAmount, currency: contractCurrency ?? "VND", dueDate });
      toast({ title: "Đã thêm kỳ thanh toán.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Thêm kỳ thanh toán">
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="payment-installment-no" className="mb-1 block text-sm font-medium">
              Kỳ số *
            </label>
            <Input id="payment-installment-no" type="number" min="1" value={installmentNo} onChange={(e) => setInstallmentNo(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="payment-amount" className="mb-1 block text-sm font-medium">
              Số tiền ({contractCurrency ?? "—"}) *
            </label>
            <Input id="payment-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>
        <div>
          <label htmlFor="payment-due-date" className="mb-1 block text-sm font-medium">
            Hạn thanh toán *
          </label>
          <Input id="payment-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
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
            {submitting ? "Đang lưu..." : "Thêm"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
