"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import {
  useScholarshipApplication,
  useUpdateScholarshipApplication,
  useConfirmScholarshipEligibility,
  useUpdateScholarshipApplicationStatus,
  useAwardScholarship,
  useRejectScholarshipApplication,
} from "@/lib/scholarship-applications/hooks";
import { useApplicationsForCase } from "@/lib/applications/hooks";
import { ScholarshipApplicationFormDialog } from "@/components/crm/scholarship-applications/scholarship-application-form-dialog";
import { ScholarshipStatusDialog } from "@/components/crm/scholarship-applications/scholarship-status-dialog";
import { AwardDialog } from "@/components/crm/scholarship-applications/award-dialog";
import { ReasonDialog } from "@/components/crm/reason-dialog";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { Money } from "@/components/crm/money";
import { StatusBadge, SCHOLARSHIP_APPLICATION_STATUS_VARIANT, SCHOLARSHIP_APPLICATION_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { UpdateScholarshipApplicationInput } from "@/lib/scholarship-applications/types";

const CLOSED_STATUSES = new Set(["AWARDED", "REJECTED", "WITHDRAWN"]);
const AWARD_REJECT_STATUSES = new Set(["UNDER_REVIEW", "INTERVIEW"]);

/// Scholarship workspace (F05 instruction §33): Header → Scholarship → Eligibility →
/// Application status → Evidence/checklist → Result → Award. Eligibility gate is entirely
/// server-decided — the Submit path is offered here as a generic status change, and the
/// backend independently rejects `409 ELIGIBILITY_NOT_CONFIRMED` if not yet confirmed
/// (never pre-computed client-side, F05 instruction §22).
export function ScholarshipApplicationDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: scholarshipApplication, isLoading, error, refetch } = useScholarshipApplication(id);
  const { data: caseApplications } = useApplicationsForCase(scholarshipApplication?.caseId ?? "", { limit: 100 });

  const updateScholarshipApplication = useUpdateScholarshipApplication(id, scholarshipApplication?.caseId ?? "");
  const confirmEligibility = useConfirmScholarshipEligibility(id, scholarshipApplication?.caseId ?? "");
  const updateStatus = useUpdateScholarshipApplicationStatus(id, scholarshipApplication?.caseId ?? "");
  const awardScholarship = useAwardScholarship(id, scholarshipApplication?.caseId ?? "");
  const rejectScholarshipApplication = useRejectScholarshipApplication(id, scholarshipApplication?.caseId ?? "");

  const [editOpen, setEditOpen] = useState(false);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !scholarshipApplication) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const isClosed = CLOSED_STATUSES.has(scholarshipApplication.status);
  const canEdit = !isClosed && can("scholarship_applications", "edit");
  const canConfirmEligibility = !isClosed && !scholarshipApplication.eligibilityConfirmed && can("scholarship_applications", "edit");
  const canChangeStatus = !isClosed && can("scholarship_applications", "edit");
  const canAwardReject = AWARD_REJECT_STATUSES.has(scholarshipApplication.status) && can("scholarship_applications", "edit");

  async function handleReject() {
    try {
      await rejectScholarshipApplication.mutateAsync();
      toast({ title: "Đã từ chối hồ sơ học bổng.", variant: "success" });
      setRejectOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{scholarshipApplication.scholarshipMaster.name}</h1>
          <p className="text-sm text-muted-foreground">
            {scholarshipApplication.scholarshipApplicationCode} ·{" "}
            <Link href={`/scholarship-masters/${scholarshipApplication.scholarshipMasterId}`} className="text-primary hover:underline">
              {scholarshipApplication.scholarshipMaster.provider}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={scholarshipApplication.status}
            variantMap={SCHOLARSHIP_APPLICATION_STATUS_VARIANT}
            label={SCHOLARSHIP_APPLICATION_STATUS_LABEL[scholarshipApplication.status]}
          />
          {canEdit ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {canChangeStatus ? (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Chuyển trạng thái
            </Button>
          ) : null}
          {canAwardReject ? (
            <>
              <Button variant="primary" onClick={() => setAwardOpen(true)}>
                Trao học bổng
              </Button>
              <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={rejectScholarshipApplication.isPending}>
                Từ chối
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Điều kiện đủ tư cách</CardTitle>
          {canConfirmEligibility ? (
            <Button variant="secondary" onClick={() => setEligibilityOpen(true)}>
              Xác nhận đủ điều kiện
            </Button>
          ) : null}
        </CardHeader>
        <p className="text-sm">
          {scholarshipApplication.eligibilityConfirmed ? (
            <span className="font-medium text-success">Đã xác nhận đủ điều kiện.</span>
          ) : (
            <span className="text-muted-foreground">Chưa xác nhận — cần xác nhận trước khi nộp hồ sơ.</span>
          )}
        </p>
        {scholarshipApplication.eligibilityNotes ? <p className="mt-1 text-sm text-muted-foreground">{scholarshipApplication.eligibilityNotes}</p> : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin hồ sơ</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Hạn nộp</dt>
            <dd>{scholarshipApplication.deadline ? new Date(scholarshipApplication.deadline).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          {scholarshipApplication.applicationId ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Liên kết hồ sơ ứng tuyển</dt>
              <dd>
                <Link href={`/applications/${scholarshipApplication.applicationId}`} className="text-primary hover:underline">
                  Xem hồ sơ →
                </Link>
              </dd>
            </div>
          ) : null}
          {scholarshipApplication.essayArtifactId ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Bài luận</dt>
              <dd>
                <Link href={`/writing-artifacts/${scholarshipApplication.essayArtifactId}`} className="text-primary hover:underline">
                  Xem bài viết →
                </Link>
              </dd>
            </div>
          ) : null}
          {scholarshipApplication.interviewAt ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phỏng vấn lúc</dt>
              <dd>{new Date(scholarshipApplication.interviewAt).toLocaleString("vi-VN")}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ghi chú nội bộ</dt>
            {/* `null` when field-redacted for STUDENT_PARENT (FieldPolicyService) or
               genuinely unset — rendered exactly as returned, never a client workaround
               (same precedent as Student.budget in F03). */}
            <dd>{scholarshipApplication.internalNotes ?? "—"}</dd>
          </div>
          {scholarshipApplication.conditions ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Điều kiện</dt>
              <dd>{scholarshipApplication.conditions}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {scholarshipApplication.status === "AWARDED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả trao học bổng</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Giá trị</dt>
              <dd>
                <Money value={scholarshipApplication.awardAmount} currency={scholarshipApplication.awardCurrency} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại chi trả</dt>
              <dd>{scholarshipApplication.awardCoverageType ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Kỳ hạn</dt>
              <dd>{scholarshipApplication.awardPeriod ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hạn xác nhận nhận học bổng</dt>
              <dd>{scholarshipApplication.awardAcceptanceDeadline ? new Date(scholarshipApplication.awardAcceptanceDeadline).toLocaleDateString("vi-VN") : "—"}</dd>
            </div>
          </dl>
          {scholarshipApplication.evidenceDocumentId ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1 text-sm font-medium">Tài liệu trao học bổng</p>
              <EvidenceDocumentLink documentId={scholarshipApplication.evidenceDocumentId} />
            </div>
          ) : null}
        </Card>
      ) : null}

      <ScholarshipApplicationFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        scholarshipApplication={scholarshipApplication}
        caseApplications={caseApplications?.data ?? []}
        onSubmit={(input) => updateScholarshipApplication.mutateAsync(input as UpdateScholarshipApplicationInput)}
        submitting={updateScholarshipApplication.isPending}
      />
      <ReasonDialog
        open={eligibilityOpen}
        onClose={() => setEligibilityOpen(false)}
        title="Xác nhận đủ điều kiện"
        successMessage="Đã xác nhận đủ điều kiện."
        reasonLabel="Ghi chú đủ điều kiện"
        onSubmit={(eligibilityNotes) => confirmEligibility.mutateAsync({ eligibilityNotes: eligibilityNotes || undefined })}
        submitting={confirmEligibility.isPending}
      />
      <ScholarshipStatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={scholarshipApplication.status}
        onSubmit={(status) => updateStatus.mutateAsync(status)}
        submitting={updateStatus.isPending}
      />
      <AwardDialog open={awardOpen} onClose={() => setAwardOpen(false)} onSubmit={(input) => awardScholarship.mutateAsync(input)} submitting={awardScholarship.isPending} />
      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối hồ sơ học bổng"
        description="Thao tác này không thể hoàn tác."
        confirmLabel="Từ chối"
        variant="danger"
        onConfirm={handleReject}
        submitting={rejectScholarshipApplication.isPending}
      />
    </div>
  );
}

export default function ScholarshipApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ScholarshipApplicationDetailPageInner params={params} />
    </Suspense>
  );
}

function ScholarshipApplicationDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="scholarship_applications" action="view">
      <ScholarshipApplicationDetailContent id={id} />
    </RequirePermission>
  );
}
