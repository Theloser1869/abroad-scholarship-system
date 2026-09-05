"use client";

import { Suspense, use, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useApproveAssessment, useAssessment, useRejectAssessment, useSubmitAssessment, useUpsertCriterion } from "@/lib/assessments/hooks";
import type { AssessmentCriterion } from "@/lib/assessments/types";
import { CriterionDialog } from "@/components/crm/assessments/criterion-dialog";
import { ReasonDialog } from "@/components/crm/reason-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { StatusBadge, ASSESSMENT_STATUS_VARIANT, ASSESSMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

const EDITABLE_STATUSES = new Set(["DRAFT", "REVIEW"]);

export function AssessmentDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: assessment, isLoading, error, refetch } = useAssessment(id);
  useBreadcrumbLabel(id, assessment ? `Phiên bản ${assessment.version}` : undefined);
  const submitAssessment = useSubmitAssessment(id, assessment?.caseId ?? "");
  const approveAssessment = useApproveAssessment(id, assessment?.caseId ?? "");
  const rejectAssessment = useRejectAssessment(id, assessment?.caseId ?? "");
  const upsertCriterion = useUpsertCriterion(id, assessment?.caseId ?? "");

  const [criterionOpen, setCriterionOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<AssessmentCriterion | undefined>(undefined);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !assessment) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canEditCriteria = EDITABLE_STATUSES.has(assessment.status) && can("assessments", "edit");
  const canSubmit = assessment.status === "DRAFT" && can("assessments", "edit");
  const canApproveReject = assessment.status === "REVIEW" && can("assessments", "approve");

  async function handleSubmit() {
    try {
      await submitAssessment.mutateAsync();
      toast({ title: "Đã gửi duyệt.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Đánh giá năng lực — Phiên bản {assessment.version}</h1>
          {assessment.changeReason ? <p className="text-sm text-muted-foreground">Lý do tạo phiên bản: {assessment.changeReason}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={assessment.status} variantMap={ASSESSMENT_STATUS_VARIANT} label={ASSESSMENT_STATUS_LABEL[assessment.status]} />
          {canSubmit ? (
            <Button variant="secondary" onClick={handleSubmit} disabled={submitAssessment.isPending}>
              {submitAssessment.isPending ? "Đang gửi..." : "Gửi duyệt"}
            </Button>
          ) : null}
          {canApproveReject ? (
            <>
              <Button variant="secondary" onClick={() => setApproveOpen(true)}>
                Duyệt
              </Button>
              <Button variant="danger" onClick={() => setRejectOpen(true)}>
                Từ chối
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tiêu chí đánh giá</CardTitle>
          {canEditCriteria ? (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingCriterion(undefined);
                setCriterionOpen(true);
              }}
            >
              + Thêm tiêu chí
            </Button>
          ) : null}
        </CardHeader>
        {assessment.criteria.length === 0 ? (
          <EmptyState title="Chưa có tiêu chí nào." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Lĩnh vực</TableHeaderCell>
                <TableHeaderCell>Hiện tại</TableHeaderCell>
                <TableHeaderCell>Mục tiêu</TableHeaderCell>
                <TableHeaderCell>Khoảng cách</TableHeaderCell>
                <TableHeaderCell>Ưu tiên</TableHeaderCell>
                <TableHeaderCell>Minh chứng</TableHeaderCell>
                {canEditCriteria ? <TableHeaderCell>&nbsp;</TableHeaderCell> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {assessment.criteria.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.area}</div>
                    {c.recommendation ? <div className="text-xs text-muted-foreground">{c.recommendation}</div> : null}
                  </TableCell>
                  <TableCell>{c.currentScore ?? "—"}</TableCell>
                  <TableCell>{c.targetScore ?? "—"}</TableCell>
                  <TableCell>{c.gap ?? "—"}</TableCell>
                  <TableCell>{c.priority ?? "—"}</TableCell>
                  <TableCell>
                    <EvidenceDocumentLink documentId={c.evidenceDocumentId} />
                  </TableCell>
                  {canEditCriteria ? (
                    <TableCell>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setEditingCriterion(c);
                          setCriterionOpen(true);
                        }}
                      >
                        Sửa
                      </button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CriterionDialog
        open={criterionOpen}
        onClose={() => setCriterionOpen(false)}
        criterion={editingCriterion}
        caseId={assessment?.caseId ?? ""}
        onSubmit={(input) => upsertCriterion.mutateAsync(input)}
        submitting={upsertCriterion.isPending}
      />
      <ReasonDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Duyệt đánh giá"
        successMessage="Đã duyệt đánh giá."
        reasonLabel="Ghi chú"
        onSubmit={(reason) => approveAssessment.mutateAsync(reason || undefined)}
        submitting={approveAssessment.isPending}
      />
      <ReasonDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối đánh giá"
        successMessage="Đã từ chối — chuyển về nháp."
        reasonLabel="Lý do từ chối"
        reasonRequired
        variant="danger"
        onSubmit={(reason) => rejectAssessment.mutateAsync(reason)}
        submitting={rejectAssessment.isPending}
      />
    </div>
  );
}

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <AssessmentDetailPageInner params={params} />
    </Suspense>
  );
}

function AssessmentDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="assessments" action="view">
      <AssessmentDetailContent id={id} />
    </RequirePermission>
  );
}
