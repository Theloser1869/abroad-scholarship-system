"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalContracts } from "@/lib/portal/hooks";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import { StatusBadge, CONTRACT_STATUS_VARIANT, CONTRACT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { Card } from "@/components/ui/card";

/// No standalone Contract detail route (F01's route map only maps the list + the nested
/// Payments sub-route, same as the staff side — `docs/frontend/FRONTEND_ROUTES.md`
/// "Payments"). `value`/`currency` come back real (not redacted) for STUDENT_PARENT —
/// `FieldPolicyService.FINANCIAL_REDACTED_FOR` does not include this role (SRS §13 "HS/PH =
/// V của mình") — rendered via the shared `Money` component, never recomputed.
export function ContractsContent({ studentId }: { studentId: string }) {
  const { data, isLoading } = usePortalContracts(studentId, { limit: 20 });

  if (isLoading) return <LoadingState />;
  if (!data || data.data.length === 0) return <EmptyState title="Chưa có hợp đồng nào." />;

  return (
    <ul className="space-y-3">
      {data.data.map((c) => (
        <li key={c.id}>
          <Link href={`/portal/students/${studentId}/contracts/${c.id}/payments`}>
            <Card className="hover:border-primary">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.contractCode}</p>
                  <p className="text-xs text-muted-foreground">{c.servicePackage ?? "—"}</p>
                </div>
                <StatusBadge status={c.status} variantMap={CONTRACT_STATUS_VARIANT} label={CONTRACT_STATUS_LABEL[c.status]} />
              </div>
              <p className="mt-1 text-sm">
                <Money value={c.value} currency={c.currency} />
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PortalContractsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalContractsPageInner params={params} />
    </Suspense>
  );
}

function PortalContractsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <ContractsContent studentId={id} />
    </PortalStudentShell>
  );
}
