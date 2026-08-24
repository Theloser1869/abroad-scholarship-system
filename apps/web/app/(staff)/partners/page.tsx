"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { usePartners, useCreatePartner } from "@/lib/partners/hooks";
import type { PartnerListParams } from "@/lib/partners/types";
import { PartnerFormDialog } from "@/components/crm/partners/partner-form-dialog";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

const PARTNER_TYPE_LABEL: Record<string, string> = {
  UNIVERSITY_REPRESENTATIVE: "Đại diện trường",
  AGENCY: "Đại lý",
  LANGUAGE_CENTER: "Trung tâm ngoại ngữ",
  OTHER: "Khác",
};

function PartnersListPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedCountry = useDebouncedValue(countryCode);

  const params: PartnerListParams = {
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(debouncedCountry ? { countryCode: debouncedCountry } : {}),
  };

  const { data, isLoading, error, refetch } = usePartners(params);
  const createPartner = useCreatePartner();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Đối tác</h1>
        {can("partner", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo đối tác</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput
            placeholder="Tìm theo tên đối tác..."
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            aria-label="Tìm kiếm đối tác"
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
        <EmptyState title="Không có đối tác nào." description="Thử điều chỉnh bộ lọc hoặc tạo đối tác mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã đối tác</TableHeaderCell>
                <TableHeaderCell>Tên</TableHeaderCell>
                <TableHeaderCell>Loại</TableHeaderCell>
                <TableHeaderCell>Quốc gia</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/partners/${p.id}`} className="text-primary underline-offset-2 hover:underline">
                      {p.partnerCode}
                    </Link>
                  </TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{PARTNER_TYPE_LABEL[p.type] ?? p.type}</TableCell>
                  <TableCell>{p.countryCode}</TableCell>
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

      <PartnerFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createPartner.mutateAsync(input as Parameters<typeof createPartner.mutateAsync>[0])}
        submitting={createPartner.isPending}
      />
    </div>
  );
}

export default function PartnersPage() {
  return (
    <RequirePermission resource="partner" action="view">
      <PartnersListPage />
    </RequirePermission>
  );
}
