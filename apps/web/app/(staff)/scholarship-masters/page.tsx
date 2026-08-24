"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useScholarshipMasters, useCreateScholarshipMaster } from "@/lib/scholarship-masters/hooks";
import type { ScholarshipMasterListParams } from "@/lib/scholarship-masters/types";
import { ScholarshipMasterFormDialog } from "@/components/crm/scholarship-masters/scholarship-master-form-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

/// Scholarship MASTER catalog — deliberately distinct UI/route from Scholarship
/// Applications (the per-student transaction, `/cases/[caseId]/scholarship-applications`),
/// per F05 instruction §5/§11.
function ScholarshipMastersListPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const params: ScholarshipMasterListParams = {
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };

  const { data, isLoading, error, refetch } = useScholarshipMasters(params);
  const createScholarshipMaster = useCreateScholarshipMaster();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Học bổng (danh mục)</h1>
        {can("admission_master", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo học bổng</Button> : null}
      </div>

      <div className="w-64">
        <SearchInput
          placeholder="Tìm theo tên, đơn vị cấp..."
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          aria-label="Tìm kiếm học bổng"
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có học bổng nào." description="Thử điều chỉnh bộ lọc hoặc tạo học bổng mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã học bổng</TableHeaderCell>
                <TableHeaderCell>Tên</TableHeaderCell>
                <TableHeaderCell>Đơn vị cấp</TableHeaderCell>
                <TableHeaderCell>Giá trị</TableHeaderCell>
                <TableHeaderCell>Hạn nộp</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/scholarship-masters/${s.id}`} className="text-primary underline-offset-2 hover:underline">
                      {s.scholarshipCode}
                    </Link>
                  </TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.provider}</TableCell>
                  <TableCell>{s.amount ? <Money value={s.amount} currency={s.amountCurrency} /> : s.percentage ? `${s.percentage}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.deadline ? new Date(s.deadline).toLocaleDateString("vi-VN") : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[s.status]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <ScholarshipMasterFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createScholarshipMaster.mutateAsync(input as Parameters<typeof createScholarshipMaster.mutateAsync>[0])}
        submitting={createScholarshipMaster.isPending}
      />
    </div>
  );
}

export default function ScholarshipMastersPage() {
  return (
    <RequirePermission resource="admission_master" action="view">
      <ScholarshipMastersListPage />
    </RequirePermission>
  );
}
