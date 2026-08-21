"use client";

import { Suspense, use, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import {
  useAddMilestoneDependency,
  useApproveRoadmap,
  useCreateMilestone,
  useRejectRoadmap,
  useRoadmap,
  useSubmitRoadmap,
  useUpdateMilestone,
  useUpdateMilestoneStatus,
  useUpdateRoadmapStatus,
} from "@/lib/roadmaps/hooks";
import type { CreateMilestoneInput, RoadmapMilestone, UpdateMilestoneInput } from "@/lib/roadmaps/types";
import { MilestoneFormDialog } from "@/components/crm/roadmaps/milestone-form-dialog";
import { MilestoneStatusDialog } from "@/components/crm/roadmaps/milestone-status-dialog";
import { MilestoneDependencyDialog } from "@/components/crm/roadmaps/milestone-dependency-dialog";
import { ReasonDialog } from "@/components/crm/reason-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import {
  StatusBadge,
  ROADMAP_STATUS_VARIANT,
  ROADMAP_STATUS_LABEL,
  MILESTONE_STATUS_VARIANT,
  MILESTONE_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { MANUAL_ROADMAP_STATUSES } from "@/lib/roadmaps/types";

const POST_APPROVAL_STATUSES = new Set(["APPROVED", "ACTIVE", "COMPLETED"]);

export function RoadmapDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: roadmap, isLoading, error, refetch } = useRoadmap(id);
  const caseId = roadmap?.caseId ?? "";

  const submitRoadmap = useSubmitRoadmap(id, caseId);
  const approveRoadmap = useApproveRoadmap(id, caseId);
  const rejectRoadmap = useRejectRoadmap(id, caseId);
  const updateRoadmapStatus = useUpdateRoadmapStatus(id, caseId);
  const createMilestone = useCreateMilestone(id, caseId);
  const [statusEditTarget, setStatusEditTarget] = useState<RoadmapMilestone | null>(null);
  const [formEditTarget, setFormEditTarget] = useState<RoadmapMilestone | "new" | null>(null);
  const [dependencyTarget, setDependencyTarget] = useState<RoadmapMilestone | null>(null);
  const editingMilestoneId = formEditTarget && formEditTarget !== "new" ? formEditTarget.id : "";
  const updateMilestone = useUpdateMilestone(editingMilestoneId, id, caseId);
  const updateMilestoneStatus = useUpdateMilestoneStatus(statusEditTarget?.id ?? "", id, caseId);
  const addDependency = useAddMilestoneDependency(dependencyTarget?.id ?? "", id, caseId);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !roadmap) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canSubmit = roadmap.status === "DRAFT" && can("roadmaps", "edit");
  const canApproveReject = roadmap.status === "REVIEW" && can("roadmaps", "approve");
  const canChangeStatus = POST_APPROVAL_STATUSES.has(roadmap.status) && can("roadmaps", "edit");
  const canManageMilestones = ["DRAFT", "REVIEW", "APPROVED", "ACTIVE"].includes(roadmap.status) && can("roadmaps", "edit");

  async function handleSubmit() {
    try {
      await submitRoadmap.mutateAsync();
      toast({ title: "Đã gửi duyệt lộ trình.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Lộ trình — Phiên bản {roadmap.version} {roadmap.horizonYears ? `(${roadmap.horizonYears} năm)` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={roadmap.status} variantMap={ROADMAP_STATUS_VARIANT} label={ROADMAP_STATUS_LABEL[roadmap.status]} />
          {canSubmit ? (
            <Button variant="secondary" onClick={handleSubmit} disabled={submitRoadmap.isPending}>
              {submitRoadmap.isPending ? "Đang gửi..." : "Gửi duyệt"}
            </Button>
          ) : null}
          {canApproveReject ? (
            <>
              <Button variant="secondary" onClick={() => setApproveOpen(true)}>
                Duyệt
              </Button>
              <Button variant="danger" onClick={() => setRejectOpen(true)}>
                Từ chối
              </Button>
            </>
          ) : null}
          {canChangeStatus ? (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Chuyển trạng thái
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mốc lộ trình</CardTitle>
          {canManageMilestones ? (
            <Button variant="secondary" onClick={() => setFormEditTarget("new")}>
              + Thêm mốc
            </Button>
          ) : null}
        </CardHeader>
        {roadmap.milestones.length === 0 ? (
          <EmptyState title="Chưa có mốc lộ trình nào." />
        ) : (
          <ul className="space-y-3">
            {roadmap.milestones.map((m) => (
              <li key={m.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{m.objective}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.stage ? `${m.stage} · ` : ""}
                      {m.metric ? `${m.metric} ` : ""}
                      {m.target ? `→ ${m.target}` : ""}
                    </p>
                    {m.deadline ? <p className="text-xs text-muted-foreground">Hạn: {new Date(m.deadline).toLocaleDateString("vi-VN")}</p> : null}
                  </div>
                  <StatusBadge status={m.status} variantMap={MILESTONE_STATUS_VARIANT} label={MILESTONE_STATUS_LABEL[m.status]} />
                </div>
                {m.evidenceDocumentId ? (
                  <div className="mt-2">
                    <EvidenceDocumentLink documentId={m.evidenceDocumentId} />
                  </div>
                ) : null}
                {canManageMilestones ? (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <button type="button" className="text-primary hover:underline" onClick={() => setFormEditTarget(m)}>
                      Sửa
                    </button>
                    <button type="button" className="text-primary hover:underline" onClick={() => setStatusEditTarget(m)}>
                      Trạng thái
                    </button>
                    <button type="button" className="text-primary hover:underline" onClick={() => setDependencyTarget(m)}>
                      + Phụ thuộc
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MilestoneFormDialog
        open={formEditTarget !== null}
        onClose={() => setFormEditTarget(null)}
        milestone={formEditTarget && formEditTarget !== "new" ? formEditTarget : undefined}
        onSubmit={(input) =>
          formEditTarget && formEditTarget !== "new"
            ? updateMilestone.mutateAsync(input as UpdateMilestoneInput)
            : createMilestone.mutateAsync(input as CreateMilestoneInput)
        }
        submitting={updateMilestone.isPending || createMilestone.isPending}
      />
      <MilestoneStatusDialog
        open={statusEditTarget !== null}
        onClose={() => setStatusEditTarget(null)}
        currentStatus={statusEditTarget?.status ?? "NOT_STARTED"}
        onSubmit={(status) => updateMilestoneStatus.mutateAsync(status)}
        submitting={updateMilestoneStatus.isPending}
      />
      <MilestoneDependencyDialog
        open={dependencyTarget !== null}
        onClose={() => setDependencyTarget(null)}
        candidates={roadmap.milestones.filter((m) => m.id !== dependencyTarget?.id)}
        onSubmit={(dependsOnMilestoneId) => addDependency.mutateAsync(dependsOnMilestoneId)}
        submitting={addDependency.isPending}
      />
      <ReasonDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Duyệt lộ trình"
        successMessage="Đã duyệt lộ trình."
        reasonLabel="Ghi chú"
        onSubmit={(reason) => approveRoadmap.mutateAsync(reason || undefined)}
        submitting={approveRoadmap.isPending}
      />
      <ReasonDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối lộ trình"
        successMessage="Đã từ chối — chuyển về nháp."
        reasonLabel="Lý do từ chối"
        reasonRequired
        variant="danger"
        onSubmit={(reason) => rejectRoadmap.mutateAsync(reason)}
        submitting={rejectRoadmap.isPending}
      />
      <RoadmapStatusDialog open={statusOpen} onClose={() => setStatusOpen(false)} onSubmit={(status) => updateRoadmapStatus.mutateAsync(status)} submitting={updateRoadmapStatus.isPending} />
    </div>
  );
}

/// Only the 3 post-approval forward moves (ACTIVE/COMPLETED/ARCHIVED) — DRAFT/REVIEW/APPROVED
/// are reached via submit/approve/reject only.
function RoadmapStatusDialog({ open, onClose, onSubmit, submitting }: { open: boolean; onClose: () => void; onSubmit: (status: string) => Promise<unknown>; submitting: boolean }) {
  const [status, setStatus] = useState<string>(MANUAL_ROADMAP_STATUSES[0]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStatus(MANUAL_ROADMAP_STATUSES[0]);
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(status);
      toast({ title: "Đã cập nhật trạng thái lộ trình.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chuyển trạng thái lộ trình">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="roadmap-status" className="mb-1 block text-sm font-medium">
            Trạng thái mới
          </label>
          <select
            id="roadmap-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {MANUAL_ROADMAP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ROADMAP_STATUS_LABEL[s] ?? s}
              </option>
            ))}
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang cập nhật..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function RoadmapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <RoadmapDetailPageInner params={params} />
    </Suspense>
  );
}

function RoadmapDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="roadmaps" action="view">
      <RoadmapDetailContent id={id} />
    </RequirePermission>
  );
}
