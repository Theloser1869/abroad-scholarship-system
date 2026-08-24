"use client";

import { Suspense, use, useState } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalRoadmap, useSubmitMilestoneEvidence } from "@/lib/portal/hooks";
import { EvidenceUploadDialog } from "@/components/portal/evidence-upload-dialog";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import { StatusBadge, MILESTONE_STATUS_VARIANT, MILESTONE_STATUS_LABEL } from "@/components/crm/status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/// Read-only overview + the one narrow mutation the backend actually exposes: submitting
/// evidence for a milestone (F08 instruction §13/§14). There is no "mark milestone complete"
/// action anywhere in the Portal API — a student can never self-mark DONE, only submit
/// supporting evidence for staff to review (`PortalService`'s own doc comment: "Không cho
/// Student tự đánh dấu milestone Completed").
export function RoadmapContent({ studentId }: { studentId: string }) {
  const { data: roadmap, isLoading } = usePortalRoadmap(studentId);
  const submitEvidence = useSubmitMilestoneEvidence(studentId);
  const [evidenceMilestoneId, setEvidenceMilestoneId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  if (!roadmap) return <EmptyState title="Chưa có lộ trình." description="Lộ trình sẽ hiển thị khi được tư vấn viên thiết lập." />;

  const activeMilestone = roadmap.milestones.find((m) => m.id === evidenceMilestoneId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tiến độ lộ trình</CardTitle>
        </CardHeader>
        <p className="text-2xl font-semibold">{roadmap.progress}%</p>
        <p className="text-sm text-muted-foreground">
          {roadmap.milestones.filter((m) => m.status === "DONE").length}/{roadmap.milestones.length} mốc đã hoàn thành
        </p>
      </Card>

      {roadmap.milestones.length === 0 ? (
        <EmptyState title="Chưa có mốc lộ trình nào." />
      ) : (
        <ul className="space-y-3">
          {roadmap.milestones.map((m) => (
            <li key={m.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{m.objective}</p>
                    {m.stage ? <p className="text-xs text-muted-foreground">{m.stage}</p> : null}
                  </div>
                  <StatusBadge status={m.status} variantMap={MILESTONE_STATUS_VARIANT} label={MILESTONE_STATUS_LABEL[m.status]} />
                </div>
                <dl className="mt-2 space-y-1 text-sm">
                  {m.metric ? (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Chỉ số</dt>
                      <dd>
                        {m.metric} {m.target ? `→ ${m.target}` : ""}
                      </dd>
                    </div>
                  ) : null}
                  {m.deadline ? (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Hạn</dt>
                      <dd>{new Date(m.deadline).toLocaleDateString("vi-VN")}</dd>
                    </div>
                  ) : null}
                </dl>
                {m.status !== "DONE" && m.status !== "CANCELLED" ? (
                  <Button variant="secondary" className="mt-2" onClick={() => setEvidenceMilestoneId(m.id)}>
                    Gửi minh chứng
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {activeMilestone ? (
        <EvidenceUploadDialog
          open={!!activeMilestone}
          onClose={() => setEvidenceMilestoneId(null)}
          title={`Gửi minh chứng — ${activeMilestone.objective}`}
          studentId={studentId}
          documentType="MILESTONE_EVIDENCE"
          onSubmitEvidence={(documentId) => submitEvidence.mutateAsync({ milestoneId: activeMilestone.id, documentId })}
        />
      ) : null}
    </div>
  );
}

export default function PortalRoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalRoadmapPageInner params={params} />
    </Suspense>
  );
}

function PortalRoadmapPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <RoadmapContent studentId={id} />
    </PortalStudentShell>
  );
}
