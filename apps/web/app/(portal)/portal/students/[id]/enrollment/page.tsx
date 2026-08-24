"use client";

import { Suspense, use } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalEnrollments } from "@/lib/portal/hooks";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import { StatusBadge, ENROLLMENT_STATUS_VARIANT, ENROLLMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/// Read-only, list-only — no standalone Enrollment detail route is mapped for Portal (F01's
/// route map lists only `GET /portal/students/:id/enrollment`, no `:enrollmentId` sub-route),
/// and no confirm/withdraw action exists here regardless (F08 instruction §23: "No
/// student-side confirm/withdraw unless backend portal API explicitly provides such
/// capability" — it doesn't; `PortalController` has no POST/PATCH route for Enrollment).
export function EnrollmentContent({ studentId }: { studentId: string }) {
  const { data: enrollments, isLoading } = usePortalEnrollments(studentId);

  if (isLoading) return <LoadingState />;
  if (!enrollments || enrollments.length === 0) return <EmptyState title="Chưa có hồ sơ nhập học nào." />;

  return (
    <ul className="space-y-3">
      {enrollments.map((e) => (
        <li key={e.id}>
          <Card>
            <CardHeader>
              <CardTitle>{e.university.officialName}</CardTitle>
              <StatusBadge status={e.status} variantMap={ENROLLMENT_STATUS_VARIANT} label={ENROLLMENT_STATUS_LABEL[e.status]} />
            </CardHeader>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Chương trình</dt>
                <dd>
                  {e.program.degreeLevel} · {e.program.major}
                </dd>
              </div>
              {e.startDate ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ngày nhập học</dt>
                  <dd>{new Date(e.startDate).toLocaleDateString("vi-VN")}</dd>
                </div>
              ) : null}
              {e.confirmationDate ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ngày xác nhận</dt>
                  <dd>{new Date(e.confirmationDate).toLocaleDateString("vi-VN")}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function PortalEnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalEnrollmentPageInner params={params} />
    </Suspense>
  );
}

function PortalEnrollmentPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <EnrollmentContent studentId={id} />
    </PortalStudentShell>
  );
}
