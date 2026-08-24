"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import {
  usePortalRoadmap,
  usePortalTasks,
  usePortalApplications,
  usePortalScholarships,
  usePortalVisas,
  usePortalPreDeparture,
  usePortalEnrollments,
  usePortalContracts,
} from "@/lib/portal/hooks";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StatusBadge,
  TASK_STATUS_VARIANT,
  TASK_STATUS_LABEL,
  APPLICATION_STATUS_VARIANT,
  APPLICATION_STATUS_LABEL,
  SCHOLARSHIP_APPLICATION_STATUS_VARIANT,
  SCHOLARSHIP_APPLICATION_STATUS_LABEL,
  VISA_STATUS_VARIANT,
  VISA_STATUS_LABEL,
  ENROLLMENT_STATUS_VARIANT,
  ENROLLMENT_STATUS_LABEL,
  CONTRACT_STATUS_VARIANT,
  CONTRACT_STATUS_LABEL,
} from "@/components/crm/status-badge";

/// Portal Overview (F08 instruction §12/§36 information hierarchy: "What's happening now →
/// What needs action → What's coming next"). Every number here is a value the backend
/// already returned (a status field, a `progress`/`isOverdue` computed field, a
/// `meta.totalItems` count) — nothing is independently calculated (F08 instruction §12
/// "CRITICAL: Do not calculate business KPIs independently").
export function OverviewContent({ studentId }: { studentId: string }) {
  const roadmap = usePortalRoadmap(studentId);
  const tasks = usePortalTasks(studentId, { limit: 5 });
  const applications = usePortalApplications(studentId, { limit: 5 });
  const scholarships = usePortalScholarships(studentId);
  const visas = usePortalVisas(studentId, { limit: 5 });
  const preDeparture = usePortalPreDeparture(studentId);
  const enrollments = usePortalEnrollments(studentId);
  const contracts = usePortalContracts(studentId, { limit: 5 });

  const preDepartureDone = (preDeparture.data ?? []).filter((i) => i.status === "DONE" || i.status === "WAIVED").length;
  const preDepartureTotal = (preDeparture.data ?? []).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Lộ trình</CardTitle>
        </CardHeader>
        {roadmap.isLoading ? (
          <LoadingState rows={1} />
        ) : !roadmap.data ? (
          <EmptyState title="Chưa có lộ trình." />
        ) : (
          <div className="space-y-1 text-sm">
            <p>Tiến độ: {roadmap.data.progress}%</p>
            <p className="text-muted-foreground">{roadmap.data.milestones.length} mốc lộ trình</p>
            <Link href={`/portal/students/${studentId}/roadmap`} className="text-primary hover:underline">
              Xem chi tiết →
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nhiệm vụ sắp tới</CardTitle>
        </CardHeader>
        {tasks.isLoading ? (
          <LoadingState rows={2} />
        ) : !tasks.data || tasks.data.data.length === 0 ? (
          <EmptyState title="Không có nhiệm vụ nào." />
        ) : (
          <ul className="space-y-2 text-sm">
            {tasks.data.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className={t.isOverdue ? "text-danger" : ""}>{t.title}</span>
                <StatusBadge status={t.status} variantMap={TASK_STATUS_VARIANT} label={TASK_STATUS_LABEL[t.status]} />
              </li>
            ))}
          </ul>
        )}
        <Link href={`/portal/students/${studentId}/tasks`} className="mt-2 inline-block text-sm text-primary hover:underline">
          Xem tất cả →
        </Link>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hồ sơ ứng tuyển</CardTitle>
        </CardHeader>
        {applications.isLoading ? (
          <LoadingState rows={2} />
        ) : !applications.data || applications.data.data.length === 0 ? (
          <EmptyState title="Chưa có hồ sơ ứng tuyển." />
        ) : (
          <ul className="space-y-2 text-sm">
            {applications.data.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>{a.program.university.officialName}</span>
                <StatusBadge status={a.status} variantMap={APPLICATION_STATUS_VARIANT} label={APPLICATION_STATUS_LABEL[a.status]} />
              </li>
            ))}
          </ul>
        )}
        <Link href={`/portal/students/${studentId}/applications`} className="mt-2 inline-block text-sm text-primary hover:underline">
          Xem tất cả →
        </Link>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Học bổng</CardTitle>
        </CardHeader>
        {scholarships.isLoading ? (
          <LoadingState rows={2} />
        ) : !scholarships.data || scholarships.data.length === 0 ? (
          <EmptyState title="Chưa có hồ sơ học bổng." />
        ) : (
          <ul className="space-y-2 text-sm">
            {scholarships.data.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span>{s.scholarshipMaster.name}</span>
                <StatusBadge status={s.status} variantMap={SCHOLARSHIP_APPLICATION_STATUS_VARIANT} label={SCHOLARSHIP_APPLICATION_STATUS_LABEL[s.status]} />
              </li>
            ))}
          </ul>
        )}
        <Link href={`/portal/students/${studentId}/scholarships`} className="mt-2 inline-block text-sm text-primary hover:underline">
          Xem tất cả →
        </Link>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visa</CardTitle>
        </CardHeader>
        {visas.isLoading ? (
          <LoadingState rows={2} />
        ) : !visas.data || visas.data.data.length === 0 ? (
          <EmptyState title="Chưa có hồ sơ visa." />
        ) : (
          <ul className="space-y-2 text-sm">
            {visas.data.data.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <span>{v.visaType}</span>
                <StatusBadge status={v.status} variantMap={VISA_STATUS_VARIANT} label={VISA_STATUS_LABEL[v.status]} />
              </li>
            ))}
          </ul>
        )}
        <Link href={`/portal/students/${studentId}/visa`} className="mt-2 inline-block text-sm text-primary hover:underline">
          Xem tất cả →
        </Link>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trước khi đi</CardTitle>
        </CardHeader>
        {preDeparture.isLoading ? (
          <LoadingState rows={1} />
        ) : preDepartureTotal === 0 ? (
          <EmptyState title="Chưa có checklist." />
        ) : (
          <div className="space-y-1 text-sm">
            <p>
              {preDepartureDone}/{preDepartureTotal} hạng mục đã hoàn tất hoặc miễn trừ
            </p>
            <Link href={`/portal/students/${studentId}/pre-departure`} className="text-primary hover:underline">
              Xem chi tiết →
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nhập học</CardTitle>
        </CardHeader>
        {enrollments.isLoading ? (
          <LoadingState rows={1} />
        ) : !enrollments.data || enrollments.data.length === 0 ? (
          <EmptyState title="Chưa có hồ sơ nhập học." />
        ) : (
          <ul className="space-y-2 text-sm">
            {enrollments.data.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>{e.university.officialName}</span>
                <StatusBadge status={e.status} variantMap={ENROLLMENT_STATUS_VARIANT} label={ENROLLMENT_STATUS_LABEL[e.status]} />
              </li>
            ))}
          </ul>
        )}
        <Link href={`/portal/students/${studentId}/enrollment`} className="mt-2 inline-block text-sm text-primary hover:underline">
          Xem tất cả →
        </Link>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hợp đồng</CardTitle>
        </CardHeader>
        {contracts.isLoading ? (
          <LoadingState rows={1} />
        ) : !contracts.data || contracts.data.data.length === 0 ? (
          <EmptyState title="Chưa có hợp đồng." />
        ) : (
          <ul className="space-y-2 text-sm">
            {contracts.data.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>{c.contractCode}</span>
                <StatusBadge status={c.status} variantMap={CONTRACT_STATUS_VARIANT} label={CONTRACT_STATUS_LABEL[c.status]} />
              </li>
            ))}
          </ul>
        )}
        <Link href={`/portal/students/${studentId}/contracts`} className="mt-2 inline-block text-sm text-primary hover:underline">
          Xem tất cả →
        </Link>
      </Card>
    </div>
  );
}

export default function PortalStudentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalStudentOverviewPageInner params={params} />
    </Suspense>
  );
}

function PortalStudentOverviewPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <OverviewContent studentId={id} />
    </PortalStudentShell>
  );
}
