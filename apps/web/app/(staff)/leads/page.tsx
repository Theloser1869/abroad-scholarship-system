"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useAuth } from "@/lib/auth/auth-context";
import { useLeads, useCreateLead } from "@/lib/leads/hooks";
import type { LeadListParams, LeadStatus } from "@/lib/leads/types";
import { MANUAL_LEAD_STATUSES } from "@/lib/leads/types";
import { LeadFormDialog } from "@/components/crm/leads/lead-form-dialog";
import { StatusBadge, LEAD_STATUS_VARIANT, LEAD_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

function LeadsListPage() {
  const { can } = usePermissions();
  const { principal } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const params: LeadListParams = {
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status ? { status } : {}),
    ...(onlyMine && principal ? { ownerId: principal.userId } : {}),
  };

  const { data, isLoading, error, refetch } = useLeads(params);
  const createLead = useCreateLead();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>
        {can("leads", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo lead</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Input
            placeholder="Tìm theo tên, email, điện thoại..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Tìm kiếm lead"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as LeadStatus | "");
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {MANUAL_LEAD_STATUSES.concat("CONVERTED").map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => {
              setOnlyMine(e.target.checked);
              setPage(1);
            }}
          />
          Chỉ của tôi
        </label>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có lead nào." description="Thử điều chỉnh bộ lọc hoặc tạo lead mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã lead</TableHeaderCell>
                <TableHeaderCell>Liên hệ</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                <TableHeaderCell>Chủ sở hữu</TableHeaderCell>
                <TableHeaderCell>Cập nhật</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="text-primary underline-offset-2 hover:underline">
                      {lead.leadCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{lead.contactName}</div>
                    <div className="text-xs text-muted-foreground">{lead.email ?? lead.phone ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} variantMap={LEAD_STATUS_VARIANT} label={LEAD_STATUS_LABEL[lead.status]} />
                  </TableCell>
                  <TableCell>{lead.owner.fullName}</TableCell>
                  <TableCell>{new Date(lead.updatedAt).toLocaleDateString("vi-VN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <LeadFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createLead.mutateAsync(input)}
        submitting={createLead.isPending}
      />
    </div>
  );
}

export default function LeadsPage() {
  return (
    <RequirePermission resource="leads" action="view">
      <LeadsListPage />
    </RequirePermission>
  );
}
