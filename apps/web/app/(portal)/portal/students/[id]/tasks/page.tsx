"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalTasks } from "@/lib/portal/hooks";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { StatusBadge, TASK_STATUS_VARIANT, TASK_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card } from "@/components/ui/card";

/// Only tasks explicitly `visibleToStudent` (server-filtered — `TasksService.
/// listForStudentPortal`) ever appear here; `ownerId`/`blocker`/`qualityScore` are always
/// `null` (F08 instruction §15 — "Do NOT expose staff-only ownerId/blocker/qualityScore").
export function TasksContent({ studentId }: { studentId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = usePortalTasks(studentId, { page, limit: 20 });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <QueryErrorState error={error} onRetry={() => refetch()} />;
  if (data.data.length === 0) return <EmptyState title="Không có nhiệm vụ nào." />;

  return (
    <div className="space-y-3">
      {data.data.map((t) => (
        <Link key={t.id} href={`/portal/students/${studentId}/tasks/${t.id}`}>
          <Card className="hover:border-primary">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className={t.isOverdue ? "font-medium text-danger" : "font-medium"}>{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  Hạn: {new Date(t.deadline).toLocaleDateString("vi-VN")} {t.isOverdue ? "· Quá hạn" : ""}
                </p>
              </div>
              <StatusBadge status={t.status} variantMap={TASK_STATUS_VARIANT} label={TASK_STATUS_LABEL[t.status]} />
            </div>
          </Card>
        </Link>
      ))}
      <PaginationControls meta={data.meta} onPageChange={setPage} />
    </div>
  );
}

export default function PortalTasksPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalTasksPageInner params={params} />
    </Suspense>
  );
}

function PortalTasksPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <TasksContent studentId={id} />
    </PortalStudentShell>
  );
}
