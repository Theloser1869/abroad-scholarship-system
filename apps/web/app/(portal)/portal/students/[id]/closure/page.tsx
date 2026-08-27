"use client";

import { Suspense, use } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalClosure, useConfirmPortalLiquidation } from "@/lib/portal/hooks";
import {
  StatusBadge,
  CLOSURE_CHECKLIST_STATUS_VARIANT,
  CLOSURE_CHECKLIST_STATUS_LABEL,
  CLOSURE_CHECKLIST_ITEM_LABEL,
  CLOSURE_LIQUIDATION_STATUS_VARIANT,
  CLOSURE_LIQUIDATION_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007) — read-only closure summary +
/// the student/parent's own side of the two-party liquidation confirmation (DEC-08). No
/// staff-only detail is ever shown here (`PortalService.getClosure` already strips
/// `handover.notes`; the checklist/handover/liquidation fields returned are all
/// student/parent-safe by construction).
export function PortalClosureContent({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const { data: status, isLoading, error, refetch } = usePortalClosure(studentId);
  const confirmLiquidation = useConfirmPortalLiquidation(studentId);

  if (isLoading) return <LoadingState />;
  if (error || !status) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const isClosed = status.caseStatus === "CLOSED";
  const alreadyConfirmed = !!status.liquidation?.studentParentConfirmedAt;

  async function handleConfirm() {
    try {
      await confirmLiquidation.mutateAsync();
      toast({ title: "Đã xác nhận thanh lý.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Đóng hồ sơ / Thanh lý</h1>

      <Card>
        <CardHeader>
          <CardTitle>Tình trạng chuẩn bị đóng hồ sơ</CardTitle>
        </CardHeader>
        <ul className="space-y-2 text-sm">
          {status.checklist.map((item) => (
            <li key={item.key} className="flex items-center justify-between rounded border border-border p-2">
              <span>{CLOSURE_CHECKLIST_ITEM_LABEL[item.key] ?? item.key}</span>
              <StatusBadge status={item.status} variantMap={CLOSURE_CHECKLIST_STATUS_VARIANT} label={CLOSURE_CHECKLIST_STATUS_LABEL[item.status]} />
            </li>
          ))}
        </ul>
      </Card>

      {isClosed ? (
        <Card>
          <CardHeader>
            <CardTitle>Xác nhận thanh lý hồ sơ</CardTitle>
          </CardHeader>
          <div className="space-y-3 text-sm">
            {status.liquidation ? (
              <StatusBadge
                status={status.liquidation.status}
                variantMap={CLOSURE_LIQUIDATION_STATUS_VARIANT}
                label={CLOSURE_LIQUIDATION_STATUS_LABEL[status.liquidation.status]}
              />
            ) : null}
            <p className="text-muted-foreground">
              Hồ sơ đã được đóng. Vui lòng xác nhận thanh lý để hoàn tất toàn bộ quy trình dịch vụ.
            </p>
            {alreadyConfirmed ? (
              <p className="text-success">
                Bạn đã xác nhận thanh lý
                {status.liquidation?.studentParentConfirmedAt ? ` · ${new Date(status.liquidation.studentParentConfirmedAt).toLocaleDateString("vi-VN")}` : ""}.
              </p>
            ) : (
              <Button onClick={handleConfirm} disabled={confirmLiquidation.isPending}>
                {confirmLiquidation.isPending ? "Đang xác nhận..." : "Xác nhận thanh lý hồ sơ"}
              </Button>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default function PortalClosurePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalClosurePageInner params={params} />
    </Suspense>
  );
}

function PortalClosurePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <PortalClosureContent studentId={id} />
    </PortalStudentShell>
  );
}
