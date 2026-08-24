"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/types";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { APPLICATION_STATUS_LABEL } from "@/components/crm/status-badge";
import { MANUAL_APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/applications/types";

/// Every status except SUBMITTED (its own `/submit` action) and OFFER (reachable only via
/// creating an Offer) — the backend's FSM is the sole authority
/// (`409 INVALID_APPLICATION_STATUS_TRANSITION { allowedTransitions }`), never pre-validated
/// here (F05 instruction §15).
export function ApplicationStatusDialog({
  open,
  onClose,
  currentStatus,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  currentStatus: ApplicationStatus;
  onSubmit: (input: { status: string; reason?: string }) => Promise<unknown>;
  submitting: boolean;
}) {
  const [status, setStatus] = useState<string>(MANUAL_APPLICATION_STATUSES[0]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [allowedTransitions, setAllowedTransitions] = useState<ApplicationStatus[] | undefined>(undefined);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStatus(MANUAL_APPLICATION_STATUSES[0]);
    setReason("");
    setError(null);
    setAllowedTransitions(undefined);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAllowedTransitions(undefined);
    try {
      await onSubmit({ status, reason: reason.trim() || undefined });
      toast({ title: "Đã cập nhật trạng thái hồ sơ.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
      if (err instanceof ApiError && err.code === "INVALID_APPLICATION_STATUS_TRANSITION" && Array.isArray(err.raw.allowedTransitions)) {
        setAllowedTransitions(err.raw.allowedTransitions as ApplicationStatus[]);
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chuyển trạng thái hồ sơ ứng tuyển">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-muted-foreground">Trạng thái hiện tại: {APPLICATION_STATUS_LABEL[currentStatus] ?? currentStatus}</p>
        <div>
          <label htmlFor="application-status-select" className="mb-1 block text-sm font-medium">
            Trạng thái hồ sơ mới
          </label>
          <select
            id="application-status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {MANUAL_APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="application-status-reason" className="mb-1 block text-sm font-medium">
            Ghi chú (tùy chọn)
          </label>
          <Textarea
            id="application-status-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
        </div>
        {error ? (
          <div role="alert" className="space-y-1 text-sm text-danger">
            <p>{error}</p>
            {allowedTransitions ? (
              <p>Trạng thái hợp lệ tiếp theo: {allowedTransitions.length > 0 ? allowedTransitions.map((s) => APPLICATION_STATUS_LABEL[s] ?? s).join(", ") : "Không còn trạng thái nào (kết thúc)."}</p>
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
