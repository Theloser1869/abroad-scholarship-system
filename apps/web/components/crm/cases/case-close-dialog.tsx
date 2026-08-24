"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";

/// Closure entry point — the backend runs 4 sequential preconditions (open tasks, debt, open
/// visa, unconfirmed enrollment/incomplete pre-departure checklist) that this dialog never
/// pre-checks; a failing precondition surfaces as its own specific error (mapped in
/// lib/api/error-messages.ts), never a generic failure message.
export function CaseCloseDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (closureReason: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setReason("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) return;
    setError(null);
    try {
      await onSubmit(reason.trim());
      toast({ title: "Đã đóng case.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Đóng case">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Đóng case yêu cầu không còn task mở, không còn công nợ, không có visa đang xử lý, đã
          xác nhận nhập học và hoàn tất checklist trước khi khởi hành. Thao tác này không thể
          hoàn tác.
        </p>
        <div>
          <label htmlFor="closure-reason" className="mb-1 block text-sm font-medium">
            Lý do đóng case *
          </label>
          <Textarea
            id="closure-reason"
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
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
          <Button type="submit" variant="danger" disabled={submitting || reason.trim().length < 3}>
            {submitting ? "Đang đóng..." : "Xác nhận đóng case"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
