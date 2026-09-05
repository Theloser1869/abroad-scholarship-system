"use client";

import { Suspense, use, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import {
  useVisa,
  useUpdateVisa,
  useUpdateVisaStatus,
  useSubmitVisa,
  useScheduleVisaAppointment,
  useRecordVisaInterview,
  useRecordVisaResult,
  useVisaChecklist,
  useCreateVisaChecklistItem,
} from "@/lib/visas/hooks";
import { VisaFormDialog } from "@/components/crm/visas/visa-form-dialog";
import { VisaStatusDialog } from "@/components/crm/visas/visa-status-dialog";
import { VisaSubmitDialog } from "@/components/crm/visas/visa-submit-dialog";
import { VisaAppointmentDialog } from "@/components/crm/visas/visa-appointment-dialog";
import { VisaInterviewDialog } from "@/components/crm/visas/visa-interview-dialog";
import { VisaResultDialog } from "@/components/crm/visas/visa-result-dialog";
import { VisaChecklistItemDialog } from "@/components/crm/visas/visa-checklist-item-dialog";
import { VisaChecklistItemRow } from "@/components/crm/visas/visa-checklist-item-row";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { StatusBadge, VISA_STATUS_VARIANT, VISA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VISA_TRANSITIONS, type UpdateVisaInput } from "@/lib/visas/types";

const RESULT_ELIGIBLE_STATUSES = new Set(["SUBMITTED", "APPOINTMENT", "INTERVIEW"]);

/// Visa workspace (F06 instruction §6/§11): Header → visa type/status → appointment/
/// interview → checklist → documents → result → actions. Never infers the next FSM state
/// itself — every action maps to one dedicated backend endpoint.
export function VisaDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { data: visa, isLoading, error, refetch } = useVisa(id);
  const { data: checklist } = useVisaChecklist(id);

  const updateVisa = useUpdateVisa(id);
  const updateStatus = useUpdateVisaStatus(id);
  const submitVisa = useSubmitVisa(id);
  const scheduleAppointment = useScheduleVisaAppointment(id);
  const recordInterview = useRecordVisaInterview(id);
  const recordResult = useRecordVisaResult(id);
  const createChecklistItem = useCreateVisaChecklistItem(id);

  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [checklistCreateOpen, setChecklistCreateOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !visa) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const isTerminal = VISA_TRANSITIONS[visa.status].length === 0;
  const canEdit = !isTerminal && can("visa", "edit");
  const canChangeStatus = VISA_TRANSITIONS[visa.status].length > 0 && can("visa", "edit");
  const canSubmit = visa.status === "READY" && can("visa", "edit");
  const canScheduleAppointment = visa.status === "SUBMITTED" && can("visa", "edit");
  const canRecordInterview = visa.status === "APPOINTMENT" && can("visa", "edit");
  const canRecordResult = RESULT_ELIGIBLE_STATUSES.has(visa.status) && can("visa", "edit");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{visa.visaCode}</h1>
          <p className="text-sm text-muted-foreground">
            {visa.countryCode} · {visa.visaType}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={visa.status} variantMap={VISA_STATUS_VARIANT} label={VISA_STATUS_LABEL[visa.status]} />
          {canEdit ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {canChangeStatus ? (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Chuyển trạng thái
            </Button>
          ) : null}
          {canSubmit ? (
            <Button variant="secondary" onClick={() => setSubmitOpen(true)}>
              Nộp hồ sơ
            </Button>
          ) : null}
          {canScheduleAppointment ? (
            <Button variant="secondary" onClick={() => setAppointmentOpen(true)}>
              Đặt lịch hẹn
            </Button>
          ) : null}
          {canRecordInterview ? (
            <Button variant="secondary" onClick={() => setInterviewOpen(true)}>
              Ghi nhận phỏng vấn
            </Button>
          ) : null}
          {canRecordResult ? (
            <Button variant="primary" onClick={() => setResultOpen(true)}>
              Ghi nhận kết quả
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nộp hồ sơ</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Đã nộp lúc</dt>
              <dd>{visa.submittedAt ? new Date(visa.submittedAt).toLocaleString("vi-VN") : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mã tham chiếu</dt>
              <dd>{visa.submissionReference ?? "—"}</dd>
            </div>
          </dl>
          {visa.evidenceDocumentId ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1 text-sm font-medium">Minh chứng nộp hồ sơ</p>
              <EvidenceDocumentLink documentId={visa.evidenceDocumentId} />
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lịch hẹn &amp; Phỏng vấn</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày hẹn</dt>
              <dd>{visa.appointmentAt ? new Date(visa.appointmentAt).toLocaleString("vi-VN") : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Địa điểm</dt>
              <dd>{visa.appointmentLocation ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày phỏng vấn</dt>
              <dd>{visa.interviewAt ? new Date(visa.interviewAt).toLocaleString("vi-VN") : "—"}</dd>
            </div>
          </dl>
          {visa.interviewNotes ? (
            <div className="mt-3 border-t border-border pt-3 text-sm">
              <p className="font-medium">Ghi chú phỏng vấn</p>
              <p className="text-muted-foreground">{visa.interviewNotes}</p>
            </div>
          ) : null}
        </Card>
      </div>

      {visa.resultDate || visa.status === "GRANTED" || visa.status === "REFUSED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày có kết quả</dt>
              <dd>{visa.resultDate ? new Date(visa.resultDate).toLocaleDateString("vi-VN") : "—"}</dd>
            </div>
            {visa.reason ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lý do</dt>
                <dd>{visa.reason}</dd>
              </div>
            ) : null}
          </dl>
          {visa.resultEvidenceDocumentId ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1 text-sm font-medium">Tài liệu kết quả</p>
              <EvidenceDocumentLink documentId={visa.resultEvidenceDocumentId} />
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
          {canEdit ? (
            <Button variant="secondary" onClick={() => setChecklistCreateOpen(true)}>
              + Hạng mục
            </Button>
          ) : null}
        </CardHeader>
        {!checklist || checklist.length === 0 ? (
          <EmptyState title="Chưa có hạng mục checklist nào." />
        ) : (
          <ul className="space-y-2">
            {checklist.map((item) => (
              <VisaChecklistItemRow key={item.id} item={item} visaId={id} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </Card>

      <VisaFormDialog open={editOpen} onClose={() => setEditOpen(false)} visa={visa} onSubmit={(input) => updateVisa.mutateAsync(input as UpdateVisaInput)} submitting={updateVisa.isPending} />
      <VisaStatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={visa.status}
        onSubmit={(status) => updateStatus.mutateAsync(status)}
        submitting={updateStatus.isPending}
      />
      <VisaSubmitDialog open={submitOpen} onClose={() => setSubmitOpen(false)} studentId={visa.studentId} onSubmit={(input) => submitVisa.mutateAsync(input)} submitting={submitVisa.isPending} />
      <VisaAppointmentDialog
        open={appointmentOpen}
        onClose={() => setAppointmentOpen(false)}
        onSubmit={(input) => scheduleAppointment.mutateAsync(input)}
        submitting={scheduleAppointment.isPending}
      />
      <VisaInterviewDialog open={interviewOpen} onClose={() => setInterviewOpen(false)} onSubmit={(input) => recordInterview.mutateAsync(input)} submitting={recordInterview.isPending} />
      <VisaResultDialog open={resultOpen} onClose={() => setResultOpen(false)} studentId={visa.studentId} onSubmit={(input) => recordResult.mutateAsync(input)} submitting={recordResult.isPending} />
      <VisaChecklistItemDialog
        open={checklistCreateOpen}
        onClose={() => setChecklistCreateOpen(false)}
        studentId={visa.studentId}
        onSubmit={(input) => createChecklistItem.mutateAsync(input as Parameters<typeof createChecklistItem.mutateAsync>[0])}
        submitting={createChecklistItem.isPending}
      />
    </div>
  );
}

export default function VisaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <VisaDetailPageInner params={params} />
    </Suspense>
  );
}

function VisaDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="visa" action="view">
      <VisaDetailContent id={id} />
    </RequirePermission>
  );
}
