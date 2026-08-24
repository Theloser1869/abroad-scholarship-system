"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useCase } from "@/lib/cases/hooks";
import {
  useAcademicRecordsForCase,
  useActivitiesForCase,
  useCompetitionsForCase,
  useCreateAcademicRecord,
  useCreateActivity,
  useCreateCompetition,
  useCreateResearchProject,
  useCreateTestRecord,
  useResearchProjectsForCase,
  useTestRecordsForCase,
  useUpdateAcademicRecord,
  useUpdateActivity,
  useUpdateCompetition,
  useUpdateResearchProject,
  useUpdateTestRecord,
  useVerifyAcademicRecord,
  useVerifyActivity,
  useVerifyTestRecord,
} from "@/lib/profile-evidence/hooks";
import type { AcademicRecord, Activity, Competition, ResearchProject, TestRecord } from "@/lib/profile-evidence/types";
import { AcademicRecordDialog } from "@/components/crm/profile-evidence/academic-record-dialog";
import { TestRecordDialog } from "@/components/crm/profile-evidence/test-record-dialog";
import { CompetitionDialog } from "@/components/crm/profile-evidence/competition-dialog";
import { ResearchProjectDialog } from "@/components/crm/profile-evidence/research-project-dialog";
import { ActivityDialog } from "@/components/crm/profile-evidence/activity-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Button } from "@/components/ui/button";

type Tab = "academic" | "test" | "competition" | "research" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "academic", label: "Học tập" },
  { key: "test", label: "Bài thi chuẩn hóa" },
  { key: "competition", label: "Thi đấu" },
  { key: "research", label: "Nghiên cứu" },
  { key: "activity", label: "Hoạt động / Lãnh đạo" },
];

export function CaseProfileContent({ caseId }: { caseId: string }) {
  const { data: caseRecord } = useCase(caseId);
  const [tab, setTab] = useState<Tab>("academic");

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cases/${caseId}`} className="text-sm text-primary hover:underline">
          ← {caseRecord?.caseCode ?? "Case"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Hồ sơ năng lực</h1>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "academic" ? <AcademicTab caseId={caseId} /> : null}
      {tab === "test" ? <TestTab caseId={caseId} /> : null}
      {tab === "competition" ? <CompetitionTab caseId={caseId} /> : null}
      {tab === "research" ? <ResearchTab caseId={caseId} /> : null}
      {tab === "activity" ? <ActivityTab caseId={caseId} /> : null}
    </div>
  );
}

function AcademicTab({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data, isLoading, error, refetch } = useAcademicRecordsForCase(caseId);
  const create = useCreateAcademicRecord(caseId);
  const [editing, setEditing] = useState<AcademicRecord | "new" | null>(null);
  const editTarget = editing && editing !== "new" ? editing : undefined;
  const update = useUpdateAcademicRecord(editTarget?.id ?? "", caseId);

  return (
    <div className="space-y-3">
      {can("profile_evidence", "create") ? <Button onClick={() => setEditing("new")}>+ Thêm hồ sơ học tập</Button> : null}
      {isLoading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Chưa có hồ sơ học tập nào." />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <AcademicRow key={r.id} record={r} caseId={caseId} canEdit={can("profile_evidence", "edit")} onEdit={() => setEditing(r)} />
          ))}
        </ul>
      )}
      <AcademicRecordDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        record={editTarget}
        onSubmit={(input) => (editTarget ? update.mutateAsync(input) : create.mutateAsync(input as Parameters<typeof create.mutateAsync>[0]))}
        submitting={update.isPending || create.isPending}
      />
    </div>
  );
}

/// A per-row component so `useVerifyAcademicRecord` (a mutation hook) is called at this
/// component's own top level, never inside the parent's `.map()` callback (Rules of Hooks).
function AcademicRow({ record: r, caseId, canEdit, onEdit }: { record: AcademicRecord; caseId: string; canEdit: boolean; onEdit: () => void }) {
  const verify = useVerifyAcademicRecord(r.id, caseId);
  return (
    <li className="rounded border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {r.school} · {r.period}
          </p>
          <p className="text-xs text-muted-foreground">
            GPA: {r.gpa ?? "—"} {r.gradingScale ? `(${r.gradingScale})` : ""} {r.verifiedAt ? "· Đã xác minh" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <EvidenceDocumentLink documentId={r.evidenceDocumentId} />
          {canEdit ? (
            <>
              <button type="button" className="text-primary hover:underline" onClick={onEdit}>
                Sửa
              </button>
              {!r.verifiedAt ? (
                <button type="button" className="text-primary hover:underline" disabled={verify.isPending} onClick={() => verify.mutateAsync()}>
                  {verify.isPending ? "Đang xác minh..." : "Xác minh"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function CaseProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CaseProfilePageInner params={params} />
    </Suspense>
  );
}

function CaseProfilePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  return (
    <RequirePermission resource="profile_evidence" action="view">
      <CaseProfileContent caseId={caseId} />
    </RequirePermission>
  );
}

function TestTab({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data, isLoading, error, refetch } = useTestRecordsForCase(caseId);
  const create = useCreateTestRecord(caseId);
  const [editing, setEditing] = useState<TestRecord | "new" | null>(null);
  const editTarget = editing && editing !== "new" ? editing : undefined;
  const update = useUpdateTestRecord(editTarget?.id ?? "", caseId);
  const verify = useVerifyTestRecord(editTarget?.id ?? "", caseId);

  return (
    <div className="space-y-3">
      {can("profile_evidence", "create") ? <Button onClick={() => setEditing("new")}>+ Thêm lượt thi</Button> : null}
      {isLoading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Chưa có kết quả bài thi nào." />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <TestRow key={r.id} record={r} caseId={caseId} canEdit={can("profile_evidence", "edit")} onEdit={() => setEditing(r)} />
          ))}
        </ul>
      )}
      <TestRecordDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        record={editTarget}
        onSubmit={(input) => (editTarget ? update.mutateAsync(input) : create.mutateAsync(input as Parameters<typeof create.mutateAsync>[0]))}
        submitting={update.isPending || create.isPending || verify.isPending}
      />
    </div>
  );
}

function TestRow({ record: r, caseId, canEdit, onEdit }: { record: TestRecord; caseId: string; canEdit: boolean; onEdit: () => void }) {
  const verify = useVerifyTestRecord(r.id, caseId);
  return (
    <li className="rounded border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {r.testType} — Lần {r.attemptNumber}
          </p>
          <p className="text-xs text-muted-foreground">
            Điểm: {r.score ?? "—"} {r.target ? `(mục tiêu: ${r.target})` : ""} {r.verifiedAt ? "· Đã xác minh" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <EvidenceDocumentLink documentId={r.evidenceDocumentId} />
          {canEdit ? (
            <>
              <button type="button" className="text-primary hover:underline" onClick={onEdit}>
                Sửa
              </button>
              {!r.verifiedAt ? (
                <button type="button" className="text-primary hover:underline" disabled={verify.isPending} onClick={() => verify.mutateAsync()}>
                  {verify.isPending ? "Đang xác minh..." : "Xác minh"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function CompetitionTab({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data, isLoading, error, refetch } = useCompetitionsForCase(caseId);
  const create = useCreateCompetition(caseId);
  const [editing, setEditing] = useState<Competition | "new" | null>(null);
  const editTarget = editing && editing !== "new" ? editing : undefined;
  const update = useUpdateCompetition(editTarget?.id ?? "", caseId);

  return (
    <div className="space-y-3">
      {can("profile_evidence", "create") ? <Button onClick={() => setEditing("new")}>+ Thêm hoạt động thi đấu</Button> : null}
      {isLoading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Chưa có hoạt động thi đấu nào." />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {r.eventName} {r.year ? `(${r.year})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.rank ? `Hạng: ${r.rank} · ` : ""}
                    {r.award ?? ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <EvidenceDocumentLink documentId={r.evidenceDocumentId} />
                  {can("profile_evidence", "edit") ? (
                    <button type="button" className="text-primary hover:underline" onClick={() => setEditing(r)}>
                      Sửa
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <CompetitionDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        record={editTarget}
        onSubmit={(input) => (editTarget ? update.mutateAsync(input) : create.mutateAsync(input as Parameters<typeof create.mutateAsync>[0]))}
        submitting={update.isPending || create.isPending}
      />
    </div>
  );
}

function ResearchTab({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data, isLoading, error, refetch } = useResearchProjectsForCase(caseId);
  const create = useCreateResearchProject(caseId);
  const [editing, setEditing] = useState<ResearchProject | "new" | null>(null);
  const editTarget = editing && editing !== "new" ? editing : undefined;
  const update = useUpdateResearchProject(editTarget?.id ?? "", caseId);

  return (
    <div className="space-y-3">
      {can("profile_evidence", "create") ? <Button onClick={() => setEditing("new")}>+ Thêm dự án nghiên cứu</Button> : null}
      {isLoading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Chưa có dự án nghiên cứu nào." />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.mentor ? `HD: ${r.mentor} · ` : ""}
                    {r.role ?? ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <EvidenceDocumentLink documentId={r.evidenceDocumentId} />
                  {can("profile_evidence", "edit") ? (
                    <button type="button" className="text-primary hover:underline" onClick={() => setEditing(r)}>
                      Sửa
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ResearchProjectDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        record={editTarget}
        onSubmit={(input) => (editTarget ? update.mutateAsync(input) : create.mutateAsync(input as Parameters<typeof create.mutateAsync>[0]))}
        submitting={update.isPending || create.isPending}
      />
    </div>
  );
}

function ActivityTab({ caseId }: { caseId: string }) {
  const { can } = usePermissions();
  const { data, isLoading, error, refetch } = useActivitiesForCase(caseId);
  const create = useCreateActivity(caseId);
  const [editing, setEditing] = useState<Activity | "new" | null>(null);
  const editTarget = editing && editing !== "new" ? editing : undefined;
  const update = useUpdateActivity(editTarget?.id ?? "", caseId);
  const verify = useVerifyActivity(editTarget?.id ?? "", caseId);

  return (
    <div className="space-y-3">
      {can("profile_evidence", "create") ? <Button onClick={() => setEditing("new")}>+ Thêm hoạt động</Button> : null}
      {isLoading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Chưa có hoạt động ngoại khóa nào." />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <ActivityRow key={r.id} record={r} caseId={caseId} canEdit={can("profile_evidence", "edit")} onEdit={() => setEditing(r)} />
          ))}
        </ul>
      )}
      <ActivityDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        record={editTarget}
        onSubmit={(input) => (editTarget ? update.mutateAsync(input) : create.mutateAsync(input as Parameters<typeof create.mutateAsync>[0]))}
        submitting={update.isPending || create.isPending || verify.isPending}
      />
    </div>
  );
}

function ActivityRow({ record: r, caseId, canEdit, onEdit }: { record: Activity; caseId: string; canEdit: boolean; onEdit: () => void }) {
  const verify = useVerifyActivity(r.id, caseId);
  return (
    <li className="rounded border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {r.organization} {r.role ? `— ${r.role}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {r.category ?? ""} {r.hours ? `· ${r.hours} giờ` : ""} {r.verifiedAt ? "· Đã xác minh" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <EvidenceDocumentLink documentId={r.evidenceDocumentId} />
          {canEdit ? (
            <>
              <button type="button" className="text-primary hover:underline" onClick={onEdit}>
                Sửa
              </button>
              {!r.verifiedAt ? (
                <button type="button" className="text-primary hover:underline" disabled={verify.isPending} onClick={() => verify.mutateAsync()}>
                  {verify.isPending ? "Đang xác minh..." : "Xác minh"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
