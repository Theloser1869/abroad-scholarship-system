"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { useAuditLogs } from "@/lib/audit-logs/hooks";
import type { AuditLog, AuditLogListParams } from "@/lib/audit-logs/types";
import { StatusBadge, AUDIT_RESULT_VARIANT, AUDIT_RESULT_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

interface Filters {
  actorId: string;
  studentId: string;
  caseId: string;
  action: string;
  objectType: string;
  result: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = { actorId: "", studentId: "", caseId: "", action: "", objectType: "", result: "", dateFrom: "", dateTo: "" };

/// `metadata`/`beforeSnapshot`/`afterSnapshot` are freeform JSON (03-security/03_AUDIT.md
/// "Ghi chú") — rendered as compact text, never re-interpreted/formatted per-action (this
/// page has no knowledge of what any given action's metadata shape means).
function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function AuditLogsListContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedFilters = useDebouncedValue(filters);

  const params: AuditLogListParams = {
    page,
    limit: 20,
    // No explicit `sort` — the backend's own default (`createdAt:desc`, newest first) is
    // exactly what this page wants; omitting it avoids hardcoding the `field:direction`
    // string format here.
    ...(debouncedFilters.actorId ? { actorId: debouncedFilters.actorId } : {}),
    ...(debouncedFilters.studentId ? { studentId: debouncedFilters.studentId } : {}),
    ...(debouncedFilters.caseId ? { caseId: debouncedFilters.caseId } : {}),
    ...(debouncedFilters.action ? { action: debouncedFilters.action } : {}),
    ...(debouncedFilters.objectType ? { objectType: debouncedFilters.objectType } : {}),
    ...(debouncedFilters.result ? { result: debouncedFilters.result } : {}),
    ...(debouncedFilters.dateFrom ? { dateFrom: debouncedFilters.dateFrom } : {}),
    ...(debouncedFilters.dateTo ? { dateTo: debouncedFilters.dateTo } : {}),
  };

  const { data, isLoading, error, refetch } = useAuditLogs(params);

  function updateFilter<K extends keyof Filters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-40">
          <Input placeholder="User ID" value={filters.actorId} onChange={(e) => updateFilter("actorId", e.target.value)} aria-label="Lọc theo User ID" />
        </div>
        <div className="w-40">
          <Input placeholder="Student ID" value={filters.studentId} onChange={(e) => updateFilter("studentId", e.target.value)} aria-label="Lọc theo Student ID" />
        </div>
        <div className="w-40">
          <Input placeholder="Case ID" value={filters.caseId} onChange={(e) => updateFilter("caseId", e.target.value)} aria-label="Lọc theo Case ID" />
        </div>
        <div className="w-36">
          <Input placeholder="Hành động" value={filters.action} onChange={(e) => updateFilter("action", e.target.value)} aria-label="Lọc theo hành động" />
        </div>
        <div className="w-40">
          <Input placeholder="Đối tượng" value={filters.objectType} onChange={(e) => updateFilter("objectType", e.target.value)} aria-label="Lọc theo loại đối tượng" />
        </div>
        <div className="w-36">
          <Input placeholder="Kết quả (SUCCESS/DENIED/ERROR)" value={filters.result} onChange={(e) => updateFilter("result", e.target.value)} aria-label="Lọc theo kết quả" />
        </div>
        <div className="w-40">
          <Input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} aria-label="Từ ngày" />
        </div>
        <div className="w-40">
          <Input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} aria-label="Đến ngày" />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có bản ghi audit log nào." description="Thử điều chỉnh bộ lọc." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Thời gian</TableHeaderCell>
                <TableHeaderCell>User ID</TableHeaderCell>
                <TableHeaderCell>Student ID</TableHeaderCell>
                <TableHeaderCell>Hành động</TableHeaderCell>
                <TableHeaderCell>Đối tượng</TableHeaderCell>
                <TableHeaderCell>Kết quả</TableHeaderCell>
                <TableHeaderCell>IP/Thiết bị</TableHeaderCell>
                <TableHeaderCell>Ghi chú</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((log: AuditLog) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createdAt).toLocaleString("vi-VN")}</TableCell>
                  <TableCell>{log.actorId ?? "—"}</TableCell>
                  <TableCell>{log.studentId ?? "—"}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>
                    {log.objectType}
                    {log.objectId ? ` #${log.objectId}` : ""}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log.result} variantMap={AUDIT_RESULT_VARIANT} label={AUDIT_RESULT_LABEL[log.result]} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate" title={[log.ipAddress, log.userAgent].filter(Boolean).join(" — ") || undefined}>
                    {[log.ipAddress, log.userAgent].filter(Boolean).join(" — ") || "—"}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate" title={formatJson(log.metadata)}>
                    {formatJson(log.metadata)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <RequirePermission resource="audit_logs" action="view">
      <AuditLogsListContent />
    </RequirePermission>
  );
}
