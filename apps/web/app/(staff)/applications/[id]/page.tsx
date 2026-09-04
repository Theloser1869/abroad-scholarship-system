"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useApplication, useUpdateApplication, useSubmitApplication, useUpdateApplicationStatus, useCreateChecklistItem } from "@/lib/applications/hooks";
import { useCurrentOffer } from "@/lib/offers/hooks";
import { APPLICATION_TRANSITIONS } from "@/lib/applications/types";
import { ApplicationFormDialog } from "@/components/crm/applications/application-form-dialog";
import { ApplicationSubmitDialog } from "@/components/crm/applications/application-submit-dialog";
import { ApplicationStatusDialog } from "@/components/crm/applications/application-status-dialog";
import { ChecklistItemDialog } from "@/components/crm/applications/checklist-item-dialog";
import { ChecklistItemRow } from "@/components/crm/applications/checklist-item-row";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import {
  StatusBadge,
  APPLICATION_STATUS_VARIANT,
  APPLICATION_STATUS_LABEL,
  OFFER_STATUS_VARIANT,
  OFFER_STATUS_LABEL,
  SCHOLARSHIP_APPLICATION_STATUS_VARIANT,
  SCHOLARSHIP_APPLICATION_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UpdateApplicationInput } from "@/lib/applications/types";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

/// Application workspace (F05 instruction §14/§32): Header → Institution/Program → Status →
/// Checklist → Documents → Offers → Scholarship → Actions. Never infers the next FSM state
/// itself — every action button maps to one dedicated backend endpoint, and the backend's
/// own response (incl. `409` conflicts) is what the UI reflects.
export function ApplicationDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { data: application, isLoading, error, refetch } = useApplication(id);
  useBreadcrumbLabel(id, application?.applicationCode);
  const { data: currentOffer } = useCurrentOffer(can("offers", "view") ? id : undefined);

  const updateApplication = useUpdateApplication(id);
  const submitApplication = useSubmitApplication(id);
  const updateStatus = useUpdateApplicationStatus(id);
  const createChecklistItem = useCreateChecklistItem(id);

  const [editOpen, setEditOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [checklistCreateOpen, setChecklistCreateOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !application) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canEdit = application.status !== "WITHDRAWN" && can("applications", "edit");
  const canSubmit = application.status === "READY_FOR_REVIEW" && can("applications", "edit");
  const canChangeStatus = APPLICATION_TRANSITIONS[application.status].length > 0 && can("applications", "edit");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{application.applicationCode}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/universities/${application.program.university.id}`} className="text-primary hover:underline">
              {application.program.university.officialName}
            </Link>{" "}
            ({application.program.university.countryCode}) ·{" "}
            <Link href={`/programs/${application.programId}`} className="text-primary hover:underline">
              {application.program.degreeLevel} · {application.program.major}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={application.status} variantMap={APPLICATION_STATUS_VARIANT} label={APPLICATION_STATUS_LABEL[application.status]} />
          {canEdit ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {canSubmit ? (
            <Button variant="secondary" onClick={() => setSubmitOpen(true)}>
              Nộp hồ sơ
            </Button>
          ) : null}
          {canChangeStatus ? (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Chuyển trạng thái
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hồ sơ</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Đợt tuyển sinh</dt>
              <dd>{application.intendedIntake ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hạn nộp</dt>
              <dd>{application.deadline ? new Date(application.deadline).toLocaleDateString("vi-VN") : "—"}</dd>
            </div>
            {application.submittedAt ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Đã nộp lúc</dt>
                  <dd>{new Date(application.submittedAt).toLocaleString("vi-VN")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Kênh nộp</dt>
                  <dd>{application.submissionChannel ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Mã tham chiếu</dt>
                  <dd>{application.submissionReference ?? "—"}</dd>
                </div>
              </>
            ) : null}
          </dl>
          {application.evidenceDocumentId ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1 text-sm font-medium">Minh chứng nộp hồ sơ</p>
              <EvidenceDocumentLink documentId={application.evidenceDocumentId} />
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thư mời nhập học</CardTitle>
            {can("offers", "view") ? (
              <Link href={`/applications/${id}/offers`} className="text-sm text-primary hover:underline">
                Xem tất cả →
              </Link>
            ) : null}
          </CardHeader>
          {can("offers", "view") ? (
            currentOffer ? (
              <div className="text-sm">
                <p className="font-medium">{currentOffer.offerType}</p>
                <StatusBadge status={currentOffer.status} variantMap={OFFER_STATUS_VARIANT} label={OFFER_STATUS_LABEL[currentOffer.status]} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có thư mời nào.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Không có quyền xem thư mời.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
          {canEdit ? (
            <Button variant="secondary" onClick={() => setChecklistCreateOpen(true)}>
              + Hạng mục
            </Button>
          ) : null}
        </CardHeader>
        {application.checklist.length === 0 ? (
          <EmptyState title="Chưa có hạng mục checklist nào." />
        ) : (
          <ul className="space-y-2">
            {application.checklist.map((item) => (
              <ChecklistItemRow key={item.id} item={item} applicationId={id} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </Card>

      {application.scholarshipApplications.length > 0 && can("scholarship_applications", "view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Học bổng liên quan</CardTitle>
          </CardHeader>
          <ul className="space-y-2 text-sm">
            {application.scholarshipApplications.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <Link href={`/scholarship-applications/${s.id}`} className="text-primary underline-offset-2 hover:underline">
                  {s.scholarshipApplicationCode} — {s.scholarshipMaster.name}
                </Link>
                <StatusBadge status={s.status} variantMap={SCHOLARSHIP_APPLICATION_STATUS_VARIANT} label={SCHOLARSHIP_APPLICATION_STATUS_LABEL[s.status]} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ApplicationFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        application={application}
        onSubmit={(input) => updateApplication.mutateAsync(input as UpdateApplicationInput)}
        submitting={updateApplication.isPending}
      />
      <ApplicationSubmitDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={(input) => submitApplication.mutateAsync(input)}
        submitting={submitApplication.isPending}
      />
      <ApplicationStatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={application.status}
        onSubmit={(input) => updateStatus.mutateAsync(input)}
        submitting={updateStatus.isPending}
      />
      <ChecklistItemDialog
        open={checklistCreateOpen}
        onClose={() => setChecklistCreateOpen(false)}
        onSubmit={(input) => createChecklistItem.mutateAsync(input as Parameters<typeof createChecklistItem.mutateAsync>[0])}
        submitting={createChecklistItem.isPending}
      />
    </div>
  );
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ApplicationDetailPageInner params={params} />
    </Suspense>
  );
}

function ApplicationDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="applications" action="view">
      <ApplicationDetailContent id={id} />
    </RequirePermission>
  );
}
