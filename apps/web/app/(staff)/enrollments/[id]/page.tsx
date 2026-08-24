"use client";

import { Suspense, use, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useEnrollment, useUpdateEnrollment, useConfirmEnrollment, useWithdrawEnrollment } from "@/lib/enrollments/hooks";
import { EnrollmentFormDialog } from "@/components/crm/enrollments/enrollment-form-dialog";
import { EnrollmentConfirmDialog } from "@/components/crm/enrollments/enrollment-confirm-dialog";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { StatusBadge, ENROLLMENT_STATUS_VARIANT, ENROLLMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { UpdateEnrollmentInput } from "@/lib/enrollments/types";

/// Enrollment detail (F06 instruction §14/§15): only two dedicated FSM actions exist —
/// `confirm` (PLANNED → CONFIRMED) and `withdraw` ({PLANNED, CONFIRMED} → WITHDRAWN) — no
/// generic status-change endpoint. Withdraw takes no body, so it's a plain confirm-then-
/// mutate action (no dialog needed), same precedent as other no-payload terminal actions
/// elsewhere in the app.
export function EnrollmentDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { data: enrollment, isLoading, error, refetch } = useEnrollment(id);
  const updateEnrollment = useUpdateEnrollment(id, enrollment?.caseId ?? "");
  const confirmEnrollment = useConfirmEnrollment(id, enrollment?.caseId ?? "");
  const withdrawEnrollment = useWithdrawEnrollment(id, enrollment?.caseId ?? "");
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !enrollment) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const isTerminal = enrollment.status === "WITHDRAWN";
  const canEdit = !isTerminal && can("enrollment", "edit");
  const canConfirm = enrollment.status === "PLANNED" && can("enrollment", "edit");
  const canWithdraw = !isTerminal && can("enrollment", "edit");

  async function handleWithdraw() {
    try {
      await withdrawEnrollment.mutateAsync();
      toast({ title: "Đã rút hồ sơ nhập học.", variant: "success" });
      setWithdrawOpen(false);
    } catch (err) {
      toast({ title: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{enrollment.university.officialName}</h1>
          <p className="text-sm text-muted-foreground">
            {enrollment.program.degreeLevel} · {enrollment.program.major}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={enrollment.status} variantMap={ENROLLMENT_STATUS_VARIANT} label={ENROLLMENT_STATUS_LABEL[enrollment.status]} />
          {canEdit ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {canConfirm ? (
            <Button variant="primary" onClick={() => setConfirmOpen(true)}>
              Xác nhận nhập học
            </Button>
          ) : null}
          {canWithdraw ? (
            <Button variant="secondary" onClick={() => setWithdrawOpen(true)} disabled={withdrawEnrollment.isPending}>
              Rút hồ sơ
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chi tiết</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ngày bắt đầu</dt>
            <dd>{enrollment.startDate ? new Date(enrollment.startDate).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ngày xác nhận</dt>
            <dd>{enrollment.confirmationDate ? new Date(enrollment.confirmationDate).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          {enrollment.internalNotes ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ghi chú nội bộ</dt>
              <dd>{enrollment.internalNotes}</dd>
            </div>
          ) : null}
        </dl>
        {enrollment.evidenceDocumentId ? (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-sm font-medium">Minh chứng</p>
            <EvidenceDocumentLink documentId={enrollment.evidenceDocumentId} />
          </div>
        ) : null}
      </Card>

      <EnrollmentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        isEdit
        onSubmit={(input) => updateEnrollment.mutateAsync(input as UpdateEnrollmentInput)}
        submitting={updateEnrollment.isPending}
      />
      <EnrollmentConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onSubmit={(input) => confirmEnrollment.mutateAsync(input)}
        submitting={confirmEnrollment.isPending}
      />
      <ConfirmDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Rút hồ sơ nhập học"
        description="Hồ sơ nhập học này sẽ chuyển sang trạng thái đã rút."
        confirmLabel="Rút hồ sơ"
        variant="danger"
        onConfirm={handleWithdraw}
        submitting={withdrawEnrollment.isPending}
      />
    </div>
  );
}

export default function EnrollmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EnrollmentDetailPageInner params={params} />
    </Suspense>
  );
}

function EnrollmentDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="enrollment" action="view">
      <EnrollmentDetailContent id={id} />
    </RequirePermission>
  );
}
