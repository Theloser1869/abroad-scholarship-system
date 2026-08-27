"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input, FORM_CONTROL_CLASSES } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { CASE_STAGES, type CaseStage, type UpdateCaseStageInput } from "@/lib/cases/types";
import { CASE_STAGE_LABEL } from "@/components/crm/status-badge";

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
  currentStage: CaseStage;
  currentDepartment: string | null;
  onSubmit: (input: UpdateCaseStageInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [stage, setStage] = useState<CaseStage>(currentStage);
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
    setError(null);
    try {
      await onSubmit({ stage, department: department.trim() || undefined });
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
          <select id="case-stage" required className={FORM_CONTROL_CLASSES} value={stage} onChange={(e) => setStage(e.target.value as CaseStage)}>
            {CASE_STAGES.map((s) => (
              <option key={s} value={s}>
                {CASE_STAGE_LABEL[s]}
              </option>
            ))}
          </select>
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
