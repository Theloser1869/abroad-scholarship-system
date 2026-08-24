"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { UserPicker } from "@/components/crm/user-picker";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { ShareDocumentInput } from "@/lib/documents/types";

/// Additive-only — grants a new principal VIEW and/or DOWNLOAD on this document
/// (`ShareDocumentDto`). The backend has no "list current grants" or "revoke" endpoint for a
/// Document (confirmed against `DocumentsController`), so this dialog cannot show who
/// already has access or let the caller remove a grant — a documented backend limitation,
/// not an omission (F07 instruction §14/§35).
export function DocumentShareDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ShareDocumentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [principalId, setPrincipalId] = useState("");
  const [canView, setCanView] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setPrincipalId("");
    setCanView(true);
    setCanDownload(false);
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const permissions: ("VIEW" | "DOWNLOAD")[] = [...(canView ? (["VIEW"] as const) : []), ...(canDownload ? (["DOWNLOAD"] as const) : [])];
    if (!principalId || permissions.length === 0) return;
    setError(null);
    try {
      await onSubmit({ principalId, permissions });
      toast({ title: "Đã chia sẻ tài liệu.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chia sẻ tài liệu">
      <form onSubmit={handleSubmit} className="space-y-3">
        <UserPicker value={principalId} onChange={setPrincipalId} label="Người nhận quyền truy cập" />
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={canView} onChange={(e) => setCanView(e.target.checked)} />
            Xem (VIEW)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={canDownload} onChange={(e) => setCanDownload(e.target.checked)} />
            Tải xuống (DOWNLOAD)
          </label>
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
          <Button type="submit" disabled={submitting || !principalId || (!canView && !canDownload)}>
            {submitting ? "Đang chia sẻ..." : "Chia sẻ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
