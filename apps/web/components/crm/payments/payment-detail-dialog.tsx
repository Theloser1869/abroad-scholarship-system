"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { usePayment, useRecordPayment, useRefundPayment, useWaivePayment } from "@/lib/payments/hooks";
import { StatusBadge, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { ReasonDialog } from "@/components/crm/reason-dialog";
import { PaymentRecordDialog } from "./payment-record-dialog";
import { PaymentRefundDialog } from "./payment-refund-dialog";

const RESOLVED_STATUSES = new Set(["PAID", "REFUNDED", "WAIVED"]);

/// The Payment detail view (F04 instruction §12) — implemented as a dialog opened from the
/// installment list (`/contracts/[id]/payments`), since `docs/frontend/FRONTEND_ROUTES.md`
/// maps no standalone `/payments/[id]` route; documented as an ASSUMPTION in
/// `docs/frontend/phase-status/PHASE_F04.md`. Every amount shown is exactly what the backend
/// returned — `outstandingAmount`/`isOverdue` are server-computed, never recalculated here.
export function PaymentDetailDialog({ open, onClose, paymentId, contractId }: { open: boolean; onClose: () => void; paymentId: string | null; contractId: string }) {
  const { can } = usePermissions();
  const { data: payment, isLoading, error } = usePayment(paymentId ?? undefined);
  const recordPayment = useRecordPayment(paymentId ?? "", contractId);
  const refundPayment = useRefundPayment(paymentId ?? "", contractId);
  const waivePayment = useWaivePayment(paymentId ?? "", contractId);

  const [recordOpen, setRecordOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);

  if (!paymentId) return null;

  const canRecord = can("payments", "record") && payment && !RESOLVED_STATUSES.has(payment.status);
  const canWaive = can("payments", "waive") && payment && payment.status !== "WAIVED" && payment.status !== "REFUNDED";
  const canRefund = can("payments", "refund") && payment && Number(payment.paidAmount) > 0;

  return (
    <Dialog open={open} onClose={onClose} title={payment ? `Kỳ thanh toán ${payment.paymentCode}` : "Chi tiết thanh toán"}>
      {isLoading ? (
        <LoadingState rows={4} />
      ) : error || !payment ? (
        <QueryErrorState error={error} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={payment.status} variantMap={PAYMENT_STATUS_VARIANT} label={PAYMENT_STATUS_LABEL[payment.status]} />
            {payment.isOverdue ? <span className="text-xs font-medium text-danger">Quá hạn</span> : null}
          </div>
          <dl className="space-y-1 text-sm">
            <Row label="Kỳ số" value={String(payment.installmentNo)} />
            <Row label="Số tiền" value={`${payment.amount} ${payment.currency}`} />
            <Row label="Hạn thanh toán" value={new Date(payment.dueDate).toLocaleDateString("vi-VN")} />
            <Row label="Đã thanh toán" value={`${payment.paidAmount} ${payment.currency}`} />
            <Row label="Còn phải thu" value={`${payment.outstandingAmount} ${payment.currency}`} />
            {payment.paidDate ? <Row label="Ngày thanh toán" value={new Date(payment.paidDate).toLocaleDateString("vi-VN")} /> : null}
            {payment.method ? <Row label="Phương thức" value={payment.method} /> : null}
            {payment.reference ? <Row label="Mã tham chiếu" value={payment.reference} /> : null}
            {Number(payment.refundedAmount) > 0 ? <Row label="Đã hoàn" value={`${payment.refundedAmount} ${payment.currency}`} /> : null}
            {payment.refundReason ? <Row label="Lý do hoàn tiền" value={payment.refundReason} /> : null}
            {payment.waivedReason ? <Row label="Lý do miễn" value={payment.waivedReason} /> : null}
          </dl>
          {payment.receiptDocumentId ? (
            <div>
              <p className="mb-1 text-sm font-medium">Biên lai</p>
              <EvidenceDocumentLink documentId={payment.receiptDocumentId} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {canRecord ? (
              <Button type="button" onClick={() => setRecordOpen(true)}>
                Ghi nhận thanh toán
              </Button>
            ) : null}
            {canRefund ? (
              <Button type="button" variant="danger" onClick={() => setRefundOpen(true)}>
                Hoàn tiền
              </Button>
            ) : null}
            {canWaive ? (
              <Button type="button" variant="secondary" onClick={() => setWaiveOpen(true)}>
                Miễn khoản này
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <PaymentRecordDialog open={recordOpen} onClose={() => setRecordOpen(false)} payment={payment ?? null} onSubmit={(input) => recordPayment.mutateAsync(input)} submitting={recordPayment.isPending} />
      <PaymentRefundDialog open={refundOpen} onClose={() => setRefundOpen(false)} payment={payment ?? null} onSubmit={(input) => refundPayment.mutateAsync(input)} submitting={refundPayment.isPending} />
      <ReasonDialog
        open={waiveOpen}
        onClose={() => setWaiveOpen(false)}
        title="Miễn khoản thanh toán"
        description="Thao tác tài chính nhạy cảm — bắt buộc nêu lý do trước khi xác nhận."
        reasonLabel="Lý do miễn"
        reasonRequired
        confirmLabel="Xác nhận miễn"
        variant="danger"
        successMessage="Đã miễn khoản thanh toán."
        onSubmit={(reason) => waivePayment.mutateAsync({ reason })}
        submitting={waivePayment.isPending}
      />
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
