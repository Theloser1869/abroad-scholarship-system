"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/types";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { VISA_STATUS_LABEL } from "@/components/crm/status-badge";
import { MANUAL_VISA_STATUSES, type VisaStatus } from "@/lib/visas/types";

/// Every status except SUBMITTED/APPOINTMENT/INTERVIEW (their own dedicated, data-carrying
/// actions) and GRANTED/REFUSED (their own dedicated `result` action) — F06 instruction §8.
/// Targeting READY re-checks the mandatory-checklist gate server-side
/// (`409 CHECKLIST_INCOMPLETE`), surfaced verbatim, never pre-computed from the loaded
/// checklist.
export function VisaStatusDialog({
  open,
  onClose,
  currentStatus,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  currentStatus: VisaStatus;
  onSubmit: (status: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [status, setStatus] = useState<string>(MANUAL_VISA_STATUSES[0]);
  const [error, setError] = useState<string | null>(null);
  const [allowedTransitions, setAllowedTransitions] = useState<VisaStatus[] | undefined>(undefined);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStatus(MANUAL_VISA_STATUSES[0]);
    setError(null);
    setAllowedTransitions(undefined);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAllowedTransitions(undefined);
    try {
      await onSubmit(status);
      toast({ title: "Đã cập nhật trạng thái hồ sơ visa.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
      if (err instanceof ApiError && err.code === "INVALID_VISA_STATUS_TRANSITION" && Array.isArray(err.raw.allowedTransitions)) {
        setAllowedTransitions(err.raw.allowedTransitions as VisaStatus[]);
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chuyển trạng thái hồ sơ visa">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-muted-foreground">Trạng thái hiện tại: {VISA_STATUS_LABEL[currentStatus] ?? currentStatus}</p>
        <div>
          <label htmlFor="visa-status-select" className="mb-1 block text-sm font-medium">
            Trạng thái visa mới
          </label>
          <select id="visa-status-select" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
            {MANUAL_VISA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VISA_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <div role="alert" className="space-y-1 text-sm text-danger">
            <p>{error}</p>
            {allowedTransitions ? (
              <p>Trạng thái hợp lệ tiếp theo: {allowedTransitions.length > 0 ? allowedTransitions.map((s) => VISA_STATUS_LABEL[s] ?? s).join(", ") : "Không còn trạng thái nào (kết thúc)."}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang cập nhật..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
