"use client";

import { Suspense, use } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalPreDeparture } from "@/lib/portal/hooks";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import { StatusBadge, CHECKLIST_ITEM_STATUS_VARIANT, CHECKLIST_ITEM_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card } from "@/components/ui/card";

/// Read-only, server-reported checklist state only — there is no "mark pre-departure
/// complete" action anywhere (identical `VisaChecklistItem` model as Visa's own checklist,
/// F06 ASM-69's finding reused verbatim here); completeness is enforced only at Case Closure,
/// entirely staff-side (F08 instruction §22: "Do not recreate checklist business logic").
export function PreDepartureContent({ studentId }: { studentId: string }) {
  const { data: items, isLoading } = usePortalPreDeparture(studentId);

  if (isLoading) return <LoadingState />;
  if (!items || items.length === 0) return <EmptyState title="Chưa có checklist trước khi khởi hành." />;

  const done = items.filter((i) => i.status === "DONE" || i.status === "WAIVED").length;
  const byCategory = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.category ?? "Khác";
    byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-2xl font-semibold">
          {done}/{items.length}
        </p>
        <p className="text-sm text-muted-foreground">hạng mục đã hoàn tất hoặc miễn trừ</p>
      </Card>

      {[...byCategory.entries()].map(([category, categoryItems]) => (
        <Card key={category}>
          <p className="mb-2 text-sm font-medium">{category}</p>
          <ul className="space-y-2">
            {categoryItems.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <div>
                  <p className="text-sm">
                    {i.title} {i.required ? <span className="text-danger">*</span> : null}
                  </p>
                  {i.deadline ? <p className="text-xs text-muted-foreground">Hạn: {new Date(i.deadline).toLocaleDateString("vi-VN")}</p> : null}
                </div>
                <StatusBadge status={i.status} variantMap={CHECKLIST_ITEM_STATUS_VARIANT} label={CHECKLIST_ITEM_STATUS_LABEL[i.status]} />
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export default function PortalPreDeparturePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalPreDeparturePageInner params={params} />
    </Suspense>
  );
}

function PortalPreDeparturePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <PreDepartureContent studentId={id} />
    </PortalStudentShell>
  );
}
