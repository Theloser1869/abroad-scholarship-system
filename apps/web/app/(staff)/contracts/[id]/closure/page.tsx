"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useContract, useUpdateContractStatus } from "@/lib/contracts/hooks";
import { usePaymentsForContract } from "@/lib/payments/hooks";
import { StatusBadge, CONTRACT_STATUS_VARIANT, CONTRACT_STATUS_LABEL, PAYMENT_STATUS_VARIANT, PAYMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { ContractStatus } from "@/lib/contracts/types";
import type { Payment } from "@/lib/payments/types";

const UNRESOLVED_STATUSES = new Set(["PENDING", "PARTIALLY_PAID", "OVERDUE"]);

/// Client Acceptance Remediation GAP-007 (HIGH, REQ-CASE-014) — 11_Quan_ly_hop_dong row9/10
/// describe a dedicated "Hoàn tất → Thanh lý → Lưu trữ" workflow (closure checklist, debt
/// check, liquidation record with reason, archive), which previously had no frontend
/// surface at all — only a generic status-change dialog. This page is deliberately
/// Contract/Payment-scoped only: ADMIN_FINANCE (the role that actually performs this
/// workflow per the SRS role table) holds no `cases:view` permission at all, so a Case-level
/// precondition summary (open tasks/visa/enrollment/pre-departure — Case.close()'s domain,
/// a Consultant/Manager/Director concern) would be inaccessible to the role using this page
/// and is deliberately not attempted here.
function ContractClosureContent({ contractId }: { contractId: string }) {
  const { can } = usePermissions();
  const { data: contract, isLoading, error, refetch } = useContract(contractId);
  const { data: payments, isLoading: paymentsLoading } = usePaymentsForContract(contractId, { limit: 100 });
  const updateStatus = useUpdateContractStatus(contractId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (isLoading) return <LoadingState />;
  if (error || !contract) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canEdit = can("contracts", "edit");
  const unresolved: Payment[] = (payments?.data ?? []).filter((p) => UNRESOLVED_STATUSES.has(p.status));
  const hasUnresolvedDebt = unresolved.length > 0;

  async function transition(status: ContractStatus, reasonText?: string) {
    setActionError(null);
    try {
      await updateStatus.mutateAsync({ status, reason: reasonText });
      setReason("");
    } catch (err) {
      setActionError(crmErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/contracts/${contractId}`} className="text-sm text-primary hover:underline">
          ← {contract.contractCode}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Hoàn tất / Thanh lý hợp đồng</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tổng quan hợp đồng</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Trạng thái</dt>
            <dd>
              <StatusBadge status={contract.status} variantMap={CONTRACT_STATUS_VARIANT} label={CONTRACT_STATUS_LABEL[contract.status]} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Giá trị hợp đồng</dt>
            <dd>{contract.value ? <Money value={contract.value} currency={contract.currency} /> : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ngày kích hoạt</dt>
            <dd>{contract.activatedAt ? new Date(contract.activatedAt).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ngày hoàn tất</dt>
            <dd>{contract.completedAt ? new Date(contract.completedAt).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ngày thanh lý</dt>
            <dd>{contract.liquidatedAt ? new Date(contract.liquidatedAt).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ngày lưu trữ</dt>
            <dd>{contract.archivedAt ? new Date(contract.archivedAt).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          {contract.closureReason ? (
            <div className="pt-2">
              <dt className="text-muted-foreground">Biên bản thanh lý</dt>
              <dd className="mt-1 whitespace-pre-wrap">{contract.closureReason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Công nợ</CardTitle>
        </CardHeader>
        {paymentsLoading ? (
          <LoadingState />
        ) : (payments?.data.length ?? 0) === 0 ? (
          <EmptyState title="Chưa có kỳ thanh toán nào cho hợp đồng này." />
        ) : hasUnresolvedDebt ? (
          <div className="space-y-2">
            <p className="text-sm text-danger">
              Còn {unresolved.length} khoản thanh toán chưa xử lý (chờ, một phần, hoặc quá hạn) — cần thanh toán hoặc miễn trừ trước khi hoàn tất hợp đồng.
            </p>
            <ul className="space-y-1 text-sm">
              {unresolved.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded border border-border p-2">
                  <span>
                    Kỳ {p.installmentNo} · <Money value={p.outstandingAmount} currency={p.currency} /> còn lại
                  </span>
                  <StatusBadge status={p.status} variantMap={PAYMENT_STATUS_VARIANT} label={PAYMENT_STATUS_LABEL[p.status]} />
                </li>
              ))}
            </ul>
            <Link href={`/contracts/${contractId}/payments`} className="text-sm text-primary hover:underline">
              Đi tới lịch thanh toán →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-success">Không còn công nợ — tất cả khoản thanh toán đã được xử lý (đã thu, hoàn tiền, hoặc miễn trừ).</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thao tác</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {contract.status === "ACTIVE" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Hoàn tất hợp đồng yêu cầu không còn công nợ chưa xử lý.</p>
              <Button onClick={() => transition("COMPLETED")} disabled={!canEdit || updateStatus.isPending}>
                {updateStatus.isPending ? "Đang xử lý..." : "Hoàn tất hợp đồng"}
              </Button>
            </div>
          ) : null}

          {contract.status === "COMPLETED" ? (
            <div className="space-y-2">
              <label htmlFor="liquidation-reason" className="block text-sm font-medium">
                Biên bản thanh lý / Xác nhận hai bên *
              </label>
              <Textarea id="liquidation-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} minLength={3} placeholder="Đã bàn giao đầy đủ tài liệu, xác nhận hoàn tất dịch vụ với gia đình..." />
              <Button
                variant="danger"
                onClick={() => transition("LIQUIDATED", reason.trim())}
                disabled={!canEdit || updateStatus.isPending || reason.trim().length < 3}
              >
                {updateStatus.isPending ? "Đang thanh lý..." : "Xác nhận thanh lý"}
              </Button>
            </div>
          ) : null}

          {contract.status === "LIQUIDATED" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Lưu trữ sẽ khóa hợp đồng này khỏi mọi chỉnh sửa thêm.</p>
              <Button onClick={() => transition("ARCHIVED")} disabled={!canEdit || updateStatus.isPending}>
                {updateStatus.isPending ? "Đang lưu trữ..." : "Lưu trữ hợp đồng"}
              </Button>
            </div>
          ) : null}

          {contract.status === "ARCHIVED" ? <p className="text-sm text-muted-foreground">Hợp đồng đã được lưu trữ — không còn thao tác nào khả dụng.</p> : null}

          {!["ACTIVE", "COMPLETED", "LIQUIDATED", "ARCHIVED"].includes(contract.status) ? (
            <p className="text-sm text-muted-foreground">Hợp đồng cần được kích hoạt (ACTIVE) trước khi có thể hoàn tất/thanh lý.</p>
          ) : null}

          {actionError ? (
            <p role="alert" className="text-sm text-danger">
              {actionError}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export default function ContractClosurePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ContractClosurePageInner params={params} />
    </Suspense>
  );
}

function ContractClosurePageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="contracts" action="edit">
      <ContractClosureContent contractId={id} />
    </RequirePermission>
  );
}
