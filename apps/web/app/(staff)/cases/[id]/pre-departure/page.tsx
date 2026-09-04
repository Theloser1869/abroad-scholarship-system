"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { usePreDepartureItems, useCreatePreDepartureItem } from "@/lib/pre-departure/hooks";
import { PreDepartureItemDialog } from "@/components/crm/pre-departure/pre-departure-item-dialog";
import { PreDepartureItemRow } from "@/components/crm/pre-departure/pre-departure-item-row";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";
import { Button } from "@/components/ui/button";

/// Pre-departure workspace (F06 instruction §12/§13) — the identical `VisaChecklistItem`
/// model as Visa's own checklist (`entityType: 'PreDeparture'`), reached via its own
/// `/cases/:caseId/pre-departure` route (F01's map). No overview/progress summary widget is
/// invented beyond the item list itself — there is no separate "pre-departure complete" flag
/// anywhere on the backend; the only place completeness is actually enforced is Case Closure.
export function CasePreDepartureContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data: caseRecord } = useCase(caseId);
  useBreadcrumbLabel(caseId, caseRecord?.caseCode);
  const { data: items, isLoading, error, refetch } = usePreDepartureItems(caseId);
  const createItem = useCreatePreDepartureItem(caseId);
  const [createOpen, setCreateOpen] = useState(false);

  const canEdit = can("pre_departure", "edit");
  const total = items?.length ?? 0;
  const resolved = items?.filter((i) => i.status === "DONE" || i.status === "WAIVED").length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Chuẩn bị trước khi khởi hành</h1>
          {can("pre_departure", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Hạng mục</Button> : null}
        </div>
        {total > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {resolved}/{total} hạng mục đã hoàn tất hoặc miễn trừ
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !items || items.length === 0 ? (
        <EmptyState title="Chưa có hạng mục chuẩn bị nào." description="Thêm hạng mục cần hoàn tất trước khi học sinh khởi hành." />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <PreDepartureItemRow key={item.id} item={item} caseId={caseId} canEdit={canEdit} />
          ))}
        </ul>
      )}

      <PreDepartureItemDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createItem.mutateAsync(input as Parameters<typeof createItem.mutateAsync>[0])}
        submitting={createItem.isPending}
      />
    </div>
  );
}

export default function CasePreDeparturePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CasePreDeparturePageInner params={params} />
    </Suspense>
  );
}

function CasePreDeparturePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="pre_departure" action="view">
      <CasePreDepartureContent caseId={caseId} />
    </RequirePermission>
  );
}
