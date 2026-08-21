"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { UserPicker } from "./user-picker";

/// Shared confirm-and-assign dialog (Lead owner / Case owner reassignment) — requires
/// confirmation, calls the dedicated backend endpoint, shows success/error feedback (F03
/// instruction §14/§15). Never updates local state optimistically; the caller's mutation
/// invalidates the real query on success so the UI reflects the actual server response.
export function AssignOwnerDialog({
  open,
  onClose,
  title,
  currentOwnerId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  currentOwnerId?: string;
  onSubmit: (userId: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setUserId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) return;
    setError(null);
    try {
      await onSubmit(userId.trim());
      toast({ title: "Đã gán chủ sở hữu.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {currentOwnerId ? <p className="text-xs text-muted-foreground">Chủ sở hữu hiện tại: {currentOwnerId}</p> : null}
        <UserPicker value={userId} onChange={setUserId} label="Chủ sở hữu mới" />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting || !userId.trim()}>
            {submitting ? "Đang gán..." : "Xác nhận gán"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
