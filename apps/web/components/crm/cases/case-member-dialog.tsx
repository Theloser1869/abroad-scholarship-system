"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { UserPicker } from "@/components/crm/user-picker";
import type { AddCaseMemberInput, CaseMemberRole } from "@/lib/cases/types";

/// Add-collaborator dialog. Role is offered (OWNER/COLLABORATOR) purely as a display/intent
/// field — the backend independently enforces who may actually manage a case regardless of
/// what role a member row says (F03 instruction §13: "không suy luận permission từ role
/// member ở frontend").
export function CaseMemberDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AddCaseMemberInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<CaseMemberRole>("COLLABORATOR");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setUserId("");
    setRole("COLLABORATOR");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) return;
    setError(null);
    try {
      await onSubmit({ userId: userId.trim(), role });
      toast({ title: "Đã thêm thành viên.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Thêm thành viên case">
      <form onSubmit={handleSubmit} className="space-y-3">
        <UserPicker value={userId} onChange={setUserId} label="Người dùng" />
        <div>
          <label htmlFor="member-role" className="mb-1 block text-sm font-medium">
            Vai trò
          </label>
          <select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value as CaseMemberRole)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="COLLABORATOR">Cộng tác viên</option>
            <option value="OWNER">Chủ sở hữu</option>
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
          <Button type="submit" disabled={submitting || !userId.trim()}>
            {submitting ? "Đang thêm..." : "Thêm thành viên"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
