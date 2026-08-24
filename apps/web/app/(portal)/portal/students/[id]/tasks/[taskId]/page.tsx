"use client";

import { Suspense, use, useState } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalTask, useSubmitPortalTaskOutput, useUpdatePortalTaskStatus } from "@/lib/portal/hooks";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { StatusBadge, TASK_STATUS_VARIANT, TASK_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Only two mutations exist on the Portal side (F08 instruction §16): submitting the
/// student's own output text, and requesting one of exactly two status targets
/// (IN_PROGRESS/DONE) — reassignment, collaborator management, and blocker management are
/// staff-only and never exposed here. The backend's FSM remains authoritative regardless of
/// which button is shown — a `409 INVALID_TASK_STATUS_TRANSITION`/`BLOCKER_REQUIRED` is
/// always possible and surfaced verbatim.
export function TaskDetailContent({ studentId, taskId }: { studentId: string; taskId: string }) {
  const { toast } = useToast();
  const { data: task, isLoading, error, refetch } = usePortalTask(studentId, taskId);
  const submitOutput = useSubmitPortalTaskOutput(studentId, taskId);
  const updateStatus = useUpdatePortalTaskStatus(studentId, taskId);
  const [output, setOutput] = useState("");
  const [editingOutput, setEditingOutput] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !task) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  async function handleSaveOutput() {
    try {
      await submitOutput.mutateAsync(output);
      toast({ title: "Đã lưu kết quả.", variant: "success" });
      setEditingOutput(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  async function handleUpdateStatus(status: "IN_PROGRESS" | "DONE") {
    try {
      await updateStatus.mutateAsync(status);
      toast({ title: "Đã cập nhật trạng thái.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{task.title}</h1>
          <p className="text-sm text-muted-foreground">
            Hạn: {new Date(task.deadline).toLocaleDateString("vi-VN")} {task.isOverdue ? "· Quá hạn" : ""}
          </p>
        </div>
        <StatusBadge status={task.status} variantMap={TASK_STATUS_VARIANT} label={TASK_STATUS_LABEL[task.status]} />
      </div>

      <div className="flex flex-wrap gap-2">
        {task.status === "NOT_STARTED" || task.status === "BLOCKED" ? (
          <Button onClick={() => handleUpdateStatus("IN_PROGRESS")} disabled={updateStatus.isPending}>
            Bắt đầu thực hiện
          </Button>
        ) : null}
        {task.status === "IN_PROGRESS" ? (
          <Button onClick={() => handleUpdateStatus("DONE")} disabled={updateStatus.isPending}>
            Đánh dấu hoàn thành
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kết quả của bạn</CardTitle>
          {!editingOutput ? (
            <Button
              variant="secondary"
              onClick={() => {
                setOutput(task.output ?? "");
                setEditingOutput(true);
              }}
            >
              {task.output ? "Sửa" : "+ Nhập kết quả"}
            </Button>
          ) : null}
        </CardHeader>
        {editingOutput ? (
          <div className="space-y-2">
            <Textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingOutput(false)} disabled={submitOutput.isPending}>
                Hủy
              </Button>
              <Button onClick={handleSaveOutput} disabled={submitOutput.isPending || !output.trim()}>
                {submitOutput.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{task.output || "Chưa có kết quả."}</p>
        )}
      </Card>
    </div>
  );
}

export default function PortalTaskDetailPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalTaskDetailPageInner params={params} />
    </Suspense>
  );
}

function PortalTaskDetailPageInner({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <TaskDetailContent studentId={id} taskId={taskId} />
    </PortalStudentShell>
  );
}
