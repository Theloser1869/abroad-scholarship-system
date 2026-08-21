"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { RoadmapMilestone } from "@/lib/roadmaps/types";

/// Picks another milestone from the SAME roadmap (already loaded — no separate lookup needed)
/// as a dependency. `409 SELF_DEPENDENCY`/`CIRCULAR_DEPENDENCY`/`DUPLICATE_DEPENDENCY`
/// surfaced verbatim, never pre-checked client-side (F04 instruction §19/§21).
export function MilestoneDependencyDialog({
  open,
  onClose,
  candidates,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  candidates: RoadmapMilestone[];
  onSubmit: (dependsOnMilestoneId: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [dependsOnMilestoneId, setDependsOnMilestoneId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setDependsOnMilestoneId(candidates[0]?.id ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dependsOnMilestoneId) return;
    setError(null);
    try {
      await onSubmit(dependsOnMilestoneId);
      toast({ title: "Đã thêm phụ thuộc.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Thêm phụ thuộc mốc lộ trình">
      <form onSubmit={handleSubmit} className="space-y-3">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có mốc khác trong lộ trình này để tạo phụ thuộc.</p>
        ) : (
          <div>
            <label htmlFor="milestone-dependency" className="mb-1 block text-sm font-medium">
              Mốc phải hoàn tất trước
            </label>
            <select
              id="milestone-dependency"
              value={dependsOnMilestoneId}
              onChange={(e) => setDependsOnMilestoneId(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.objective}
                </option>
              ))}
            </select>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting || !dependsOnMilestoneId}>
            {submitting ? "Đang lưu..." : "Thêm phụ thuộc"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
