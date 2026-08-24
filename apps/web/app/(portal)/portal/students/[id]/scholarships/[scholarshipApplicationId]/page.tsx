"use client";

import { Suspense, use } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalScholarship } from "@/lib/portal/hooks";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { StatusBadge, SCHOLARSHIP_APPLICATION_STATUS_VARIANT, SCHOLARSHIP_APPLICATION_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/// Read-only — no Portal mutation exists for ScholarshipApplication at all
/// (`PortalController` has no POST/PATCH route for it). `internalNotes` is `null` here
/// (field-redacted for STUDENT_PARENT, `FieldPolicyService.redactScholarshipApplication`) —
/// simply never rendered, never reconstructed via another call (F08 instruction §20/§27).
export function ScholarshipDetailContent({ studentId, id }: { studentId: string; id: string }) {
  const { data: scholarship, isLoading, error, refetch } = usePortalScholarship(studentId, id);

  if (isLoading) return <LoadingState />;
  if (error || !scholarship) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{scholarship.scholarshipMaster.name}</h1>
          <p className="text-sm text-muted-foreground">{scholarship.scholarshipMaster.provider}</p>
        </div>
        <StatusBadge status={scholarship.status} variantMap={SCHOLARSHIP_APPLICATION_STATUS_VARIANT} label={SCHOLARSHIP_APPLICATION_STATUS_LABEL[scholarship.status]} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          {scholarship.deadline ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hạn nộp</dt>
              <dd>{new Date(scholarship.deadline).toLocaleDateString("vi-VN")}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Đủ điều kiện</dt>
            <dd>{scholarship.eligibilityConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}</dd>
          </div>
          {scholarship.interviewAt ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phỏng vấn</dt>
              <dd>{new Date(scholarship.interviewAt).toLocaleString("vi-VN")}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {scholarship.status === "AWARDED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả trao học bổng</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Giá trị</dt>
              <dd>
                <Money value={scholarship.awardAmount} currency={scholarship.awardCurrency} />
              </dd>
            </div>
            {scholarship.awardCoverageType ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Loại hỗ trợ</dt>
                <dd>{scholarship.awardCoverageType}</dd>
              </div>
            ) : null}
            {scholarship.awardAcceptanceDeadline ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hạn xác nhận nhận học bổng</dt>
                <dd>{new Date(scholarship.awardAcceptanceDeadline).toLocaleDateString("vi-VN")}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}
    </div>
  );
}

export default function PortalScholarshipDetailPage({ params }: { params: Promise<{ id: string; scholarshipApplicationId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalScholarshipDetailPageInner params={params} />
    </Suspense>
  );
}

function PortalScholarshipDetailPageInner({ params }: { params: Promise<{ id: string; scholarshipApplicationId: string }> }) {
  const { id, scholarshipApplicationId } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <ScholarshipDetailContent studentId={id} id={scholarshipApplicationId} />
    </PortalStudentShell>
  );
}
