"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUniversity, useUpdateUniversity, useVerifyUniversity } from "@/lib/universities/hooks";
import { usePrograms } from "@/lib/programs/hooks";
import { useScholarshipMasters } from "@/lib/scholarship-masters/hooks";
import { UniversityFormDialog } from "@/components/crm/universities/university-form-dialog";
import { ProgramFormDialog } from "@/components/crm/programs/program-form-dialog";
import { useCreateProgram } from "@/lib/programs/hooks";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { UpdateUniversityInput } from "@/lib/universities/types";

export function UniversityDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: university, isLoading, error, refetch } = useUniversity(id);
  const { data: programs, isLoading: programsLoading, error: programsError } = usePrograms({ universityId: id, limit: 50 });
  const { data: scholarships, isLoading: scholarshipsLoading, error: scholarshipsError } = useScholarshipMasters({ universityId: id, limit: 50 });

  const updateUniversity = useUpdateUniversity(id);
  const verifyUniversity = useVerifyUniversity(id);
  const createProgram = useCreateProgram();

  const [editOpen, setEditOpen] = useState(false);
  const [createProgramOpen, setCreateProgramOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !university) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  async function handleVerify() {
    try {
      await verifyUniversity.mutateAsync();
      toast({ title: "Đã xác minh trường đại học.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{university.officialName}</h1>
          <p className="text-sm text-muted-foreground">
            {university.universityCode} · {university.countryCode}
            {university.city ? ` · ${university.city}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={university.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[university.status]} />
          {can("admission_master", "edit") ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {can("admission_master", "verify") ? (
            <Button variant="secondary" onClick={handleVerify} disabled={verifyUniversity.isPending}>
              {verifyUniversity.isPending ? "Đang xác minh..." : "Xác minh"}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cơ sở</dt>
            <dd>{university.campus ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Website</dt>
            <dd>
              {university.website ? (
                <a href={university.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {university.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Trang tuyển sinh</dt>
            <dd>
              {university.admissionsUrl ? (
                <a href={university.admissionsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {university.admissionsUrl}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Xác minh lần cuối</dt>
            <dd>{university.lastVerifiedAt ? new Date(university.lastVerifiedAt).toLocaleString("vi-VN") : "Chưa xác minh"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Nguồn dữ liệu</dt>
            <dd>{university.source ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chương trình</CardTitle>
          {can("admission_master", "create") ? (
            <Button variant="secondary" onClick={() => setCreateProgramOpen(true)}>
              + Chương trình
            </Button>
          ) : null}
        </CardHeader>
        {programsLoading ? (
          <LoadingState rows={2} />
        ) : programsError ? (
          <QueryErrorState error={programsError} />
        ) : !programs || programs.data.length === 0 ? (
          <EmptyState title="Chưa có chương trình nào." />
        ) : (
          <ul className="space-y-2 text-sm">
            {programs.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <Link href={`/programs/${p.id}`} className="text-primary underline-offset-2 hover:underline">
                  {p.degreeLevel} · {p.major}
                </Link>
                <StatusBadge status={p.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[p.status]} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Học bổng</CardTitle>
        </CardHeader>
        {scholarshipsLoading ? (
          <LoadingState rows={2} />
        ) : scholarshipsError ? (
          <QueryErrorState error={scholarshipsError} />
        ) : !scholarships || scholarships.data.length === 0 ? (
          <EmptyState title="Chưa có học bổng nào gắn với trường này." />
        ) : (
          <ul className="space-y-2 text-sm">
            {scholarships.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <Link href={`/scholarship-masters/${s.id}`} className="text-primary underline-offset-2 hover:underline">
                  {s.name} — {s.provider}
                </Link>
                <StatusBadge status={s.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[s.status]} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UniversityFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        university={university}
        onSubmit={(input) => updateUniversity.mutateAsync(input as UpdateUniversityInput)}
        submitting={updateUniversity.isPending}
      />
      <ProgramFormDialog
        open={createProgramOpen}
        onClose={() => setCreateProgramOpen(false)}
        fixedUniversityId={id}
        onSubmit={(input) => createProgram.mutateAsync(input as Parameters<typeof createProgram.mutateAsync>[0])}
        submitting={createProgram.isPending}
      />
    </div>
  );
}

export default function UniversityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <UniversityDetailPageInner params={params} />
    </Suspense>
  );
}

function UniversityDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="admission_master" action="view">
      <UniversityDetailContent id={id} />
    </RequirePermission>
  );
}
