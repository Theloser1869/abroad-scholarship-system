"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalVisas } from "@/lib/portal/hooks";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { StatusBadge, VISA_STATUS_VARIANT, VISA_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card } from "@/components/ui/card";

export function VisaListContent({ studentId }: { studentId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = usePortalVisas(studentId, { page, limit: 20 });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <QueryErrorState error={error} onRetry={() => refetch()} />;
  if (data.data.length === 0) return <EmptyState title="Chưa có hồ sơ visa nào." />;

  return (
    <div className="space-y-3">
      {data.data.map((v) => (
        <Link key={v.id} href={`/portal/students/${studentId}/visa/${v.id}`}>
          <Card className="hover:border-primary">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {v.countryCode} · {v.visaType}
                </p>
                {v.appointmentAt ? <p className="text-xs text-muted-foreground">Lịch hẹn: {new Date(v.appointmentAt).toLocaleString("vi-VN")}</p> : null}
              </div>
              <StatusBadge status={v.status} variantMap={VISA_STATUS_VARIANT} label={VISA_STATUS_LABEL[v.status]} />
            </div>
          </Card>
        </Link>
      ))}
      <PaginationControls meta={data.meta} onPageChange={setPage} />
    </div>
  );
}

export default function PortalVisaListPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalVisaListPageInner params={params} />
    </Suspense>
  );
}

function PortalVisaListPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <VisaListContent studentId={id} />
    </PortalStudentShell>
  );
}
