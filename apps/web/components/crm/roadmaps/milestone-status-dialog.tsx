"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { ApiError } from "@/lib/api/types";
import { MILESTONE_STATUS_LABEL } from "@/components/crm/status-badge";
import { MILESTONE_STATUSES, type MilestoneStatus, type PrerequisiteNotDoneDetail } from "@/lib/roadmaps/types";

/// `409 PREREQUISITE_NOT_DONE` on a DONE attempt is surfaced with its exact unmet-dependency
/// IDs (F04 instruction §21) — never pre-checked client-side.
export function MilestoneStatusDialog({
  open,
  onClose,
  currentStatus,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  currentStatus: MilestoneStatus;
  onSubmit: (status: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [status, setStatus] = useState<string>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [prerequisiteDetail, setPrerequisiteDetail] = useState<PrerequisiteNotDoneDetail | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStatus(currentStatus);
    setError(null);
    setPrerequisiteDetail(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPrerequisiteDetail(null);
    try {
      await onSubmit(status);
      toast({ title: "Đã cập nhật trạng thái mốc lộ trình.", variant: "success" });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "PREREQUISITE_NOT_DONE") {
        setPrerequisiteDetail({
          unmetMilestoneIds: Array.isArray(err.raw.unmetMilestoneIds) ? (err.raw.unmetMilestoneIds as string[]) : undefined,
          unmetTaskIds: Array.isArray(err.raw.unmetTaskIds) ? (err.raw.unmetTaskIds as string[]) : undefined,
        });
      }
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chuyển trạng thái mốc lộ trình">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="milestone-status" className="mb-1 block text-sm font-medium">
            Trạng thái mốc mới
          </label>
          <select
            id="milestone-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {MILESTONE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MILESTONE_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {prerequisiteDetail ? (
          <div className="rounded border border-danger/40 bg-danger/5 p-2 text-xs">
            {prerequisiteDetail.unmetMilestoneIds?.length ? <p>Mốc chưa hoàn tất: {prerequisiteDetail.unmetMilestoneIds.join(", ")}</p> : null}
            {prerequisiteDetail.unmetTaskIds?.length ? <p>Nhiệm vụ chưa hoàn tất: {prerequisiteDetail.unmetTaskIds.join(", ")}</p> : null}
          </div>
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
