"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { useAssessmentsForCase } from "@/lib/assessments/hooks";
import { useCreateRoadmap, useRoadmapsForCase } from "@/lib/roadmaps/hooks";
import { StatusBadge, ROADMAP_STATUS_VARIANT, ROADMAP_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

function CaseRoadmapsContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const router = useRouter();
  const { data: caseRecord } = useCase(caseId);
  const { data: roadmaps, isLoading, error, refetch } = useRoadmapsForCase(caseId);
  const { data: assessments } = useAssessmentsForCase(caseId);
  const createRoadmap = useCreateRoadmap(caseId);
  const [horizonYears, setHorizonYears] = useState("2");

  const approvedAssessment = assessments?.find((a) => a.status === "APPROVED");

  async function handleCreate() {
    try {
      const created = await createRoadmap.mutateAsync({
        assessmentId: approvedAssessment?.id,
        horizonYears: horizonYears ? Number(horizonYears) : undefined,
      });
      toast({ title: "Đã tạo lộ trình mới.", variant: "success" });
      router.push(`/roadmaps/${created.id}`);
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
        <h1 className="mt-1 text-xl font-semibold">Lộ trình</h1>
      </div>

      {can("roadmaps", "create") ? (
        <div className="flex flex-wrap items-end gap-3 rounded border border-border p-3">
          <div>
            <label htmlFor="roadmap-horizon" className="mb-1 block text-sm font-medium">
              Số năm (1–3)
            </label>
            <Input id="roadmap-horizon" type="number" min="1" max="3" className="w-24" value={horizonYears} onChange={(e) => setHorizonYears(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={createRoadmap.isPending}>
            {createRoadmap.isPending ? "Đang tạo..." : "+ Lộ trình mới"}
          </Button>
          {!approvedAssessment ? (
            <p className="text-xs text-muted-foreground">Chưa có đánh giá được duyệt — lộ trình sẽ không thể duyệt tới khi có baseline.</p>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !roadmaps || roadmaps.length === 0 ? (
        <EmptyState title="Chưa có lộ trình nào cho case này." />
      ) : (
        <ul className="space-y-2">
          {roadmaps
            .slice()
            .sort((a, b) => b.version - a.version)
            .map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-border p-3">
                <Link href={`/roadmaps/${r.id}`} className="text-primary hover:underline">
                  Phiên bản {r.version} {r.horizonYears ? `(${r.horizonYears} năm)` : ""}
                </Link>
                <StatusBadge status={r.status} variantMap={ROADMAP_STATUS_VARIANT} label={ROADMAP_STATUS_LABEL[r.status]} />
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function CaseRoadmapsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseRoadmapsPageInner params={params} />
    </Suspense>
  );
}

function CaseRoadmapsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="roadmaps" action="view">
      <CaseRoadmapsContent caseId={caseId} />
    </RequirePermission>
  );
}
