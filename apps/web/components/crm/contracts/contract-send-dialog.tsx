"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { SendContractResult } from "@/lib/contracts/types";

/// `POST /contracts/:id/send` returns a one-time review token — never re-fetchable, so this
/// dialog stays open after success to show it once instead of just closing on success like
/// every other action dialog (F04 instruction §8: confirmation required, warning shown).
export function ContractSendDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => Promise<SendContractResult>;
  submitting: boolean;
}) {
  const [result, setResult] = useState<SendContractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setResult(null);
    setError(null);
  });

  async function handleConfirm() {
    setError(null);
    try {
      const res = await onSubmit();
      setResult(res);
      toast({ title: "Đã gửi hợp đồng cho khách hàng.", variant: "success" });
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Gửi hợp đồng cho khách hàng">
      <div className="space-y-3">
        {result ? (
          <>
            <p className="text-sm">
              Đường link xem trước sẽ hết hạn lúc <strong>{new Date(result.reviewExpiresAt).toLocaleString("vi-VN")}</strong>. Mã này chỉ
              hiển thị một lần — hãy sao chép ngay.
            </p>
            <p className="break-all rounded border border-border bg-muted p-2 text-xs font-mono">{result.reviewToken}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Hệ thống sẽ tạo một đường link xem trước có thời hạn để khách hàng xem điều khoản hợp đồng trước khi ký.
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
              <Button type="button" onClick={handleConfirm} disabled={submitting}>
                {submitting ? "Đang gửi..." : "Xác nhận gửi"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
