"use client";

import { Suspense, use, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useScholarshipMaster, useUpdateScholarshipMaster, useVerifyScholarshipMaster } from "@/lib/scholarship-masters/hooks";
import { ScholarshipMasterFormDialog } from "@/components/crm/scholarship-masters/scholarship-master-form-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { UpdateScholarshipMasterInput } from "@/lib/scholarship-masters/types";

export function ScholarshipMasterDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: scholarship, isLoading, error, refetch } = useScholarshipMaster(id);

  const updateScholarshipMaster = useUpdateScholarshipMaster(id);
  const verifyScholarshipMaster = useVerifyScholarshipMaster(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !scholarship) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  async function handleVerify() {
    try {
      await verifyScholarshipMaster.mutateAsync();
      toast({ title: "Đã xác minh học bổng.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{scholarship.name}</h1>
          <p className="text-sm text-muted-foreground">
            {scholarship.scholarshipCode} · {scholarship.provider}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={scholarship.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[scholarship.status]} />
          {can("admission_master", "edit") ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {can("admission_master", "verify") ? (
            <Button variant="secondary" onClick={handleVerify} disabled={verifyScholarshipMaster.isPending}>
              {verifyScholarshipMaster.isPending ? "Đang xác minh..." : "Xác minh"}
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
            <dt className="text-muted-foreground">Loại chi trả</dt>
            <dd>{scholarship.coverageType ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Giá trị</dt>
            <dd>{scholarship.amount ? <Money value={scholarship.amount} currency={scholarship.amountCurrency} /> : scholarship.percentage ? `${scholarship.percentage}%` : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Hạn nộp</dt>
            <dd>{scholarship.deadline ? new Date(scholarship.deadline).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Xác minh lần cuối</dt>
            <dd>{scholarship.lastVerifiedAt ? new Date(scholarship.lastVerifiedAt).toLocaleString("vi-VN") : "Chưa xác minh"}</dd>
          </div>
        </dl>
        {scholarship.eligibility ? (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="font-medium">Điều kiện đủ tư cách</p>
            <p className="text-muted-foreground">{scholarship.eligibility}</p>
          </div>
        ) : null}
        {scholarship.requiredDocuments ? (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="font-medium">Hồ sơ yêu cầu</p>
            <p className="text-muted-foreground">{scholarship.requiredDocuments}</p>
          </div>
        ) : null}
        {scholarship.conditions ? (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="font-medium">Điều kiện đi kèm</p>
            <p className="text-muted-foreground">{scholarship.conditions}</p>
          </div>
        ) : null}
      </Card>

      <ScholarshipMasterFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        scholarshipMaster={scholarship}
        onSubmit={(input) => updateScholarshipMaster.mutateAsync(input as UpdateScholarshipMasterInput)}
        submitting={updateScholarshipMaster.isPending}
      />
    </div>
  );
}

export default function ScholarshipMasterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ScholarshipMasterDetailPageInner params={params} />
    </Suspense>
  );
}

function ScholarshipMasterDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="admission_master" action="view">
      <ScholarshipMasterDetailContent id={id} />
    </RequirePermission>
  );
}
