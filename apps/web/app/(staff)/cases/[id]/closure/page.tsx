"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useClosureStatus, useRequestClosure, useConfirmHandover, useExecuteClosure, useConfirmLiquidationCompany } from "@/lib/closure/hooks";
import {
  StatusBadge,
  CASE_STATUS_VARIANT,
  CASE_STATUS_LABEL,
  CLOSURE_CHECKLIST_STATUS_VARIANT,
  CLOSURE_CHECKLIST_STATUS_LABEL,
  CLOSURE_CHECKLIST_ITEM_LABEL,
  CLOSURE_HANDOVER_STATUS_VARIANT,
  CLOSURE_HANDOVER_STATUS_LABEL,
  CLOSURE_LIQUIDATION_STATUS_VARIANT,
  CLOSURE_LIQUIDATION_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014, 2026-08-26) — the
/// unified Closure/Liquidation workflow. Replaces the old `CaseCloseDialog` (which never
/// rendered a checklist, only a free-text reason). HCTH (ADMIN_FINANCE) executes standard;
/// EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER may exercise an audited exception (overrideReason
/// required); CONSULTANT (case-owner) may only request (advisory).
export function CaseClosureContent({ caseId }: { caseId: string }) {
  const { can, roleCode } = usePermissions();
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useClosureStatus(caseId);

  const requestClosure = useRequestClosure(caseId);
  const confirmHandover = useConfirmHandover(caseId);
  const executeClosure = useExecuteClosure(caseId);
  const confirmLiquidationCompany = useConfirmLiquidationCompany(caseId);

  const [requestReason, setRequestReason] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (statusLoading) return <LoadingState />;
  if (statusError || !status) return <QueryErrorState error={statusError} onRetry={() => refetchStatus()} />;

  const canExecute = can("case-closure", "execute");
  const canRequest = can("case-closure", "request");
  const isOverrideActor = canExecute && roleCode !== "ADMIN_FINANCE";
  const isClosed = status.caseStatus === "CLOSED";

  async function handleRequest() {
    setFormError(null);
    try {
      await requestClosure.mutateAsync({ reason: requestReason.trim() });
      setRequestReason("");
      toast({ title: "Đã gửi đề nghị đóng hồ sơ.", variant: "success" });
    } catch (err) {
      setFormError(crmErrorMessage(err));
    }
  }

  async function handleHandover() {
    setFormError(null);
    try {
      await confirmHandover.mutateAsync({
        recipientName: recipientName || undefined,
        notes: handoverNotes || undefined,
        overrideReason: isOverrideActor ? overrideReason.trim() : undefined,
      });
      toast({ title: "Đã xác nhận bàn giao tài liệu.", variant: "success" });
    } catch (err) {
      setFormError(crmErrorMessage(err));
    }
  }

  async function handleClose() {
    setFormError(null);
    try {
      await executeClosure.mutateAsync({
        closureReason: closureReason.trim(),
        overrideReason: isOverrideActor ? overrideReason.trim() : undefined,
      });
      toast({ title: "Đã đóng hồ sơ.", variant: "success" });
    } catch (err) {
      setFormError(crmErrorMessage(err));
    }
  }

  async function handleConfirmLiquidation() {
    setFormError(null);
    try {
      await confirmLiquidationCompany.mutateAsync(isOverrideActor ? overrideReason.trim() : undefined);
      toast({ title: "Đã xác nhận thanh lý phía công ty.", variant: "success" });
    } catch (err) {
      setFormError(crmErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        {can("cases", "view") ? (
          <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
            ← {status.caseCode}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{status.caseCode}</span>
        )}
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold">Đóng hồ sơ / Thanh lý</h1>
          <StatusBadge status={status.caseStatus} variantMap={CASE_STATUS_VARIANT} label={CASE_STATUS_LABEL[status.caseStatus]} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checklist đóng hồ sơ (6 điều kiện bắt buộc)</CardTitle>
        </CardHeader>
        <ul className="space-y-2 text-sm">
          {status.checklist.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3 rounded border border-border p-2">
              <div>
                <p className="font-medium">{CLOSURE_CHECKLIST_ITEM_LABEL[item.key] ?? item.key}</p>
                {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
              </div>
              <StatusBadge status={item.status} variantMap={CLOSURE_CHECKLIST_STATUS_VARIANT} label={CLOSURE_CHECKLIST_STATUS_LABEL[item.status]} />
            </li>
          ))}
        </ul>
        <p className={`mt-3 text-sm ${status.readyToClose ? "text-success" : "text-muted-foreground"}`}>
          {status.readyToClose ? "Đủ điều kiện để đóng hồ sơ." : "Chưa đủ điều kiện — cần xử lý các mục Chưa đạt ở trên."}
        </p>
      </Card>

      {canRequest && !isClosed ? (
        <Card>
          <CardHeader>
            <CardTitle>Đề nghị đóng hồ sơ (Tư vấn)</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Gửi đề nghị cho HCTH — mang tính tham khảo, không phải điều kiện bắt buộc để đóng hồ sơ.</p>
            <Textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              rows={2}
              minLength={3}
              placeholder="Đã hoàn tất toàn bộ công việc tư vấn, đề nghị đóng hồ sơ..."
            />
            <Button variant="secondary" onClick={handleRequest} disabled={requestClosure.isPending || requestReason.trim().length < 3}>
              {requestClosure.isPending ? "Đang gửi..." : "Gửi đề nghị"}
            </Button>
          </div>
        </Card>
      ) : null}

      {canExecute ? (
        <Card>
          <CardHeader>
            <CardTitle>Bàn giao tài liệu</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={status.handover.status} variantMap={CLOSURE_HANDOVER_STATUS_VARIANT} label={CLOSURE_HANDOVER_STATUS_LABEL[status.handover.status]} />
              {status.handover.handedOverAt ? (
                <span className="text-xs text-muted-foreground">{new Date(status.handover.handedOverAt).toLocaleDateString("vi-VN")}</span>
              ) : null}
            </div>
            {status.handover.status !== "COMPLETED" ? (
              <>
                <div>
                  <label htmlFor="handover-recipient" className="mb-1 block text-sm font-medium">
                    Người nhận bàn giao
                  </label>
                  <Input id="handover-recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Gia đình học sinh" />
                </div>
                <div>
                  <label htmlFor="handover-notes" className="mb-1 block text-sm font-medium">
                    Ghi chú (nội bộ)
                  </label>
                  <Textarea id="handover-notes" value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} rows={2} />
                </div>
                <Button variant="secondary" onClick={handleHandover} disabled={confirmHandover.isPending}>
                  {confirmHandover.isPending ? "Đang xác nhận..." : "Xác nhận bàn giao"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {status.handover.recipientName ? `Bàn giao cho: ${status.handover.recipientName}` : null}
              </p>
            )}
          </div>
        </Card>
      ) : null}

      {canExecute && !isClosed ? (
        <Card>
          <CardHeader>
            <CardTitle>Đóng hồ sơ</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            <div>
              <label htmlFor="closure-reason" className="mb-1 block text-sm font-medium">
                Lý do đóng hồ sơ *
              </label>
              <Textarea id="closure-reason" value={closureReason} onChange={(e) => setClosureReason(e.target.value)} rows={2} minLength={3} />
            </div>
            {isOverrideActor ? (
              <div>
                <label htmlFor="override-reason" className="mb-1 block text-sm font-medium">
                  Lý do xử lý ngoại lệ (Trưởng phòng/GĐĐH thay HCTH) *
                </label>
                <Textarea id="override-reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} minLength={3} />
              </div>
            ) : null}
            <Button
              variant="danger"
              onClick={handleClose}
              disabled={
                executeClosure.isPending ||
                !status.readyToClose ||
                closureReason.trim().length < 3 ||
                (isOverrideActor && overrideReason.trim().length < 3)
              }
            >
              {executeClosure.isPending ? "Đang đóng hồ sơ..." : "Đóng hồ sơ"}
            </Button>
          </div>
        </Card>
      ) : null}

      {isClosed ? (
        <Card>
          <CardHeader>
            <CardTitle>Thanh lý (xác nhận hai bên)</CardTitle>
          </CardHeader>
          <div className="space-y-3 text-sm">
            {status.liquidation ? (
              <StatusBadge
                status={status.liquidation.status}
                variantMap={CLOSURE_LIQUIDATION_STATUS_VARIANT}
                label={CLOSURE_LIQUIDATION_STATUS_LABEL[status.liquidation.status]}
              />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-border p-2">
                <p className="font-medium">Công ty</p>
                {status.liquidation?.companyConfirmedAt ? (
                  <p className="text-muted-foreground">Đã xác nhận · {new Date(status.liquidation.companyConfirmedAt).toLocaleDateString("vi-VN")}</p>
                ) : (
                  <p className="text-muted-foreground">Chưa xác nhận</p>
                )}
              </div>
              <div className="rounded border border-border p-2">
                <p className="font-medium">Học sinh / Phụ huynh</p>
                {status.liquidation?.studentParentConfirmedAt ? (
                  <p className="text-muted-foreground">Đã xác nhận · {new Date(status.liquidation.studentParentConfirmedAt).toLocaleDateString("vi-VN")}</p>
                ) : (
                  <p className="text-muted-foreground">Chưa xác nhận</p>
                )}
              </div>
            </div>
            {canExecute && status.liquidation?.status !== "LIQUIDATED" ? (
              <Button onClick={handleConfirmLiquidation} disabled={confirmLiquidationCompany.isPending}>
                {confirmLiquidationCompany.isPending ? "Đang xác nhận..." : "Xác nhận thanh lý (phía công ty)"}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
    </div>
  );
}

export default function CaseClosurePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseClosurePageInner params={params} />
    </Suspense>
  );
}

function CaseClosurePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="case-closure" action="view">
      <CaseClosureContent caseId={id} />
    </RequirePermission>
  );
}
