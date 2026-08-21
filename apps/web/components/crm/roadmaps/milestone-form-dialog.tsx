"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { UserPicker } from "@/components/crm/user-picker";
import type { CreateMilestoneInput, RoadmapMilestone, UpdateMilestoneInput } from "@/lib/roadmaps/types";

export function MilestoneFormDialog({
  open,
  onClose,
  milestone,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  milestone?: RoadmapMilestone;
  onSubmit: (input: CreateMilestoneInput | UpdateMilestoneInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!milestone;
  const [stage, setStage] = useState("");
  const [objective, setObjective] = useState("");
  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [deadline, setDeadline] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStage(milestone?.stage ?? "");
    setObjective(milestone?.objective ?? "");
    setMetric(milestone?.metric ?? "");
    setTarget(milestone?.target ?? "");
    setOwnerId(milestone?.ownerId ?? "");
    setStartAt(milestone?.startAt ? milestone.startAt.slice(0, 10) : "");
    setDeadline(milestone?.deadline ? milestone.deadline.slice(0, 10) : "");
    setEvidenceDocumentId(milestone?.evidenceDocumentId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    setError(null);
    try {
      const base: CreateMilestoneInput = {
        stage: stage || undefined,
        objective: objective.trim(),
        metric: metric || undefined,
        target: target || undefined,
        ownerId: ownerId || undefined,
        startAt: startAt || undefined,
        deadline: deadline || undefined,
      };
      await onSubmit(isEdit ? { ...base, evidenceDocumentId: evidenceDocumentId || undefined } : base);
      toast({ title: isEdit ? "Đã cập nhật mốc lộ trình." : "Đã thêm mốc lộ trình.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa mốc lộ trình" : "Thêm mốc lộ trình"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="milestone-objective" className="mb-1 block text-sm font-medium">
            Mục tiêu (objective) *
          </label>
          <Input id="milestone-objective" value={objective} onChange={(e) => setObjective(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="milestone-stage" className="mb-1 block text-sm font-medium">
              Giai đoạn
            </label>
            <Input id="milestone-stage" value={stage} onChange={(e) => setStage(e.target.value)} />
          </div>
          <div>
            <label htmlFor="milestone-metric" className="mb-1 block text-sm font-medium">
              Chỉ số đo lường
            </label>
            <Input id="milestone-metric" value={metric} onChange={(e) => setMetric(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="milestone-target" className="mb-1 block text-sm font-medium">
            Mục tiêu cụ thể (target)
          </label>
          <Input id="milestone-target" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <UserPicker value={ownerId} onChange={setOwnerId} label="Người phụ trách (tùy chọn)" required={false} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="milestone-start" className="mb-1 block text-sm font-medium">
              Bắt đầu
            </label>
            <Input id="milestone-start" type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <label htmlFor="milestone-deadline" className="mb-1 block text-sm font-medium">
              Hạn chót
            </label>
            <Input id="milestone-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        {isEdit ? (
          <div>
            <label htmlFor="milestone-evidence" className="mb-1 block text-sm font-medium">
              Document ID minh chứng
            </label>
            <Input id="milestone-evidence" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
          <Button type="submit" disabled={submitting || !objective.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
