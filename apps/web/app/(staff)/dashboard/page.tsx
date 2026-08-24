"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useExecutiveDashboard, useManagerDashboard, useMyDashboard } from "@/lib/reports/hooks";
import { StatusCountTable } from "@/components/crm/reports/status-count-table";
import {
  CASE_STATUS_LABEL,
  APPLICATION_STATUS_LABEL,
  SCHOLARSHIP_APPLICATION_STATUS_LABEL,
  VISA_STATUS_LABEL,
  ENROLLMENT_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { Money } from "@/components/crm/money";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, QueryErrorState, EmptyState } from "@/components/crm/query-states";
import { cn } from "@/lib/utils/cn";

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

/// EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER see BOTH the Executive and Manager dashboards
/// (`ReportsService.assertRole` allows both roles on both endpoints — there is no ED-only vs
/// DM-only split on the backend), switchable by tab. Every other role with `reports:view`
/// (CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/ADMIN_FINANCE) sees only `/reports/me`.
function DashboardContent() {
  const { roleCode } = usePermissions();
  const isLeadership = roleCode === "EXECUTIVE_DIRECTOR" || roleCode === "DEPARTMENT_MANAGER";
  const [tab, setTab] = useState<"executive" | "manager">("executive");

  const executive = useExecutiveDashboard(isLeadership && tab === "executive");
  const manager = useManagerDashboard(isLeadership && tab === "manager");
  const me = useMyDashboard(!isLeadership);

  if (!isLeadership) {
    if (me.isLoading) return <LoadingState />;
    if (me.error || !me.data) return <QueryErrorState error={me.error} onRetry={() => me.refetch()} />;
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Báo cáo của tôi</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label="Case đang mở của tôi" value={me.data.myOpenCases} />
          <KpiCard label="Nhiệm vụ đang mở của tôi" value={me.data.myOpenTasks} />
          <KpiCard label="Nhiệm vụ quá hạn của tôi" value={me.data.myOverdueTasks} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="flex rounded border border-border text-sm w-fit">
        <button type="button" onClick={() => setTab("executive")} className={cn("px-3 py-1.5", tab === "executive" && "bg-muted font-medium")}>
          Điều hành
        </button>
        <button type="button" onClick={() => setTab("manager")} className={cn("px-3 py-1.5", tab === "manager" && "bg-muted font-medium")}>
          Quản lý
        </button>
      </div>

      {tab === "executive" ? (
        executive.isLoading ? (
          <LoadingState />
        ) : executive.error || !executive.data ? (
          <QueryErrorState error={executive.error} onRetry={() => executive.refetch()} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <KpiCard label="Case đang hoạt động" value={executive.data.activeCases} />
              <KpiCard label="Case đã đóng/lưu trữ" value={executive.data.closedOrArchivedCases} />
              <KpiCard label="Thanh toán quá hạn" value={executive.data.overduePaymentsCount} />
              <KpiCard label="Nhiệm vụ quá hạn" value={executive.data.workload.overdueTasks} />
              <KpiCard label="Nhiệm vụ đang mở" value={executive.data.workload.openTasks} />
              <KpiCard label="Sắp đến hạn (7 ngày)" value={executive.data.deadlines.dueWithin7Days} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Doanh thu &amp; công nợ (theo loại tiền)</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm font-medium">Doanh thu đã thu</p>
                  {executive.data.revenue.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
                  ) : (
                    executive.data.revenue.map((r) => (
                      <p key={r.currency} className="text-sm">
                        <Money value={r.amount} currency={r.currency} />
                      </p>
                    ))
                  )}
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Công nợ còn lại</p>
                  {executive.data.receivables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
                  ) : (
                    executive.data.receivables.map((r) => (
                      <p key={r.currency} className="text-sm">
                        <Money value={r.amount} currency={r.currency} />
                      </p>
                    ))
                  )}
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatusCountTable title="Pipeline case" data={executive.data.pipeline} labelMap={CASE_STATUS_LABEL} />
              <StatusCountTable title="Hồ sơ ứng tuyển" data={executive.data.applications} labelMap={APPLICATION_STATUS_LABEL} />
              <StatusCountTable title="Hồ sơ học bổng" data={executive.data.scholarships} labelMap={SCHOLARSHIP_APPLICATION_STATUS_LABEL} />
              <StatusCountTable title="Visa" data={executive.data.visas} labelMap={VISA_STATUS_LABEL} />
              <StatusCountTable title="Nhập học" data={executive.data.enrollments} labelMap={ENROLLMENT_STATUS_LABEL} />
            </div>
          </div>
        )
      ) : manager.isLoading ? (
        <LoadingState />
      ) : manager.error || !manager.data ? (
        <QueryErrorState error={manager.error} onRetry={() => manager.refetch()} />
      ) : (
        <div className="space-y-4">
          <KpiCard label="Hồ sơ sắp đến hạn nộp" value={manager.data.upcomingApplicationDeadlines} />
          <Card>
            <CardHeader>
              <CardTitle>Khối lượng công việc theo người phụ trách</CardTitle>
            </CardHeader>
            {manager.data.workload.length === 0 ? (
              <EmptyState title="Không có dữ liệu khối lượng công việc." />
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-border text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Người phụ trách (ID)</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Đang mở</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Quá hạn</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Tỷ lệ đúng hạn</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Điểm chất lượng TB</th>
                  </tr>
                </thead>
                <tbody>
                  {manager.data.workload.map((w) => (
                    <tr key={w.ownerId} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{w.ownerId}</td>
                      <td className="px-3 py-2">{w.openTasks}</td>
                      <td className="px-3 py-2">{w.overdueTasks}</td>
                      <td className="px-3 py-2">{w.onTimeCompletionRate !== null ? `${(w.onTimeCompletionRate * 100).toFixed(0)}%` : "—"}</td>
                      <td className="px-3 py-2">{w.averageQualityScore ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequirePermission resource="reports" action="view">
      <DashboardContent />
    </RequirePermission>
  );
}
