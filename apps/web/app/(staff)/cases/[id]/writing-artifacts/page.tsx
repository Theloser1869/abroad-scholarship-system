"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import { useCreateWritingArtifact, useWritingArtifactsForCase } from "@/lib/writing/hooks";
import { useCreateLor, useLorForCase, useUpdateLor } from "@/lib/lor/hooks";
import type { CreateLorInput, LetterOfRecommendation, UpdateLorInput } from "@/lib/lor/types";
import { WritingArtifactFormDialog } from "@/components/crm/writing/writing-artifact-form-dialog";
import { LorFormDialog } from "@/components/crm/writing/lor-form-dialog";
import {
  StatusBadge,
  WRITING_STATUS_VARIANT,
  WRITING_STATUS_LABEL,
  LOR_REQUEST_STATUS_VARIANT,
  LOR_SUBMISSION_STATUS_VARIANT,
} from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REQUEST_LABEL: Record<string, string> = {
  NOT_REQUESTED: "Chưa yêu cầu",
  REQUESTED: "Đã yêu cầu",
  IN_PROGRESS: "Đang thực hiện",
  RECEIVED: "Đã nhận",
  DECLINED: "Từ chối",
};
const SUBMISSION_LABEL: Record<string, string> = { PENDING: "Chưa nộp", SUBMITTED: "Đã nộp", NOT_REQUIRED: "Không yêu cầu" };

export function CaseWritingArtifactsContent({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data: caseRecord } = useCase(caseId);
  const { data: artifacts, isLoading, error, refetch } = useWritingArtifactsForCase(caseId);
  const createArtifact = useCreateWritingArtifact(caseId);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: lors, isLoading: lorsLoading, error: lorsError } = useLorForCase(caseId);
  const createLor = useCreateLor(caseId);
  const [lorEditing, setLorEditing] = useState<LetterOfRecommendation | "new" | null>(null);
  const lorEditTarget = lorEditing && lorEditing !== "new" ? lorEditing : undefined;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Bài viết</h1>
          {can("writing", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo bài viết</Button> : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !artifacts || artifacts.length === 0 ? (
        <EmptyState title="Chưa có bài viết nào cho case này." />
      ) : (
        <ul className="space-y-2">
          {artifacts.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded border border-border p-3">
              <div>
                <Link href={`/writing-artifacts/${a.id}`} className="text-primary hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-muted-foreground">{a.type}</p>
              </div>
              <StatusBadge status={a.status} variantMap={WRITING_STATUS_VARIANT} label={WRITING_STATUS_LABEL[a.status]} />
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thư giới thiệu (LOR)</CardTitle>
          {can("writing", "create") ? (
            <Button
              variant="secondary"
              onClick={() => {
                setLorEditing("new");
              }}
            >
              + Thêm LOR
            </Button>
          ) : null}
        </CardHeader>
        {lorsLoading ? (
          <LoadingState rows={2} />
        ) : lorsError ? (
          <QueryErrorState error={lorsError} />
        ) : !lors || lors.length === 0 ? (
          <EmptyState title="Chưa theo dõi thư giới thiệu nào." />
        ) : (
          <ul className="space-y-2">
            {lors.map((l) => (
              <li key={l.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{l.recommenderName}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.relationship ?? "—"} {l.deadline ? `· Hạn: ${new Date(l.deadline).toLocaleDateString("vi-VN")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={l.requestStatus} variantMap={LOR_REQUEST_STATUS_VARIANT} label={REQUEST_LABEL[l.requestStatus]} />
                    <StatusBadge status={l.submissionStatus} variantMap={LOR_SUBMISSION_STATUS_VARIANT} label={SUBMISSION_LABEL[l.submissionStatus]} />
                  </div>
                </div>
                {can("writing", "edit") ? (
                  <button type="button" className="mt-2 text-xs text-primary hover:underline" onClick={() => setLorEditing(l)}>
                    Sửa
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <WritingArtifactFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={(input) => createArtifact.mutateAsync(input)} submitting={createArtifact.isPending} />
      <LorEditDialog caseId={caseId} editing={lorEditing} onClose={() => setLorEditing(null)} createLor={createLor} lorEditTarget={lorEditTarget} />
    </div>
  );
}

/// Wraps the create/update mutation selection so `useUpdateLor` (a hook) is only bound to a
/// real target id at this component's own top level, never conditionally inside a callback.
function LorEditDialog({
  caseId,
  editing,
  onClose,
  createLor,
  lorEditTarget,
}: {
  caseId: string;
  editing: LetterOfRecommendation | "new" | null;
  onClose: () => void;
  createLor: ReturnType<typeof useCreateLor>;
  lorEditTarget: LetterOfRecommendation | undefined;
}) {
  const updateLor = useUpdateLor(lorEditTarget?.id ?? "", caseId);
  return (
    <LorFormDialog
      open={editing !== null}
      onClose={onClose}
      record={lorEditTarget}
      onSubmit={(input) => (lorEditTarget ? updateLor.mutateAsync(input as UpdateLorInput) : createLor.mutateAsync(input as CreateLorInput))}
      submitting={updateLor.isPending || createLor.isPending}
    />
  );
}

export default function CaseWritingArtifactsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseWritingArtifactsPageInner params={params} />
    </Suspense>
  );
}

function CaseWritingArtifactsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="writing" action="view">
      <CaseWritingArtifactsContent caseId={caseId} />
    </RequirePermission>
  );
}
