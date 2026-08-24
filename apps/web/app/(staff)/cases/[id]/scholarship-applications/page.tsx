"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { useApplicationsForCase } from "@/lib/applications/hooks";
import { useScholarshipApplicationsForCase, useCreateScholarshipApplication } from "@/lib/scholarship-applications/hooks";
import { ScholarshipApplicationFormDialog } from "@/components/crm/scholarship-applications/scholarship-application-form-dialog";
import { StatusBadge, SCHOLARSHIP_APPLICATION_STATUS_VARIANT, SCHOLARSHIP_APPLICATION_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Button } from "@/components/ui/button";

/// Case-scoped Scholarship Applications (F05 instruction §21) — kept structurally distinct
/// from ScholarshipMaster's own `/scholarship-masters` catalog route.
export function CaseScholarshipApplicationsContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data: caseRecord } = useCase(caseId);
  const { data: applications } = useApplicationsForCase(caseId, { limit: 100 });
  const { data: scholarshipApplications, isLoading, error, refetch } = useScholarshipApplicationsForCase(caseId);
  const createScholarshipApplication = useCreateScholarshipApplication(caseId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Hồ sơ học bổng</h1>
          {can("scholarship_applications", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo hồ sơ học bổng</Button> : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !scholarshipApplications || scholarshipApplications.length === 0 ? (
        <EmptyState title="Chưa có hồ sơ học bổng nào." description="Tạo hồ sơ học bổng cho một học bổng trong danh mục." />
      ) : (
        <ul className="space-y-2">
          {scholarshipApplications.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-border p-3">
              <div>
                <Link href={`/scholarship-applications/${s.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                  {s.scholarshipApplicationCode}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {s.scholarshipMaster.name} — {s.scholarshipMaster.provider}
                </p>
              </div>
              <StatusBadge status={s.status} variantMap={SCHOLARSHIP_APPLICATION_STATUS_VARIANT} label={SCHOLARSHIP_APPLICATION_STATUS_LABEL[s.status]} />
            </li>
          ))}
        </ul>
      )}

      <ScholarshipApplicationFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        caseApplications={applications?.data ?? []}
        onSubmit={(input) => createScholarshipApplication.mutateAsync(input as Parameters<typeof createScholarshipApplication.mutateAsync>[0])}
        submitting={createScholarshipApplication.isPending}
      />
    </div>
  );
}

export default function CaseScholarshipApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseScholarshipApplicationsPageInner params={params} />
    </Suspense>
  );
}

function CaseScholarshipApplicationsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="scholarship_applications" action="view">
      <CaseScholarshipApplicationsContent caseId={caseId} />
    </RequirePermission>
  );
}
