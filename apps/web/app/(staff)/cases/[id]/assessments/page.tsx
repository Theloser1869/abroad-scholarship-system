"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { useAssessmentsForCase, useCreateAssessment } from "@/lib/assessments/hooks";
import { StatusBadge, ASSESSMENT_STATUS_VARIANT, ASSESSMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

/// Version list (F04 instruction §16/§17: approved versions are immutable, a new version is
/// always the next one). `createAssessment` collects an optional `changeReason` inline
/// (required only once the latest version is APPROVED — surfaced verbatim if omitted, never
/// pre-validated client-side).
function CaseAssessmentsContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const router = useRouter();
  const { data: caseRecord } = useCase(caseId);
  useBreadcrumbLabel(caseId, caseRecord?.caseCode);
  const { data: assessments, isLoading, error, refetch } = useAssessmentsForCase(caseId);
  const createAssessment = useCreateAssessment(caseId);

  async function handleCreate() {
    let changeReason: string | undefined;
    const latest = assessments?.[0];
    if (latest?.status === "APPROVED") {
      const input = window.prompt("Phiên bản hiện tại đã được duyệt — nhập lý do tạo phiên bản đánh giá mới:");
      if (!input || !input.trim()) return;
      changeReason = input.trim();
    }
    try {
      const created = await createAssessment.mutateAsync({ changeReason });
      toast({ title: "Đã tạo phiên bản đánh giá mới.", variant: "success" });
      router.push(`/assessments/${created.id}`);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Đánh giá năng lực</h1>
          {can("assessments", "create") ? (
            <Button onClick={handleCreate} disabled={createAssessment.isPending}>
              {createAssessment.isPending ? "Đang tạo..." : "+ Phiên bản mới"}
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !assessments || assessments.length === 0 ? (
        <EmptyState title="Chưa có đánh giá nào cho case này." />
      ) : (
        <ul className="space-y-2">
          {assessments
            .slice()
            .sort((a, b) => b.version - a.version)
            .map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded border border-border p-3">
                <Link href={`/assessments/${a.id}`} className="text-primary hover:underline">
                  Phiên bản {a.version}
                </Link>
                <StatusBadge status={a.status} variantMap={ASSESSMENT_STATUS_VARIANT} label={ASSESSMENT_STATUS_LABEL[a.status]} />
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function CaseAssessmentsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseAssessmentsPageInner params={params} />
    </Suspense>
  );
}

function CaseAssessmentsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="assessments" action="view">
      <CaseAssessmentsContent caseId={caseId} />
    </RequirePermission>
  );
}
