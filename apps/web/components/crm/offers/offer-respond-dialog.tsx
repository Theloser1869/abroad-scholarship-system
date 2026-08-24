"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { OfferDecision } from "@/lib/offers/types";

/// Accept/Decline an Offer (F05 instruction §19). NOT idempotent on the backend — a second
/// response to an already-resolved offer is a genuine `409 INVALID_OFFER_STATE`, rendered
/// here as a real error (never treated as a silent success, overriding any
/// "repeat-accept-is-a-no-op" assumption — confirmed directly against `OffersService.respond`).
export function OfferRespondDialog({
  open,
  onClose,
  decision,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  decision: OfferDecision;
  onSubmit: (decision: OfferDecision) => Promise<unknown>;
  submitting: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const isAccept = decision === "ACCEPT";

  async function handleConfirm() {
    setError(null);
    try {
      await onSubmit(decision);
      toast({ title: isAccept ? "Đã chấp nhận thư mời." : "Đã từ chối thư mời.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isAccept ? "Chấp nhận thư mời nhập học" : "Từ chối thư mời nhập học"}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isAccept ? "Xác nhận chấp nhận thư mời này? Thao tác này không thể hoàn tác." : "Xác nhận từ chối thư mời này? Thao tác này không thể hoàn tác."}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="button" variant={isAccept ? "primary" : "danger"} onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Đang xử lý..." : isAccept ? "Chấp nhận" : "Từ chối"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
