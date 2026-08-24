"use client";

import { Suspense, use } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalVisa } from "@/lib/portal/hooks";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { StatusBadge, VISA_STATUS_VARIANT, VISA_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/// Read-only — no Portal mutation exists for Visa (`PortalController` only has the two GET
/// routes). `internalNotes` is `null` here (field-redacted for STUDENT_PARENT); `reason`/
/// `interviewNotes` are deliberately NOT redacted (F08 instruction §21 — "internal visa
/// notes/refusal strategy" ≠ the affected Student/Parent's own recorded outcome). There is
/// no Portal endpoint for a Visa's checklist at all (confirmed against `PortalController` —
/// only `VisasService.getById` is called, which returns a plain `Visa`, no checklist embed) —
/// a real, documented backend-shape limitation, not a frontend omission.
export function VisaDetailContent({ studentId, visaId }: { studentId: string; visaId: string }) {
  const { data: visa, isLoading, error, refetch } = usePortalVisa(studentId, visaId);

  if (isLoading) return <LoadingState />;
  if (error || !visa) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">
            {visa.countryCode} · {visa.visaType}
          </h1>
          <p className="text-sm text-muted-foreground">{visa.visaCode}</p>
        </div>
        <StatusBadge status={visa.status} variantMap={VISA_STATUS_VARIANT} label={VISA_STATUS_LABEL[visa.status]} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lịch hẹn &amp; phỏng vấn</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          {visa.appointmentAt ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Lịch hẹn</dt>
              <dd>{new Date(visa.appointmentAt).toLocaleString("vi-VN")}</dd>
            </div>
          ) : null}
          {visa.appointmentLocation ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Địa điểm</dt>
              <dd>{visa.appointmentLocation}</dd>
            </div>
          ) : null}
          {visa.interviewAt ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phỏng vấn</dt>
              <dd>{new Date(visa.interviewAt).toLocaleString("vi-VN")}</dd>
            </div>
          ) : null}
          {!visa.appointmentAt && !visa.interviewAt ? <p className="text-muted-foreground">Chưa có lịch hẹn.</p> : null}
        </dl>
      </Card>

      {visa.resultDate ? (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày có kết quả</dt>
              <dd>{new Date(visa.resultDate).toLocaleDateString("vi-VN")}</dd>
            </div>
            {visa.reason ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ghi chú</dt>
                <dd>{visa.reason}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}
    </div>
  );
}

export default function PortalVisaDetailPage({ params }: { params: Promise<{ id: string; visaId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalVisaDetailPageInner params={params} />
    </Suspense>
  );
}

function PortalVisaDetailPageInner({ params }: { params: Promise<{ id: string; visaId: string }> }) {
  const { id, visaId } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <VisaDetailContent studentId={id} visaId={visaId} />
    </PortalStudentShell>
  );
}
