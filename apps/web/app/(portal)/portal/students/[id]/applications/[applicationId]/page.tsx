"use client";

import { Suspense, use, useState } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalApplication, useSubmitChecklistEvidence } from "@/lib/portal/hooks";
import { EvidenceUploadDialog } from "@/components/portal/evidence-upload-dialog";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import {
  StatusBadge,
  APPLICATION_STATUS_VARIANT,
  APPLICATION_STATUS_LABEL,
  CHECKLIST_ITEM_STATUS_VARIANT,
  CHECKLIST_ITEM_STATUS_LABEL,
  OFFER_STATUS_VARIANT,
  OFFER_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/// Read-only except the one narrow checklist-evidence action — Portal never exposes
/// `submit()`/status transitions/offer-response here (F08 instruction §19: "No student-side
/// arbitrary status mutation unless backend explicitly grants it" — it doesn't, for
/// Application). Staff-only internal notes/strategy fields don't exist on `Application` at
/// all, so there is nothing to hide beyond what the shared type already omits.
export function ApplicationDetailContent({ studentId, applicationId }: { studentId: string; applicationId: string }) {
  const { data: application, isLoading, error, refetch } = usePortalApplication(studentId, applicationId);
  const submitEvidence = useSubmitChecklistEvidence(studentId, applicationId);
  const [evidenceItemId, setEvidenceItemId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  if (error || !application) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const activeItem = application.checklist.find((c) => c.id === evidenceItemId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{application.program.university.officialName}</h1>
          <p className="text-sm text-muted-foreground">
            {application.program.degreeLevel} · {application.program.major}
          </p>
        </div>
        <StatusBadge status={application.status} variantMap={APPLICATION_STATUS_VARIANT} label={APPLICATION_STATUS_LABEL[application.status]} />
      </div>

      {application.currentOffer ? (
        <Card>
          <CardHeader>
            <CardTitle>Thư mời</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại thư mời</dt>
              <dd>{application.currentOffer.offerType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd>
                <StatusBadge
                  status={application.currentOffer.status}
                  variantMap={OFFER_STATUS_VARIANT}
                  label={OFFER_STATUS_LABEL[application.currentOffer.status]}
                />
              </dd>
            </div>
            {application.currentOffer.acceptanceDeadline ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hạn phản hồi</dt>
                <dd>{new Date(application.currentOffer.acceptanceDeadline).toLocaleDateString("vi-VN")}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Checklist hồ sơ</CardTitle>
        </CardHeader>
        {application.checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có hạng mục checklist.</p>
        ) : (
          <ul className="space-y-2">
            {application.checklist.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <div>
                  <p className="text-sm">
                    {c.title} {c.required ? <span className="text-danger">*</span> : null}
                  </p>
                  {c.deadline ? <p className="text-xs text-muted-foreground">Hạn: {new Date(c.deadline).toLocaleDateString("vi-VN")}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} variantMap={CHECKLIST_ITEM_STATUS_VARIANT} label={CHECKLIST_ITEM_STATUS_LABEL[c.status]} />
                  {c.status !== "DONE" && c.status !== "WAIVED" ? (
                    <Button variant="secondary" onClick={() => setEvidenceItemId(c.id)}>
                      Gửi minh chứng
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {activeItem ? (
        <EvidenceUploadDialog
          open={!!activeItem}
          onClose={() => setEvidenceItemId(null)}
          title={`Gửi minh chứng — ${activeItem.title}`}
          studentId={studentId}
          documentType="APPLICATION_CHECKLIST_EVIDENCE"
          onSubmitEvidence={(documentId) => submitEvidence.mutateAsync({ checklistItemId: activeItem.id, documentId })}
        />
      ) : null}
    </div>
  );
}

export default function PortalApplicationDetailPage({ params }: { params: Promise<{ id: string; applicationId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalApplicationDetailPageInner params={params} />
    </Suspense>
  );
}

function PortalApplicationDetailPageInner({ params }: { params: Promise<{ id: string; applicationId: string }> }) {
  const { id, applicationId } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <ApplicationDetailContent studentId={id} applicationId={applicationId} />
    </PortalStudentShell>
  );
}
