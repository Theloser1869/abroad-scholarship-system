"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import {
  useCommissionTransaction,
  useConfirmCommissionEligibility,
  useCalculateCommissionTransaction,
  useApproveCommissionTransaction,
  useMarkCommissionTransactionPayable,
  usePayCommissionTransaction,
  useCancelCommissionTransaction,
} from "@/lib/commission-transactions/hooks";
import { PayCommissionDialog } from "@/components/crm/commission-transactions/pay-commission-dialog";
import { ReasonDialog } from "@/components/crm/reason-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, COMMISSION_TRANSACTION_STATUS_VARIANT, COMMISSION_TRANSACTION_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { TERMINAL_COMMISSION_TRANSACTION_STATUSES } from "@/lib/commission-transactions/types";

/// CommissionTransaction workspace — the full FSM (F06 instruction §23): PENDING →
/// confirm-eligibility → ELIGIBLE → calculate → CALCULATED → approve → APPROVED →
/// mark-payable → PAYABLE → pay → PAID (terminal); cancel reachable from any non-terminal
/// state. `calculate` is server-only Decimal math (F06 instruction §24) — this page never
/// derives `calculatedAmount` itself, only formats the backend's own value via `Money`.
export function CommissionTransactionDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: transaction, isLoading, error, refetch } = useCommissionTransaction(id);

  const confirmEligibility = useConfirmCommissionEligibility(id);
  const calculate = useCalculateCommissionTransaction(id);
  const approve = useApproveCommissionTransaction(id);
  const markPayable = useMarkCommissionTransactionPayable(id);
  const pay = usePayCommissionTransaction(id);
  const cancel = useCancelCommissionTransaction(id);

  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !transaction) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canEdit = can("commission_transactions", "edit");
  const isTerminal = TERMINAL_COMMISSION_TRANSACTION_STATUSES.includes(transaction.status);

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      toast({ title: successMessage, variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/partners/${transaction.partnerId}`} className="text-sm text-primary hover:underline">
            ← {transaction.partner.name}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">
            {transaction.sourceType} — {transaction.sourceId?.slice(0, 8)}…
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={transaction.status} variantMap={COMMISSION_TRANSACTION_STATUS_VARIANT} label={COMMISSION_TRANSACTION_STATUS_LABEL[transaction.status]} />
          {canEdit && transaction.status === "PENDING" ? (
            <Button variant="secondary" onClick={() => runAction(() => confirmEligibility.mutateAsync(), "Đã xác nhận đủ điều kiện.")} disabled={confirmEligibility.isPending}>
              Xác nhận đủ điều kiện
            </Button>
          ) : null}
          {canEdit && transaction.status === "ELIGIBLE" ? (
            <Button variant="secondary" onClick={() => runAction(() => calculate.mutateAsync(), "Đã tính toán số tiền hoa hồng.")} disabled={calculate.isPending}>
              Tính toán
            </Button>
          ) : null}
          {canEdit && transaction.status === "CALCULATED" ? (
            <Button variant="secondary" onClick={() => runAction(() => approve.mutateAsync(), "Đã duyệt giao dịch.")} disabled={approve.isPending}>
              Duyệt
            </Button>
          ) : null}
          {canEdit && transaction.status === "APPROVED" ? (
            <Button variant="secondary" onClick={() => runAction(() => markPayable.mutateAsync(), "Đã chuyển sang chờ thanh toán.")} disabled={markPayable.isPending}>
              Chờ thanh toán
            </Button>
          ) : null}
          {canEdit && transaction.status === "PAYABLE" ? (
            <Button variant="primary" onClick={() => setPayOpen(true)}>
              Thanh toán
            </Button>
          ) : null}
          {canEdit && !isTerminal ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Hủy giao dịch
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin giao dịch</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Học sinh</dt>
            <dd>{transaction.student ? `${transaction.student.fullName} (${transaction.student.studentCode})` : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Hợp đồng</dt>
            <dd>
              {transaction.contractId ? (
                <Link href={`/contracts/${transaction.contractId}`} className="text-primary hover:underline">
                  Xem hợp đồng →
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cơ sở tính</dt>
            <dd>{transaction.basis ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Số tiền cơ sở</dt>
            <dd>
              <Money value={transaction.basisAmount} currency={transaction.currency} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tỷ lệ</dt>
            <dd>{transaction.rate ? `${Number(transaction.rate) * 100}%` : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Số tiền hoa hồng</dt>
            <dd className="font-medium">
              <Money value={transaction.calculatedAmount} currency={transaction.currency} />
            </dd>
          </div>
          {transaction.paidAt ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Đã thanh toán lúc</dt>
                <dd>{new Date(transaction.paidAt).toLocaleString("vi-VN")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mã tham chiếu</dt>
                <dd>{transaction.paymentReference}</dd>
              </div>
            </>
          ) : null}
          {transaction.reason ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Lý do</dt>
              <dd>{transaction.reason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <PayCommissionDialog open={payOpen} onClose={() => setPayOpen(false)} onSubmit={(input) => pay.mutateAsync(input)} submitting={pay.isPending} />
      <ReasonDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Hủy giao dịch hoa hồng"
        successMessage="Đã hủy giao dịch."
        reasonLabel="Lý do hủy"
        reasonRequired
        variant="danger"
        onSubmit={(reason) => cancel.mutateAsync({ reason })}
        submitting={cancel.isPending}
      />
    </div>
  );
}

export default function CommissionTransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CommissionTransactionDetailPageInner params={params} />
    </Suspense>
  );
}

function CommissionTransactionDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="commission_transactions" action="view">
      <CommissionTransactionDetailContent id={id} />
    </RequirePermission>
  );
}
