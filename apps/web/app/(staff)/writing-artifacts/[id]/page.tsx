"use client";

import { Suspense, use, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCreateWritingVersion, useUpdateWritingStatus, useWritingArtifact } from "@/lib/writing/hooks";
import { WritingVersionDialog } from "@/components/crm/writing/writing-version-dialog";
import { WritingStatusDialog } from "@/components/crm/writing/writing-status-dialog";
import { WritingVersionRow } from "@/components/crm/writing/writing-version-row";
import { StatusBadge, WRITING_STATUS_VARIANT, WRITING_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TERMINAL_STATUSES = new Set(["SUBMITTED"]);

export function WritingArtifactDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { data: artifact, isLoading, error, refetch } = useWritingArtifact(id);
  const createVersion = useCreateWritingVersion(id);
  const updateStatus = useUpdateWritingStatus(id, artifact?.caseId ?? "");

  const [versionOpen, setVersionOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !artifact) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canManage = can("writing", "edit") && !TERMINAL_STATUSES.has(artifact.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{artifact.title}</h1>
          <p className="text-sm text-muted-foreground">{artifact.type}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={artifact.status} variantMap={WRITING_STATUS_VARIANT} label={WRITING_STATUS_LABEL[artifact.status]} />
          {canManage ? (
            <>
              <Button variant="secondary" onClick={() => setVersionOpen(true)}>
                + Phiên bản mới
              </Button>
              <Button variant="secondary" onClick={() => setStatusOpen(true)}>
                Chuyển trạng thái
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử phiên bản</CardTitle>
        </CardHeader>
        {artifact.versions.length === 0 ? (
          <EmptyState title="Chưa có phiên bản nào." />
        ) : (
          <ul className="space-y-3">
            {artifact.versions.map((v) => (
              <WritingVersionRow key={v.id} version={v} artifactId={artifact.id} />
            ))}
          </ul>
        )}
      </Card>

      <WritingVersionDialog open={versionOpen} onClose={() => setVersionOpen(false)} onSubmit={(input) => createVersion.mutateAsync(input)} submitting={createVersion.isPending} />
      <WritingStatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={artifact.status}
        onSubmit={(status) => updateStatus.mutateAsync(status)}
        submitting={updateStatus.isPending}
      />
    </div>
  );
}

export default function WritingArtifactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <WritingArtifactDetailPageInner params={params} />
    </Suspense>
  );
}

function WritingArtifactDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="writing" action="view">
      <WritingArtifactDetailContent id={id} />
    </RequirePermission>
  );
}
