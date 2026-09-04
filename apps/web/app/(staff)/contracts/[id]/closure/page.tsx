"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useContract } from "@/lib/contracts/hooks";
import { usePaymentsForContract } from "@/lib/payments/hooks";
import { StatusBadge, CONTRACT_STATUS_VARIANT, CONTRACT_STATUS_LABEL, PAYMENT_STATUS_VARIANT, PAYMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Payment } from "@/lib/payments/types";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

const UNRESOLVED_STATUSES = new Set(["PENDING", "PARTIALLY_PAID", "OVERDUE"]);

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014, 2026-08-26) — Hoàn
/// tất/Đóng hồ sơ/Thanh lý moved to the unified Closure workflow (`/cases/:id/closure`,
/// `lib/closure/*`) once a Case is linked (always true post-SIGNED). This page is now
/// read-only Contract/Payment status + a link onward — the direct COMPLETED/LIQUIDATED
/// buttons that used to live here are gone (the backend now rejects them with
/// `USE_UNIFIED_CLOSURE_WORKFLOW`). `caseId` is an ID-only pointer (never full Case data —
/// ADMIN_FINANCE still holds no `cases:view` grant), used only to build the link.
function ContractClosureContent({ contractId }: { contractId: string }) {
  const { can } = usePermissions();
  const { data: contract, isLoading, error, refetch } = useContract(contractId);
  useBreadcrumbLabel(contractId, contract?.contractCode);
  const { data: payments, isLoading: paymentsLoading } = usePaymentsForContract(contractId, { limit: 100 });

  if (isLoading) return <LoadingState />;
  if (error || !contract) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canViewClosure = can("case-closure", "view") || can("case-closure", "execute");
  const unresolved: Payment[] = (payments?.data ?? []).filter((p) => UNRESOLVED_STATUSES.has(p.status));
  const hasUnresolvedDebt = unresolved.length > 0;

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
          <CardTitle>Hoàn tất / Đóng hồ sơ / Thanh lý</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {contract.status === "ACTIVE" || contract.status === "COMPLETED" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Hoàn tất và Thanh lý hợp đồng giờ được thực hiện qua luồng <strong>Đóng hồ sơ hợp nhất</strong> của case liên kết (HCTH thực hiện,
                kiểm tra đầy đủ 6 điều kiện bắt buộc — công nợ, công việc còn mở, visa, nhập học, checklist trước khi bay, bàn giao tài liệu).
              </p>
              {contract.caseId && canViewClosure ? (
                <Link href={`/cases/${contract.caseId}/closure`}>
                  <Button>Đi tới Đóng hồ sơ →</Button>
                </Link>
              ) : contract.caseId ? (
                <p className="text-xs text-muted-foreground">Bạn không có quyền truy cập luồng Đóng hồ sơ.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Hợp đồng này chưa liên kết case.</p>
              )}
            </>
          ) : null}

          {contract.status === "LIQUIDATED" && contract.caseId && canViewClosure ? (
            <Link href={`/cases/${contract.caseId}/closure`} className="text-sm text-primary hover:underline">
              Xem chi tiết xác nhận thanh lý (hai bên) →
            </Link>
          ) : null}

          {contract.status === "ARCHIVED" ? <p className="text-sm text-muted-foreground">Hợp đồng đã được lưu trữ — không còn thao tác nào khả dụng.</p> : null}

          {!["ACTIVE", "COMPLETED", "LIQUIDATED", "ARCHIVED"].includes(contract.status) ? (
            <p className="text-sm text-muted-foreground">Hợp đồng cần được kích hoạt (ACTIVE) trước khi có thể hoàn tất/thanh lý.</p>
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
