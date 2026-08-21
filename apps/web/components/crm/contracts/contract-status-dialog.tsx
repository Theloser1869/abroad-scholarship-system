"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { CONTRACT_STATUS_LABEL } from "@/components/crm/status-badge";
import { MANUAL_CONTRACT_STATUSES, type ContractStatus } from "@/lib/contracts/types";

/// Only the 4 linear post-sign moves (SIGNED→ACTIVE→COMPLETED→LIQUIDATED→ARCHIVED, one step
/// forward at a time) — FSM-validated server-side, `409 INVALID_STATUS_TRANSITION` for
/// anything else, never pre-validated here (F04 instruction §8).
export function ContractStatusDialog({
  open,
  onClose,
  currentStatus,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  currentStatus: ContractStatus;
  onSubmit: (status: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [status, setStatus] = useState<string>(MANUAL_CONTRACT_STATUSES[0]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStatus(MANUAL_CONTRACT_STATUSES[0]);
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(status);
      toast({ title: "Đã cập nhật trạng thái hợp đồng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chuyển trạng thái hợp đồng">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-muted-foreground">Trạng thái hiện tại: {CONTRACT_STATUS_LABEL[currentStatus] ?? currentStatus}</p>
        <div>
          <label htmlFor="contract-status" className="mb-1 block text-sm font-medium">
            Trạng thái mới
          </label>
          <select
            id="contract-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {MANUAL_CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTRACT_STATUS_LABEL[s] ?? s}
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang cập nhật..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
