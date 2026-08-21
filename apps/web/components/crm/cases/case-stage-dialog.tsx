"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { UpdateCaseStageInput } from "@/lib/cases/types";

export function CaseStageDialog({
  open,
  onClose,
  currentStage,
  currentDepartment,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  currentStage: string;
  currentDepartment: string | null;
  onSubmit: (input: UpdateCaseStageInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [stage, setStage] = useState(currentStage);
  const [department, setDepartment] = useState(currentDepartment ?? "");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStage(currentStage);
    setDepartment(currentDepartment ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stage.trim()) return;
    setError(null);
    try {
      await onSubmit({ stage: stage.trim(), department: department.trim() || undefined });
      toast({ title: "Đã cập nhật giai đoạn case.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Cập nhật giai đoạn case">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="case-stage" className="mb-1 block text-sm font-medium">
            Giai đoạn *
          </label>
          <Input id="case-stage" required value={stage} onChange={(e) => setStage(e.target.value)} />
        </div>
        <div>
          <label htmlFor="case-department" className="mb-1 block text-sm font-medium">
            Phòng ban
          </label>
          <Input id="case-department" value={department} onChange={(e) => setDepartment(e.target.value)} />
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
          <Button type="submit" disabled={submitting || !stage.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
