"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useStudent } from "@/lib/students/hooks";
import {
  useUniversityChoicesForStudent,
  useCreateUniversityChoice,
  useUpdateUniversityChoice,
  useReviewUniversityChoice,
} from "@/lib/university-choices/hooks";
import type { UniversityChoice, UniversityChoiceStatus } from "@/lib/university-choices/types";
import { UniversityChoiceFormDialog } from "@/components/crm/university-choices/university-choice-form-dialog";
import { ReasonDialog } from "@/components/crm/reason-dialog";
import {
  StatusBadge,
  UNIVERSITY_CHOICE_TIER_VARIANT,
  UNIVERSITY_CHOICE_TIER_LABEL,
  UNIVERSITY_CHOICE_STATUS_VARIANT,
  UNIVERSITY_CHOICE_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

const STATUSES: UniversityChoiceStatus[] = ["PROPOSED", "SHORTLISTED", "CONFIRMED", "REMOVED"];

/// Case-scoped student-owned shortlist (F05 instruction §12) — student-scoped route
/// (`/students/:studentId/university-choices`, NOT case-scoped; F01's real route map,
/// overriding the mega-prompt's "Case ID là source of scope" assumption). Status here is a
/// plain PATCH field (no dedicated FSM action exists on the backend for this one entity,
/// unlike Application/ScholarshipApplication) — confirmed against the live controller.
function UniversityChoiceRow({ choice, canEdit }: { choice: UniversityChoice; canEdit: boolean }) {
  const { toast } = useToast();
  const updateChoice = useUpdateUniversityChoice(choice.id, choice.studentId);
  const reviewChoice = useReviewUniversityChoice(choice.id, choice.studentId);
  const [editOpen, setEditOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  async function handleStatusChange(status: UniversityChoiceStatus) {
    try {
      await updateChoice.mutateAsync({ status });
      toast({ title: "Đã cập nhật trạng thái.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <li className="space-y-2 rounded border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {choice.program.degreeLevel} · {choice.program.major}
          </p>
          <p className="text-sm text-muted-foreground">
            {choice.program.university.officialName} ({choice.program.university.countryCode})
          </p>
        </div>
        <StatusBadge status={choice.tier} variantMap={UNIVERSITY_CHOICE_TIER_VARIANT} label={UNIVERSITY_CHOICE_TIER_LABEL[choice.tier]} />
      </div>
      {choice.rationale ? <p className="text-sm text-muted-foreground">{choice.rationale}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <select
            aria-label="Trạng thái lựa chọn"
            value={choice.status}
            onChange={(e) => handleStatusChange(e.target.value as UniversityChoiceStatus)}
            disabled={updateChoice.isPending}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {UNIVERSITY_CHOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={choice.status} variantMap={UNIVERSITY_CHOICE_STATUS_VARIANT} label={UNIVERSITY_CHOICE_STATUS_LABEL[choice.status]} />
        )}
        {canEdit ? (
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Sửa
          </Button>
        ) : null}
        {canEdit ? (
          <Button variant="secondary" onClick={() => setReviewOpen(true)}>
            Xét duyệt
          </Button>
        ) : null}
        {choice.reviewedAt ? (
          <span className="text-xs text-muted-foreground">Đã xét duyệt {new Date(choice.reviewedAt).toLocaleDateString("vi-VN")}</span>
        ) : null}
      </div>

      <UniversityChoiceFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        choice={choice}
        onSubmit={(input) => updateChoice.mutateAsync(input as Parameters<typeof updateChoice.mutateAsync>[0])}
        submitting={updateChoice.isPending}
      />
      <ReasonDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Xét duyệt lựa chọn trường"
        successMessage="Đã ghi nhận xét duyệt."
        reasonLabel="Ghi chú xét duyệt"
        onSubmit={(reviewNotes) => reviewChoice.mutateAsync({ reviewNotes: reviewNotes || undefined })}
        submitting={reviewChoice.isPending}
      />
    </li>
  );
}

export function StudentUniversityChoicesContent({ studentId }: { studentId: string }) {
  const { can } = usePermissions();
  const { data: student } = useStudent(studentId);
  const { data: choices, isLoading, error, refetch } = useUniversityChoicesForStudent(studentId);
  const createChoice = useCreateUniversityChoice(studentId);
  const [createOpen, setCreateOpen] = useState(false);

  const canEdit = can("university_choices", "edit");

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/students/${studentId}`} className="text-sm text-primary hover:underline">
          ← {student?.fullName ?? "Học sinh"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Lựa chọn trường (Reach / Match / Safety)</h1>
          {can("university_choices", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Thêm lựa chọn</Button> : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !choices || choices.length === 0 ? (
        <EmptyState title="Chưa có lựa chọn trường nào." description="Thêm chương trình vào danh sách Reach/Match/Safety của học sinh." />
      ) : (
        <ul className="space-y-3">
          {choices.map((c) => (
            <UniversityChoiceRow key={c.id} choice={c} canEdit={canEdit} />
          ))}
        </ul>
      )}

      <UniversityChoiceFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createChoice.mutateAsync(input as Parameters<typeof createChoice.mutateAsync>[0])}
        submitting={createChoice.isPending}
      />
    </div>
  );
}

export default function StudentUniversityChoicesPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentUniversityChoicesPageInner params={params} />
    </Suspense>
  );
}

function StudentUniversityChoicesPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="university_choices" action="view">
      <StudentUniversityChoicesContent studentId={id} />
    </RequirePermission>
  );
}
