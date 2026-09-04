"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import {
  useContract,
  useContractAmendments,
  useUpdateContract,
  useSubmitContract,
  useApproveContract,
  useRejectContract,
  useSendContract,
  useSignContract,
  useUpdateContractStatus,
  useCreateContractAmendment,
} from "@/lib/contracts/hooks";
import { ContractFormDialog } from "@/components/crm/contracts/contract-form-dialog";
import { ContractSignDialog } from "@/components/crm/contracts/contract-sign-dialog";
import { ContractSendDialog } from "@/components/crm/contracts/contract-send-dialog";
import { ContractStatusDialog } from "@/components/crm/contracts/contract-status-dialog";
import { ContractAmendmentDialog } from "@/components/crm/contracts/contract-amendment-dialog";
import { ReasonDialog } from "@/components/crm/reason-dialog";
import { StatusBadge, CONTRACT_STATUS_VARIANT, CONTRACT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UpdateContractInput } from "@/lib/contracts/types";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

const POST_SIGN_STATUSES = new Set(["SIGNED", "ACTIVE", "COMPLETED", "LIQUIDATED"]);

export function ContractDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();

  const { data: contract, isLoading, error, refetch } = useContract(id);
  useBreadcrumbLabel(id, contract?.contractCode);
  const { data: amendments, isLoading: amendmentsLoading, error: amendmentsError } = useContractAmendments(id);

  const updateContract = useUpdateContract(id);
  const submitContract = useSubmitContract(id);
  const approveContract = useApproveContract(id);
  const rejectContract = useRejectContract(id);
  const sendContract = useSendContract(id);
  const signContract = useSignContract(id);
  const updateStatus = useUpdateContractStatus(id);
  const createAmendment = useCreateContractAmendment(id);

  const [editOpen, setEditOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !contract) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canEdit = contract.status === "DRAFT" && can("contracts", "edit");
  const canSubmit = contract.status === "DRAFT" && can("contracts", "edit");
  const canApproveReject = contract.status === "REVIEW" && can("contracts", "approve");
  const canSend = contract.status === "APPROVED" && can("contracts", "send");
  const canSign = contract.status === "SENT" && can("contracts", "sign");
  const canChangeStatus = POST_SIGN_STATUSES.has(contract.status) && can("contracts", "edit");
  const canAmend = !!contract.signedAt && can("contracts", "amend");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{contract.contractCode}</h1>
          <p className="text-sm text-muted-foreground">
            Học sinh:{" "}
            <Link href={`/students/${contract.studentId}`} className="text-primary hover:underline">
              {contract.student.fullName}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={contract.status} variantMap={CONTRACT_STATUS_VARIANT} label={CONTRACT_STATUS_LABEL[contract.status]} />
          {canEdit ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {canSubmit ? (
            <Button
              variant="secondary"
              onClick={() => submitContract.mutateAsync()}
              disabled={submitContract.isPending}
            >
              {submitContract.isPending ? "Đang gửi duyệt..." : "Gửi duyệt"}
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
          {canSend ? (
            <Button variant="secondary" onClick={() => setSendOpen(true)}>
              Gửi khách hàng
            </Button>
          ) : null}
          {canSign ? (
            <Button variant="danger" onClick={() => setSignOpen(true)}>
              Ký hợp đồng
            </Button>
          ) : null}
          {canChangeStatus ? (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Chuyển trạng thái
            </Button>
          ) : null}
          {["ACTIVE", "COMPLETED", "LIQUIDATED"].includes(contract.status) && can("contracts", "edit") ? (
            <Link href={`/contracts/${contract.id}/closure`}>
              <Button variant="secondary">Hoàn tất / Thanh lý</Button>
            </Link>
          ) : null}
          {canAmend ? (
            <Button variant="secondary" onClick={() => setAmendOpen(true)}>
              + Amendment
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hợp đồng</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Gói dịch vụ</dt>
              <dd>{contract.servicePackage ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Giá trị</dt>
              <dd>
                <Money value={contract.value} currency={contract.currency} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phiên bản</dt>
              <dd>{contract.version}</dd>
            </div>
            {contract.approvalThreshold ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ngưỡng duyệt</dt>
                <dd>
                  <Money value={contract.approvalThreshold} currency={contract.currency} />
                </dd>
              </div>
            ) : null}
            {contract.signedAt ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ngày ký</dt>
                <dd>{new Date(contract.signedAt).toLocaleDateString("vi-VN")}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thanh toán</CardTitle>
            {can("payments", "view") ? (
              <Link href={`/contracts/${contract.id}/payments`} className="text-sm text-primary hover:underline">
                Xem lịch thanh toán →
              </Link>
            ) : null}
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            {contract.signedAt ? "Xem/quản lý các kỳ thanh toán của hợp đồng này." : "Hợp đồng chưa ký — chưa thể tạo kỳ thanh toán."}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử Amendment</CardTitle>
        </CardHeader>
        {amendmentsLoading ? (
          <LoadingState rows={2} />
        ) : amendmentsError ? (
          <QueryErrorState error={amendmentsError} />
        ) : !amendments || amendments.length === 0 ? (
          <EmptyState title="Chưa có amendment nào." description="Hợp đồng chưa từng được điều chỉnh sau khi ký." />
        ) : (
          <ul className="space-y-3 text-sm">
            {amendments.map((a) => (
              <li key={a.id} className="border-b border-border pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.amendmentCode}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("vi-VN")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Phiên bản {a.previousVersion} → {a.newVersion} · Hiệu lực từ {new Date(a.effectiveDate).toLocaleDateString("vi-VN")}
                </p>
                <p className="mt-1">{a.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ContractFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        contract={contract}
        onSubmit={(input) => updateContract.mutateAsync(input as UpdateContractInput)}
        submitting={updateContract.isPending}
      />
      <ReasonDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Duyệt hợp đồng"
        successMessage="Đã duyệt hợp đồng."
        reasonLabel="Ghi chú"
        onSubmit={(reason) => approveContract.mutateAsync(reason || undefined)}
        submitting={approveContract.isPending}
      />
      <ReasonDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối hợp đồng"
        successMessage="Đã từ chối hợp đồng — chuyển về nháp."
        reasonLabel="Lý do từ chối"
        reasonRequired
        variant="danger"
        onSubmit={(reason) => rejectContract.mutateAsync(reason)}
        submitting={rejectContract.isPending}
      />
      <ContractSendDialog open={sendOpen} onClose={() => setSendOpen(false)} onSubmit={() => sendContract.mutateAsync()} submitting={sendContract.isPending} />
      <ContractSignDialog open={signOpen} onClose={() => setSignOpen(false)} onSubmit={(docId) => signContract.mutateAsync(docId)} submitting={signContract.isPending} />
      <ContractStatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={contract.status}
        onSubmit={(status, reason) => updateStatus.mutateAsync({ status, reason })}
        submitting={updateStatus.isPending}
      />
      <ContractAmendmentDialog
        open={amendOpen}
        onClose={() => setAmendOpen(false)}
        onSubmit={(input) => createAmendment.mutateAsync(input)}
        submitting={createAmendment.isPending}
      />
    </div>
  );
}

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ContractDetailPageInner params={params} />
    </Suspense>
  );
}

function ContractDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="contracts" action="view">
      <ContractDetailContent id={id} />
    </RequirePermission>
  );
}
