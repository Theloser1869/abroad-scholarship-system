"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import {
  useCase,
  useCaseMembers,
  useCaseTimeline,
  useUpdateCaseStage,
  useUpdateCaseStatus,
  useCloseCase,
  useAddCaseMember,
  useRemoveCaseMember,
  useReassignCaseOwner,
  useAddCaseNote,
} from "@/lib/cases/hooks";
import { CaseStageDialog } from "@/components/crm/cases/case-stage-dialog";
import { CaseStatusDialog } from "@/components/crm/cases/case-status-dialog";
import { CaseCloseDialog } from "@/components/crm/cases/case-close-dialog";
import { CaseMemberDialog } from "@/components/crm/cases/case-member-dialog";
import { AssignOwnerDialog } from "@/components/crm/assign-owner-dialog";
import { StatusBadge, CASE_STATUS_VARIANT, CASE_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { TimelineView } from "@/components/crm/timeline-view";
import { NoteForm } from "@/components/crm/note-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

const CLOSABLE_STATUSES = new Set(["OPEN", "ACTIVE", "ON_HOLD", "COMPLETED"]);

export function CaseDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();

  const { data: caseRecord, isLoading, error, refetch } = useCase(id);
  const { data: members, isLoading: membersLoading, error: membersError } = useCaseMembers(id);
  const { data: timeline, isLoading: timelineLoading, error: timelineError, refetch: refetchTimeline } = useCaseTimeline(id);

  const updateStage = useUpdateCaseStage(id);
  const updateStatus = useUpdateCaseStatus(id);
  const closeCase = useCloseCase(id);
  const addMember = useAddCaseMember(id);
  const removeMember = useRemoveCaseMember(id);
  const reassignOwner = useReassignCaseOwner(id);
  const addNote = useAddCaseNote(id);

  const [stageOpen, setStageOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !caseRecord) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canClose = CLOSABLE_STATUSES.has(caseRecord.status) && can("cases", "close");

  async function handleRemoveMember(userId: string) {
    if (!window.confirm("Xóa thành viên này khỏi case?")) return;
    try {
      await removeMember.mutateAsync(userId);
      toast({ title: "Đã xóa thành viên.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{caseRecord.caseCode}</h1>
          <p className="text-sm text-muted-foreground">
            Học sinh:{" "}
            <Link href={`/students/${caseRecord.student.id}`} className="text-primary hover:underline">
              {caseRecord.student.fullName}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={caseRecord.status} variantMap={CASE_STATUS_VARIANT} label={CASE_STATUS_LABEL[caseRecord.status]} />
          {can("cases", "edit") ? (
            <Button variant="secondary" onClick={() => setStageOpen(true)}>
              Giai đoạn
            </Button>
          ) : null}
          {can("cases", "edit") && caseRecord.status !== "CLOSED" ? (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Chuyển trạng thái
            </Button>
          ) : null}
          {can("cases", "assign") ? (
            <Button variant="secondary" onClick={() => setOwnerOpen(true)}>
              Đổi chủ sở hữu
            </Button>
          ) : null}
          {canClose ? (
            <Button variant="danger" onClick={() => setCloseOpen(true)}>
              Đóng case
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin case</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chủ sở hữu</dt>
              <dd>{caseRecord.owner.fullName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Giai đoạn</dt>
              <dd>{caseRecord.stage}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phòng ban</dt>
              <dd>{caseRecord.department ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mở lúc</dt>
              <dd>{new Date(caseRecord.openedAt).toLocaleDateString("vi-VN")}</dd>
            </div>
            {caseRecord.closedAt ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Đóng lúc</dt>
                <dd>{new Date(caseRecord.closedAt).toLocaleDateString("vi-VN")}</dd>
              </div>
            ) : null}
            {caseRecord.closureReason ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lý do đóng</dt>
                <dd>{caseRecord.closureReason}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thành viên</CardTitle>
            {can("cases", "assign") ? (
              <Button variant="secondary" onClick={() => setMemberOpen(true)}>
                + Thêm
              </Button>
            ) : null}
          </CardHeader>
          {membersLoading ? (
            <LoadingState rows={2} />
          ) : membersError ? (
            <QueryErrorState error={membersError} />
          ) : !members || members.length === 0 ? (
            <EmptyState title="Chưa có thành viên nào." />
          ) : (
            <ul className="space-y-2 text-sm">
              {members
                .filter((m) => !m.removedAt)
                .map((m) => (
                  <li key={m.userId} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <span>
                      {m.user.fullName} <span className="text-xs text-muted-foreground">({m.role === "OWNER" ? "Chủ sở hữu" : "Cộng tác viên"})</span>
                    </span>
                    {can("cases", "assign") ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.userId)}
                        className="text-xs text-danger hover:underline"
                      >
                        Xóa
                      </button>
                    ) : null}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tư vấn hồ sơ</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-3 text-sm">
          {can("assessments", "view") ? (
            <Link href={`/cases/${id}/assessments`} className="text-primary hover:underline">
              Đánh giá năng lực →
            </Link>
          ) : null}
          {can("roadmaps", "view") ? (
            <Link href={`/cases/${id}/roadmaps`} className="text-primary hover:underline">
              Lộ trình →
            </Link>
          ) : null}
          {can("profile_evidence", "view") ? (
            <Link href={`/cases/${id}/profile`} className="text-primary hover:underline">
              Hồ sơ năng lực →
            </Link>
          ) : null}
          {can("writing", "view") ? (
            <Link href={`/cases/${id}/writing-artifacts`} className="text-primary hover:underline">
              Bài viết →
            </Link>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hoạt động &amp; Ghi chú</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <NoteForm onSubmit={(input) => addNote.mutateAsync(input)} />
          <TimelineView entries={timeline} isLoading={timelineLoading} error={timelineError} onRetry={() => refetchTimeline()} />
        </div>
      </Card>

      <CaseStageDialog
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        currentStage={caseRecord.stage}
        currentDepartment={caseRecord.department}
        onSubmit={(input) => updateStage.mutateAsync(input)}
        submitting={updateStage.isPending}
      />
      <CaseStatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={caseRecord.status}
        onSubmit={(status) => updateStatus.mutateAsync(status)}
        submitting={updateStatus.isPending}
      />
      <CaseCloseDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onSubmit={(reason) => closeCase.mutateAsync(reason)}
        submitting={closeCase.isPending}
      />
      <CaseMemberDialog
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        onSubmit={(input) => addMember.mutateAsync(input)}
        submitting={addMember.isPending}
      />
      <AssignOwnerDialog
        open={ownerOpen}
        onClose={() => setOwnerOpen(false)}
        title="Đổi chủ sở hữu case"
        currentOwnerId={caseRecord.ownerId}
        onSubmit={(userId) => reassignOwner.mutateAsync(userId)}
        submitting={reassignOwner.isPending}
      />
    </div>
  );
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseDetailPageInner params={params} />
    </Suspense>
  );
}

function CaseDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="cases" action="view">
      <CaseDetailContent id={id} />
    </RequirePermission>
  );
}
