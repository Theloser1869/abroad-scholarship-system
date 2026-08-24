"use client";

import { Suspense, use } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalContractPayments } from "@/lib/portal/hooks";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { StatusBadge, PAYMENT_STATUS_VARIANT, PAYMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { Card } from "@/components/ui/card";

/// `outstandingAmount`/`isOverdue` are server-computed (`PaymentsService`), never
/// recalculated here (F08 instruction §24: "Do not compute balance/overdue in frontend").
/// No commission/internal-approval fields exist on `Payment` at all — nothing to hide beyond
/// what the shared staff type already models.
export function PaymentsContent({ studentId, contractId }: { studentId: string; contractId: string }) {
  const { data, isLoading, error, refetch } = usePortalContractPayments(studentId, contractId, { limit: 50 });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <QueryErrorState error={error} onRetry={() => refetch()} />;
  if (data.data.length === 0) return <EmptyState title="Chưa có kỳ thanh toán nào." />;

  return (
    <ul className="space-y-3">
      {data.data.map((p) => (
        <li key={p.id}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">Kỳ {p.installmentNo}</p>
                <p className="text-xs text-muted-foreground">Hạn: {new Date(p.dueDate).toLocaleDateString("vi-VN")}</p>
              </div>
              <StatusBadge status={p.status} variantMap={PAYMENT_STATUS_VARIANT} label={PAYMENT_STATUS_LABEL[p.status]} />
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Số tiền</dt>
                <dd>
                  <Money value={p.amount} currency={p.currency} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Đã thanh toán</dt>
                <dd>
                  <Money value={p.paidAmount} currency={p.currency} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Còn lại</dt>
                <dd className={p.isOverdue ? "font-medium text-danger" : ""}>
                  <Money value={p.outstandingAmount} currency={p.currency} /> {p.isOverdue ? "· Quá hạn" : ""}
                </dd>
              </div>
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function PortalPaymentsPage({ params }: { params: Promise<{ id: string; contractId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalPaymentsPageInner params={params} />
    </Suspense>
  );
}

function PortalPaymentsPageInner({ params }: { params: Promise<{ id: string; contractId: string }> }) {
  const { id, contractId } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <PaymentsContent studentId={id} contractId={contractId} />
    </PortalStudentShell>
  );
}
