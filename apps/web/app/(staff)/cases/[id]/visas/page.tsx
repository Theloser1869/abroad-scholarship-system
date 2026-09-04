"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { useVisasForCase, useCreateVisa } from "@/lib/visas/hooks";
import type { VisaListParams, VisaStatus } from "@/lib/visas/types";
import { VisaFormDialog } from "@/components/crm/visas/visa-form-dialog";
import { StatusBadge, VISA_STATUS_VARIANT, VISA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const STATUS_FILTERS: VisaStatus[] = ["NOT_STARTED", "PREPARING", "READY", "SUBMITTED", "APPOINTMENT", "INTERVIEW", "GRANTED", "REFUSED", "WITHDRAWN"];

/// Case-scoped Visa list (F06 instruction §7) — `/cases/:caseId/visas`, matching F01's route
/// map exactly. No global `/visas` list exists on the backend.
export function CaseVisasContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data: caseRecord } = useCase(caseId);
  useBreadcrumbLabel(caseId, caseRecord?.caseCode);
  const [status, setStatus] = useState<VisaStatus | "">("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params: VisaListParams = { page, limit: 20, ...(status ? { status } : {}) };
  const { data, isLoading, error, refetch } = useVisasForCase(caseId, params);
  const createVisa = useCreateVisa(caseId);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Hồ sơ visa</h1>
          {can("visa", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo hồ sơ visa</Button> : null}
        </div>
      </div>

      <div className="w-56">
        <label htmlFor="visa-status-filter" className="sr-only">
          Lọc theo trạng thái
        </label>
        <select
          id="visa-status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as VisaStatus | "");
            setPage(1);
          }}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {VISA_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Chưa có hồ sơ visa nào." description="Tạo hồ sơ visa cho case này." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã hồ sơ</TableHeaderCell>
                <TableHeaderCell>Quốc gia</TableHeaderCell>
                <TableHeaderCell>Loại visa</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link href={`/visas/${v.id}`} className="text-primary underline-offset-2 hover:underline">
                      {v.visaCode}
                    </Link>
                  </TableCell>
                  <TableCell>{v.countryCode}</TableCell>
                  <TableCell>{v.visaType}</TableCell>
                  <TableCell>
                    <StatusBadge status={v.status} variantMap={VISA_STATUS_VARIANT} label={VISA_STATUS_LABEL[v.status]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <VisaFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createVisa.mutateAsync(input as Parameters<typeof createVisa.mutateAsync>[0])}
        submitting={createVisa.isPending}
      />
    </div>
  );
}

export default function CaseVisasPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseVisasPageInner params={params} />
    </Suspense>
  );
}

function CaseVisasPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="visa" action="view">
      <CaseVisasContent caseId={caseId} />
    </RequirePermission>
  );
}
