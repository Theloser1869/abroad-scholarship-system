"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
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
  onSubmit: (status: string, reason?: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [status, setStatus] = useState<string>(MANUAL_CONTRACT_STATUSES[0]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStatus(MANUAL_CONTRACT_STATUSES[0]);
    setReason("");
    setError(null);
  });

  const reasonRequired = status === "LIQUIDATED";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reasonRequired && reason.trim().length < 3) return;
    setError(null);
    try {
      await onSubmit(status, reasonRequired ? reason.trim() : undefined);
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
        {status === "ACTIVE" && currentStatus === "SIGNED" ? (
          <p className="text-xs text-muted-foreground">
            Hợp đồng cần có ít nhất một khoản thanh toán đã ghi nhận (một phần hoặc toàn bộ) trước khi có thể kích hoạt.
          </p>
        ) : null}
        {status === "COMPLETED" ? (
          <p className="text-xs text-muted-foreground">Hợp đồng cần không còn khoản thanh toán nào chưa xử lý (chờ, một phần, hoặc quá hạn) trước khi hoàn tất.</p>
        ) : null}
        {reasonRequired ? (
          <div>
            <label htmlFor="contract-closure-reason" className="mb-1 block text-sm font-medium">
              Biên bản thanh lý / Lý do *
            </label>
            <Textarea id="contract-closure-reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting || (reasonRequired && reason.trim().length < 3)}>
            {submitting ? "Đang cập nhật..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
