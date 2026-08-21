"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { LEAD_STATUS_LABEL } from "@/components/crm/status-badge";
import { MANUAL_LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";

/// FSM-validated server-side — this dialog only offers `MANUAL_LEAD_STATUSES` (CONVERTED
/// excluded, only reachable via the dedicated convert flow). An illegal transition still
/// comes back as `409 INVALID_STATUS_TRANSITION` and is surfaced verbatim, never
/// pre-validated against a client-side copy of the FSM table.
export function LeadStatusDialog({
  open,
  onClose,
  currentStatus,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  currentStatus: LeadStatus;
  onSubmit: (status: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [status, setStatus] = useState<string>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStatus(currentStatus);
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(status);
      toast({ title: "Đã cập nhật trạng thái.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chuyển trạng thái lead">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="lead-status" className="mb-1 block text-sm font-medium">
            Trạng thái mới
          </label>
          <select
            id="lead-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {MANUAL_LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
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
          <Button type="submit" disabled={submitting || status === currentStatus}>
            {submitting ? "Đang cập nhật..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
