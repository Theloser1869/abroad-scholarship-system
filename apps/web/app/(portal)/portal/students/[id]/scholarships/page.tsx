"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalScholarships } from "@/lib/portal/hooks";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import { StatusBadge, SCHOLARSHIP_APPLICATION_STATUS_VARIANT, SCHOLARSHIP_APPLICATION_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card } from "@/components/ui/card";

export function ScholarshipsContent({ studentId }: { studentId: string }) {
  const { data, isLoading } = usePortalScholarships(studentId);

  if (isLoading) return <LoadingState />;
  if (!data || data.length === 0) return <EmptyState title="Chưa có hồ sơ học bổng nào." />;

  return (
    <ul className="space-y-3">
      {data.map((s) => (
        <li key={s.id}>
          <Link href={`/portal/students/${studentId}/scholarships/${s.id}`}>
            <Card className="hover:border-primary">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.scholarshipMaster.name}</p>
                  <p className="text-xs text-muted-foreground">{s.scholarshipMaster.provider}</p>
                </div>
                <StatusBadge status={s.status} variantMap={SCHOLARSHIP_APPLICATION_STATUS_VARIANT} label={SCHOLARSHIP_APPLICATION_STATUS_LABEL[s.status]} />
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PortalScholarshipsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalScholarshipsPageInner params={params} />
    </Suspense>
  );
}

function PortalScholarshipsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <ScholarshipsContent studentId={id} />
    </PortalStudentShell>
  );
}
