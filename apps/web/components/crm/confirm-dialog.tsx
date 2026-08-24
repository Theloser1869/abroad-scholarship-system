"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button, type ButtonVariant } from "@/components/ui/button";

/// F09 UX hardening (instruction §9: "Không dùng browser `window.confirm` nếu shared Dialog
/// có thể đáp ứng"). Replaces every no-payload destructive-confirmation flow that previously
/// used `window.confirm(...)` — a native browser dialog that can't show a loading state
/// during the async mutation, doesn't match the app's own dialog styling/focus treatment,
/// and is unreliable to test. This is the no-reason-text sibling of `ReasonDialog`: title +
/// an explanation of the affected object/action + Hủy/confirm, with a real `submitting`
/// state disabling both buttons while the mutation is in flight. The backend remains the
/// sole business authority either way — this only collects the "yes, do it" click.
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Xác nhận",
  variant = "primary",
  onConfirm,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: ButtonVariant;
  onConfirm: () => void;
  submitting: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} disabled={submitting}>
            {submitting ? "Đang xử lý..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
