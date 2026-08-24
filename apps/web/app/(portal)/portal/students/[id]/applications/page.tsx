"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalApplications } from "@/lib/portal/hooks";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { StatusBadge, APPLICATION_STATUS_VARIANT, APPLICATION_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card } from "@/components/ui/card";

export function ApplicationsContent({ studentId }: { studentId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = usePortalApplications(studentId, { page, limit: 20 });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <QueryErrorState error={error} onRetry={() => refetch()} />;
  if (data.data.length === 0) return <EmptyState title="Chưa có hồ sơ ứng tuyển nào." />;

  return (
    <div className="space-y-3">
      {data.data.map((a) => (
        <Link key={a.id} href={`/portal/students/${studentId}/applications/${a.id}`}>
          <Card className="hover:border-primary">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{a.program.university.officialName}</p>
                <p className="text-xs text-muted-foreground">
                  {a.program.degreeLevel} · {a.program.major}
                </p>
                {a.deadline ? <p className="text-xs text-muted-foreground">Hạn nộp: {new Date(a.deadline).toLocaleDateString("vi-VN")}</p> : null}
              </div>
              <StatusBadge status={a.status} variantMap={APPLICATION_STATUS_VARIANT} label={APPLICATION_STATUS_LABEL[a.status]} />
            </div>
          </Card>
        </Link>
      ))}
      <PaginationControls meta={data.meta} onPageChange={setPage} />
    </div>
  );
}

export default function PortalApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalApplicationsPageInner params={params} />
    </Suspense>
  );
}

function PortalApplicationsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <ApplicationsContent studentId={id} />
    </PortalStudentShell>
  );
}
