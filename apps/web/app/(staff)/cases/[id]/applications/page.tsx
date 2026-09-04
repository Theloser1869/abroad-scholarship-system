"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { useApplicationsForCase, useCreateApplication } from "@/lib/applications/hooks";
import type { ApplicationListParams, ApplicationStatus } from "@/lib/applications/types";
import { ApplicationFormDialog } from "@/components/crm/applications/application-form-dialog";
import { StatusBadge, APPLICATION_STATUS_VARIANT, APPLICATION_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const STATUS_FILTERS: ApplicationStatus[] = ["PLANNING", "PREPARING", "READY_FOR_REVIEW", "SUBMITTED", "OFFER", "WAITLIST", "REJECT", "WITHDRAWN"];

/// Case-scoped Applications (F05 instruction §13) — `/cases/:caseId/applications`, matching
/// F01's real route map exactly. Checklist-progress/current-offer indicators are NOT shown
/// on this list — the list endpoint doesn't embed those (only `GET /applications/:id`
/// does), and adding a per-row extra fetch to show them would be exactly the N+1 pattern
/// F05 instruction §10 forbids ("Không load toàn bộ program catalog rồi filter ở browser
/// nếu API có server-side filter" — same anti-N+1 spirit).
export function CaseApplicationsContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data: caseRecord } = useCase(caseId);
  useBreadcrumbLabel(caseId, caseRecord?.caseCode);
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params: ApplicationListParams = { page, limit: 20, ...(status ? { status } : {}) };
  const { data, isLoading, error, refetch } = useApplicationsForCase(caseId, params);
  const createApplication = useCreateApplication(caseId);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Hồ sơ ứng tuyển</h1>
          {can("applications", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo hồ sơ</Button> : null}
        </div>
      </div>

      <div className="w-56">
        <label htmlFor="application-status-filter" className="sr-only">
          Lọc theo trạng thái
        </label>
        <select
          id="application-status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ApplicationStatus | "");
            setPage(1);
          }}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Chưa có hồ sơ ứng tuyển nào." description="Tạo hồ sơ ứng tuyển cho một chương trình." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã hồ sơ</TableHeaderCell>
                <TableHeaderCell>Trường / Chương trình</TableHeaderCell>
                <TableHeaderCell>Đợt tuyển sinh</TableHeaderCell>
                <TableHeaderCell>Hạn nộp</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/applications/${a.id}`} className="text-primary underline-offset-2 hover:underline">
                      {a.applicationCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {a.program.university.officialName}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      — {a.program.degreeLevel} · {a.program.major}
                    </span>
                  </TableCell>
                  <TableCell>{a.intendedIntake ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.deadline ? new Date(a.deadline).toLocaleDateString("vi-VN") : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} variantMap={APPLICATION_STATUS_VARIANT} label={APPLICATION_STATUS_LABEL[a.status]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <ApplicationFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createApplication.mutateAsync(input as Parameters<typeof createApplication.mutateAsync>[0])}
        submitting={createApplication.isPending}
      />
    </div>
  );
}

export default function CaseApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseApplicationsPageInner params={params} />
    </Suspense>
  );
}

function CaseApplicationsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="applications" action="view">
      <CaseApplicationsContent caseId={caseId} />
    </RequirePermission>
  );
}
