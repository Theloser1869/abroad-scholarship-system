"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";

/// Shared confirm-with-optional-or-required-reason dialog — reused across every
/// approve/reject/waive-style action in F04 (Contract approve/reject, Assessment approve/
/// reject, Roadmap approve/reject, Payment waive), matching F04 instruction §32 ("reuse Table/
/// Dialog/Form... không tạo duplicate UI primitives"). The backend is always the FSM/business
/// authority — this only collects the reason string and shows the real server response.
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  reasonLabel = "Lý do",
  reasonRequired = false,
  confirmLabel = "Xác nhận",
  variant = "primary",
  successMessage = "Đã thực hiện.",
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  confirmLabel?: string;
  variant?: ButtonVariant;
  successMessage?: string;
  onSubmit: (reason: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const textareaId = useId();

  useResetOnOpen(open, () => {
    setReason("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reasonRequired && !reason.trim()) return;
    setError(null);
    try {
      await onSubmit(reason.trim());
      toast({ title: successMessage, variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        <div>
          <label htmlFor={textareaId} className="mb-1 block text-sm font-medium">
            {reasonLabel}
            {reasonRequired ? " *" : " (tùy chọn)"}
          </label>
          <textarea
            id={textareaId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required={reasonRequired}
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
          <Button type="submit" variant={variant} disabled={submitting || (reasonRequired && !reason.trim())}>
            {submitting ? "Đang xử lý..." : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
