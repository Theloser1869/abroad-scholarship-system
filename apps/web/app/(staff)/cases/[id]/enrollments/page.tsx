"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { useEnrollmentsForCase, useCreateEnrollment } from "@/lib/enrollments/hooks";
import { EnrollmentFormDialog } from "@/components/crm/enrollments/enrollment-form-dialog";
import { StatusBadge, ENROLLMENT_STATUS_VARIANT, ENROLLMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { CreateEnrollmentInput } from "@/lib/enrollments/types";

/// Case-scoped Enrollment list (F06 instruction §14) — `/cases/:caseId/enrollments`,
/// matching F01's route map. Plain array response, not paginated (mirrors the backend's
/// `listEnrollmentsForCase`, same shape as Pre-departure's checklist array).
export function CaseEnrollmentsContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data: caseRecord } = useCase(caseId);
  useBreadcrumbLabel(caseId, caseRecord?.caseCode);
  const { data: enrollments, isLoading, error, refetch } = useEnrollmentsForCase(caseId);
  const createEnrollment = useCreateEnrollment(caseId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Hồ sơ nhập học</h1>
          {can("enrollment", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo hồ sơ nhập học</Button> : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !enrollments || enrollments.length === 0 ? (
        <EmptyState title="Chưa có hồ sơ nhập học nào." description="Tạo hồ sơ nhập học từ một thư mời đã được chấp nhận." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Trường</TableHeaderCell>
              <TableHeaderCell>Ngành</TableHeaderCell>
              <TableHeaderCell>Ngày bắt đầu</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {enrollments.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/enrollments/${e.id}`} className="text-primary underline-offset-2 hover:underline">
                    {e.university.officialName}
                  </Link>
                </TableCell>
                <TableCell>{e.program.major}</TableCell>
                <TableCell>{e.startDate ? new Date(e.startDate).toLocaleDateString("vi-VN") : "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={e.status} variantMap={ENROLLMENT_STATUS_VARIANT} label={ENROLLMENT_STATUS_LABEL[e.status]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <EnrollmentFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createEnrollment.mutateAsync(input as CreateEnrollmentInput)}
        submitting={createEnrollment.isPending}
      />
    </div>
  );
}

export default function CaseEnrollmentsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseEnrollmentsPageInner params={params} />
    </Suspense>
  );
}

function CaseEnrollmentsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="enrollment" action="view">
      <CaseEnrollmentsContent caseId={caseId} />
    </RequirePermission>
  );
}
