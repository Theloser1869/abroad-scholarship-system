"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useProgram, useUpdateProgram, useVerifyProgram } from "@/lib/programs/hooks";
import { useScholarshipMasters } from "@/lib/scholarship-masters/hooks";
import { ProgramFormDialog } from "@/components/crm/programs/program-form-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { UpdateProgramInput } from "@/lib/programs/types";

export function ProgramDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: program, isLoading, error, refetch } = useProgram(id);
  const { data: scholarships, isLoading: scholarshipsLoading, error: scholarshipsError } = useScholarshipMasters({ programId: id, limit: 50 });

  const updateProgram = useUpdateProgram(id);
  const verifyProgram = useVerifyProgram(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !program) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  async function handleVerify() {
    try {
      await verifyProgram.mutateAsync();
      toast({ title: "Đã xác minh chương trình.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {program.degreeLevel} · {program.major}
          </h1>
          <p className="text-sm text-muted-foreground">
            {program.programCode} ·{" "}
            <Link href={`/universities/${program.university.id}`} className="text-primary hover:underline">
              {program.university.officialName}
            </Link>{" "}
            ({program.university.countryCode})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={program.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[program.status]} />
          {can("admission_master", "edit") ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {can("admission_master", "verify") ? (
            <Button variant="secondary" onClick={handleVerify} disabled={verifyProgram.isPending}>
              {verifyProgram.isPending ? "Đang xác minh..." : "Xác minh"}
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
            <dt className="text-muted-foreground">Đợt tuyển sinh</dt>
            <dd>{program.intake ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Thời lượng</dt>
            <dd>{program.durationMonths ? `${program.durationMonths} tháng` : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Học phí</dt>
            <dd>
              <Money value={program.tuition} currency={program.tuitionCurrency} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Lệ phí ứng tuyển</dt>
            <dd>
              <Money value={program.applicationFee} currency={program.tuitionCurrency} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Xác minh lần cuối</dt>
            <dd>{program.lastVerifiedAt ? new Date(program.lastVerifiedAt).toLocaleString("vi-VN") : "Chưa xác minh"}</dd>
          </div>
        </dl>
        {program.eligibility ? (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="font-medium">Điều kiện đủ tư cách</p>
            <p className="text-muted-foreground">{program.eligibility}</p>
          </div>
        ) : null}
        {program.requirements ? (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="font-medium">Yêu cầu hồ sơ</p>
            <p className="text-muted-foreground">{program.requirements}</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Học bổng gắn với chương trình</CardTitle>
        </CardHeader>
        {scholarshipsLoading ? (
          <LoadingState rows={2} />
        ) : scholarshipsError ? (
          <QueryErrorState error={scholarshipsError} />
        ) : !scholarships || scholarships.data.length === 0 ? (
          <EmptyState title="Chưa có học bổng nào gắn với chương trình này." />
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

      <ProgramFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        program={program}
        onSubmit={(input) => updateProgram.mutateAsync(input as UpdateProgramInput)}
        submitting={updateProgram.isPending}
      />
    </div>
  );
}

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProgramDetailPageInner params={params} />
    </Suspense>
  );
}

function ProgramDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="admission_master" action="view">
      <ProgramDetailContent id={id} />
    </RequirePermission>
  );
}
