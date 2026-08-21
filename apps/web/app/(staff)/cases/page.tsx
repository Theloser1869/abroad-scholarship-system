"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { useCases } from "@/lib/cases/hooks";
import type { CaseListParams, CaseStatus } from "@/lib/cases/types";
import { MANUAL_CASE_STATUSES } from "@/lib/cases/types";
import { StatusBadge, CASE_STATUS_VARIANT, CASE_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

function CasesListPage() {
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [page, setPage] = useState(1);

  const params: CaseListParams = {
    page,
    limit: 20,
    ...(status ? { status } : {}),
  };

  const { data, isLoading, error, refetch } = useCases(params);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Case</h1>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CaseStatus | "");
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {MANUAL_CASE_STATUSES.concat("CLOSED").map((s) => (
            <option key={s} value={s}>
              {CASE_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có case nào." description="Thử điều chỉnh bộ lọc." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã case</TableHeaderCell>
                <TableHeaderCell>Học sinh</TableHeaderCell>
                <TableHeaderCell>Chủ sở hữu</TableHeaderCell>
                <TableHeaderCell>Phòng ban</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                <TableHeaderCell>Cập nhật</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/cases/${c.id}`} className="text-primary underline-offset-2 hover:underline">
                      {c.caseCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/students/${c.student.id}`} className="hover:underline">
                      {c.student.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>{c.owner.fullName}</TableCell>
                  <TableCell>{c.department ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} variantMap={CASE_STATUS_VARIANT} label={CASE_STATUS_LABEL[c.status]} />
                  </TableCell>
                  <TableCell>{new Date(c.updatedAt).toLocaleDateString("vi-VN")}</TableCell>
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

export default function CasesPage() {
  return (
    <RequirePermission resource="cases" action="view">
      <CasesListPage />
    </RequirePermission>
  );
}
