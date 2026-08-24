"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { useCommissionTransactions } from "@/lib/commission-transactions/hooks";
import type { CommissionTransactionListParams, CommissionTransactionStatus } from "@/lib/commission-transactions/types";
import { Money } from "@/components/crm/money";
import { StatusBadge, COMMISSION_TRANSACTION_STATUS_VARIANT, COMMISSION_TRANSACTION_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

const STATUS_FILTERS: CommissionTransactionStatus[] = ["PENDING", "ELIGIBLE", "CALCULATED", "APPROVED", "PAYABLE", "PAID", "CANCELLED"];

/// Global list (F06 instruction §22) — a real bare `GET /commission-transactions` endpoint
/// exists on the backend, distinct from the partner-nested creation flow (Partner detail
/// page's own "Giao dịch hoa hồng" section handles creation). Financial fields rendered
/// exactly as returned via the shared `Money` component — never recalculated.
function CommissionTransactionsListPage() {
  const [status, setStatus] = useState<CommissionTransactionStatus | "">("");
  const [page, setPage] = useState(1);

  const params: CommissionTransactionListParams = { page, limit: 20, ...(status ? { status } : {}) };
  const { data, isLoading, error, refetch } = useCommissionTransactions(params);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Giao dịch hoa hồng</h1>

      <div className="w-56">
        <label htmlFor="commission-transaction-status-filter" className="sr-only">
          Lọc theo trạng thái
        </label>
        <select
          id="commission-transaction-status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CommissionTransactionStatus | "");
            setPage(1);
          }}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {COMMISSION_TRANSACTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Chưa có giao dịch hoa hồng nào." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Đối tác</TableHeaderCell>
                <TableHeaderCell>Học sinh</TableHeaderCell>
                <TableHeaderCell>Nguồn</TableHeaderCell>
                <TableHeaderCell>Số tiền</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/commission-transactions/${t.id}`} className="text-primary underline-offset-2 hover:underline">
                      {t.partner.name}
                    </Link>
                  </TableCell>
                  <TableCell>{t.student ? `${t.student.fullName} (${t.student.studentCode})` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.sourceType}</TableCell>
                  <TableCell>
                    <Money value={t.calculatedAmount} currency={t.currency} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} variantMap={COMMISSION_TRANSACTION_STATUS_VARIANT} label={COMMISSION_TRANSACTION_STATUS_LABEL[t.status]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function CommissionTransactionsPage() {
  return (
    <RequirePermission resource="commission_transactions" action="view">
      <CommissionTransactionsListPage />
    </RequirePermission>
  );
}
