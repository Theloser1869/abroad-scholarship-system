"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { AssessmentCriterion, UpsertCriterionInput } from "@/lib/assessments/types";

/// Upsert by `area` (F04 instruction §16/§18) — `gap` is never collected here, it is always
/// computed server-side from `currentScore`/`targetScore` and rendered read-only elsewhere.
export function CriterionDialog({
  open,
  onClose,
  criterion,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = editing an existing area; absent = adding a new one. */
  criterion?: AssessmentCriterion;
  onSubmit: (input: UpsertCriterionInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [area, setArea] = useState("");
  const [currentScore, setCurrentScore] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [priority, setPriority] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setArea(criterion?.area ?? "");
    setCurrentScore(criterion?.currentScore ?? "");
    setTargetScore(criterion?.targetScore ?? "");
    setPriority(criterion?.priority ?? "");
    setRecommendation(criterion?.recommendation ?? "");
    setEvidenceDocumentId(criterion?.evidenceDocumentId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!area.trim()) return;
    setError(null);
    try {
      await onSubmit({
        area: area.trim(),
        currentScore: currentScore ? Number(currentScore) : undefined,
        targetScore: targetScore ? Number(targetScore) : undefined,
        priority: priority || undefined,
        recommendation: recommendation || undefined,
        evidenceDocumentId: evidenceDocumentId || undefined,
      });
      toast({ title: "Đã lưu tiêu chí đánh giá.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={criterion ? `Sửa tiêu chí: ${criterion.area}` : "Thêm tiêu chí đánh giá"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="criterion-area" className="mb-1 block text-sm font-medium">
            Lĩnh vực (area) *
          </label>
          <Input
            id="criterion-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Academic, English, Test, Research, Competition, Leadership..."
            required
            disabled={!!criterion}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="criterion-current" className="mb-1 block text-sm font-medium">
              Điểm hiện tại
            </label>
            <Input id="criterion-current" type="number" step="0.01" value={currentScore} onChange={(e) => setCurrentScore(e.target.value)} />
          </div>
          <div>
            <label htmlFor="criterion-target" className="mb-1 block text-sm font-medium">
              Điểm mục tiêu
            </label>
            <Input id="criterion-target" type="number" step="0.01" value={targetScore} onChange={(e) => setTargetScore(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="criterion-priority" className="mb-1 block text-sm font-medium">
            Mức ưu tiên
          </label>
          <Input id="criterion-priority" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
        <div>
          <label htmlFor="criterion-recommendation" className="mb-1 block text-sm font-medium">
            Khuyến nghị
          </label>
          <textarea
            id="criterion-recommendation"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={3}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="criterion-evidence" className="mb-1 block text-sm font-medium">
            Document ID minh chứng
          </label>
          <Input id="criterion-evidence" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
          <Button type="submit" disabled={submitting || !area.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
