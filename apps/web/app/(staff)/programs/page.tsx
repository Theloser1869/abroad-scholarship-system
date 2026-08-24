"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { usePrograms, useCreateProgram } from "@/lib/programs/hooks";
import type { ProgramListParams } from "@/lib/programs/types";
import { ProgramFormDialog } from "@/components/crm/programs/program-form-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

function ProgramsListPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedDegree = useDebouncedValue(degreeLevel);

  const params: ProgramListParams = {
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(debouncedDegree ? { degreeLevel: debouncedDegree } : {}),
  };

  const { data, isLoading, error, refetch } = usePrograms(params);
  const createProgram = useCreateProgram();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chương trình</h1>
        {can("admission_master", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo chương trình</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput
            placeholder="Tìm theo ngành, mã chương trình..."
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            aria-label="Tìm kiếm chương trình"
          />
        </div>
        <div className="w-48">
          <Input
            placeholder="Lọc theo bậc học"
            value={degreeLevel}
            onChange={(e) => {
              setDegreeLevel(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo bậc học"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có chương trình nào." description="Thử điều chỉnh bộ lọc hoặc tạo chương trình mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã chương trình</TableHeaderCell>
                <TableHeaderCell>Trường</TableHeaderCell>
                <TableHeaderCell>Bậc học / Ngành</TableHeaderCell>
                <TableHeaderCell>Học phí</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/programs/${p.id}`} className="text-primary underline-offset-2 hover:underline">
                      {p.programCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.university.officialName} <span className="text-xs text-muted-foreground">({p.university.countryCode})</span>
                  </TableCell>
                  <TableCell>
                    {p.degreeLevel} · {p.major}
                  </TableCell>
                  <TableCell>
                    <Money value={p.tuition} currency={p.tuitionCurrency} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[p.status]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <ProgramFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createProgram.mutateAsync(input as Parameters<typeof createProgram.mutateAsync>[0])}
        submitting={createProgram.isPending}
      />
    </div>
  );
}

export default function ProgramsPage() {
  return (
    <RequirePermission resource="admission_master" action="view">
      <ProgramsListPage />
    </RequirePermission>
  );
}
