"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUniversities, useCreateUniversity } from "@/lib/universities/hooks";
import type { UniversityListParams } from "@/lib/universities/types";
import { UniversityFormDialog } from "@/components/crm/universities/university-form-dialog";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

/// GLOBAL master-data catalog (F05 instruction §7/§31) — server-side search/filter/
/// pagination only, table over cards (a catalog list, not a workflow queue).
function UniversitiesListPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedCountry = useDebouncedValue(countryCode);

  const params: UniversityListParams = {
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(debouncedCountry ? { countryCode: debouncedCountry } : {}),
  };

  const { data, isLoading, error, refetch } = useUniversities(params);
  const createUniversity = useCreateUniversity();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trường đại học</h1>
        {can("admission_master", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo trường</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput
            placeholder="Tìm theo tên, mã, thành phố..."
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            aria-label="Tìm kiếm trường đại học"
          />
        </div>
        <div className="w-32">
          <Input
            placeholder="Mã quốc gia"
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value.toUpperCase());
              setPage(1);
            }}
            maxLength={2}
            aria-label="Lọc theo mã quốc gia"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có trường đại học nào." description="Thử điều chỉnh bộ lọc hoặc tạo trường mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã trường</TableHeaderCell>
                <TableHeaderCell>Tên chính thức</TableHeaderCell>
                <TableHeaderCell>Quốc gia</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                <TableHeaderCell>Xác minh lần cuối</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/universities/${u.id}`} className="text-primary underline-offset-2 hover:underline">
                      {u.universityCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {u.officialName}
                    {u.city ? <span className="text-xs text-muted-foreground"> · {u.city}</span> : null}
                  </TableCell>
                  <TableCell>{u.countryCode}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[u.status]} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.lastVerifiedAt ? new Date(u.lastVerifiedAt).toLocaleDateString("vi-VN") : "Chưa xác minh"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <UniversityFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createUniversity.mutateAsync(input as Parameters<typeof createUniversity.mutateAsync>[0])}
        submitting={createUniversity.isPending}
      />
    </div>
  );
}

export default function UniversitiesPage() {
  return (
    <RequirePermission resource="admission_master" action="view">
      <UniversitiesListPage />
    </RequirePermission>
  );
}
