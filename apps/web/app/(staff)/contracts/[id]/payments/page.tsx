"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useContract } from "@/lib/contracts/hooks";
import { useCreatePayment, usePaymentsForContract } from "@/lib/payments/hooks";
import type { PaymentListParams, PaymentStatus } from "@/lib/payments/types";
import { PaymentCreateDialog } from "@/components/crm/payments/payment-create-dialog";
import { PaymentDetailDialog } from "@/components/crm/payments/payment-detail-dialog";
import { StatusBadge, PAYMENT_STATUS_VARIANT, PAYMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

const ALL_STATUSES: PaymentStatus[] = ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "REFUNDED", "WAIVED"];

/// No standalone `/payments` list exists on the backend — installments are always browsed
/// via their parent Contract (docs/frontend/FRONTEND_ROUTES.md). Payment detail/record/
/// refund/waive live in `PaymentDetailDialog`, opened per-row.
export function ContractPaymentsContent({ contractId }: { contractId: string }) {
  const { can } = usePermissions();
  const { data: contract } = useContract(contractId);
  useBreadcrumbLabel(contractId, contract?.contractCode);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const params: PaymentListParams = { page, limit: 20, ...(status ? { status } : {}), ...(overdue ? { overdue: true } : {}) };
  const { data, isLoading, error, refetch } = usePaymentsForContract(contractId, params);
  const createPayment = useCreatePayment(contractId);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/contracts/${contractId}`} className="text-sm text-primary hover:underline">
          ← {contract?.contractCode ?? "Hợp đồng"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Lịch thanh toán</h1>
          {can("payments", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Thêm kỳ thanh toán</Button> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PaymentStatus | "");
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setPage(1);
            }}
          />
          Chỉ quá hạn
        </label>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Chưa có kỳ thanh toán nào." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Kỳ</TableHeaderCell>
                <TableHeaderCell>Số tiền</TableHeaderCell>
                <TableHeaderCell>Hạn</TableHeaderCell>
                <TableHeaderCell>Còn phải thu</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((payment) => (
                <TableRow key={payment.id} className="cursor-pointer hover:bg-muted" onClick={() => setSelectedPaymentId(payment.id)}>
                  <TableCell>
                    <div>{payment.installmentNo}</div>
                    <div className="text-xs text-muted-foreground">{payment.paymentCode}</div>
                  </TableCell>
                  <TableCell>
                    <Money value={payment.amount} currency={payment.currency} />
                  </TableCell>
                  <TableCell>{new Date(payment.dueDate).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell>
                    <Money value={payment.outstandingAmount} currency={payment.currency} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={payment.status} variantMap={PAYMENT_STATUS_VARIANT} label={PAYMENT_STATUS_LABEL[payment.status]} />
                      {payment.isOverdue ? <span className="text-xs font-medium text-danger">Quá hạn</span> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <PaymentCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        contractCurrency={contract?.currency ?? null}
        onSubmit={(input) => createPayment.mutateAsync(input)}
        submitting={createPayment.isPending}
      />
      <PaymentDetailDialog open={!!selectedPaymentId} onClose={() => setSelectedPaymentId(null)} paymentId={selectedPaymentId} contractId={contractId} />
    </div>
  );
}

export default function ContractPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ContractPaymentsPageInner params={params} />
    </Suspense>
  );
}

function ContractPaymentsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="payments" action="view">
      <ContractPaymentsContent contractId={id} />
    </RequirePermission>
  );
}
