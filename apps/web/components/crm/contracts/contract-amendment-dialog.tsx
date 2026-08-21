"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateAmendmentInput } from "@/lib/contracts/types";

/// The only path to change terms after signing (F04 instruction §9) — every field except
/// `reason`/`effectiveDate` is an optional override; the backend rejects a no-op amendment
/// (`409 NO_MATERIAL_CHANGE`) and rejects amending a never-signed contract
/// (`409 CONTRACT_NOT_YET_SIGNED`), never pre-checked here.
export function ContractAmendmentDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAmendmentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("");
  const [servicePackage, setServicePackage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setReason("");
    setEffectiveDate("");
    setValue("");
    setCurrency("");
    setServicePackage("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || !effectiveDate) return;
    setError(null);
    try {
      await onSubmit({
        reason: reason.trim(),
        effectiveDate,
        value: value ? Number(value) : undefined,
        currency: currency || undefined,
        servicePackage: servicePackage || undefined,
      });
      toast({ title: "Đã tạo amendment.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Tạo Amendment (điều chỉnh sau khi ký)">
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Chỉ điền những trường thực sự thay đổi — để trống nghĩa là giữ nguyên giá trị hiện tại.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="amendment-value" className="mb-1 block text-sm font-medium">
              Giá trị mới
            </label>
            <Input id="amendment-value" type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <label htmlFor="amendment-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ mới
            </label>
            <Input id="amendment-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
          </div>
        </div>
        <div>
          <label htmlFor="amendment-package" className="mb-1 block text-sm font-medium">
            Gói dịch vụ mới
          </label>
          <Input id="amendment-package" value={servicePackage} onChange={(e) => setServicePackage(e.target.value)} />
        </div>
        <div>
          <label htmlFor="amendment-effective-date" className="mb-1 block text-sm font-medium">
            Ngày hiệu lực *
          </label>
          <Input id="amendment-effective-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="amendment-reason" className="mb-1 block text-sm font-medium">
            Lý do *
          </label>
          <textarea
            id="amendment-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
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
          <Button type="submit" disabled={submitting || !reason.trim() || !effectiveDate}>
            {submitting ? "Đang lưu..." : "Tạo Amendment"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
