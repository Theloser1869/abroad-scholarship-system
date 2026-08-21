"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useContracts, useCreateContract } from "@/lib/contracts/hooks";
import type { ContractListParams, ContractStatus, CreateContractInput } from "@/lib/contracts/types";
import { ContractFormDialog } from "@/components/crm/contracts/contract-form-dialog";
import { StatusBadge, CONTRACT_STATUS_VARIANT, CONTRACT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const ALL_STATUSES: ContractStatus[] = ["DRAFT", "REVIEW", "APPROVED", "SENT", "SIGNED", "ACTIVE", "COMPLETED", "LIQUIDATED", "ARCHIVED"];

/// Only `status` filtering — the backend's `ContractQueryDto` has no `search` field (verified
/// directly against the DTO; F04 instruction §6: "Không tự tạo filters backend chưa có").
function ContractsListPage() {
  const { can } = usePermissions();
  const [status, setStatus] = useState<ContractStatus | "">("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params: ContractListParams = { page, limit: 20, ...(status ? { status } : {}) };
  const { data, isLoading, error, refetch } = useContracts(params);
  const createContract = useCreateContract();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hợp đồng</h1>
        {can("contracts", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo hợp đồng</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ContractStatus | "");
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CONTRACT_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có hợp đồng nào." description="Thử điều chỉnh bộ lọc hoặc tạo hợp đồng mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã hợp đồng</TableHeaderCell>
                <TableHeaderCell>Học sinh</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                <TableHeaderCell>Giá trị</TableHeaderCell>
                <TableHeaderCell>Cập nhật</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>
                    <Link href={`/contracts/${contract.id}`} className="text-primary underline-offset-2 hover:underline">
                      {contract.contractCode}
                    </Link>
                  </TableCell>
                  <TableCell>{contract.student.fullName}</TableCell>
                  <TableCell>
                    <StatusBadge status={contract.status} variantMap={CONTRACT_STATUS_VARIANT} label={CONTRACT_STATUS_LABEL[contract.status]} />
                  </TableCell>
                  <TableCell>
                    <Money value={contract.value} currency={contract.currency} />
                  </TableCell>
                  <TableCell>{new Date(contract.updatedAt).toLocaleDateString("vi-VN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <ContractFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createContract.mutateAsync(input as CreateContractInput)}
        submitting={createContract.isPending}
      />
    </div>
  );
}

export default function ContractsPage() {
  return (
    <RequirePermission resource="contracts" action="view">
      <ContractsListPage />
    </RequirePermission>
  );
}
