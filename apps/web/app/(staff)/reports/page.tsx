"use client";

import { useId, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { useExportCases } from "@/lib/reports/hooks";
import type { ExportCasesResponse } from "@/lib/reports/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import { crmErrorMessage } from "@/lib/api/error-messages";

const EXPORT_COLUMNS: { key: keyof ExportCasesResponse["rows"][number]; label: string }[] = [
  { key: "caseCode", label: "Mã case" },
  { key: "department", label: "Phòng ban" },
  { key: "stage", label: "Giai đoạn" },
  { key: "status", label: "Trạng thái" },
  { key: "openedAt", label: "Ngày mở" },
  { key: "closedAt", label: "Ngày đóng" },
];

function toCsv(rows: ExportCasesResponse["rows"]): string {
  const keys = Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [keys.join(","), ...rows.map((row) => keys.map((k) => escape((row as unknown as Record<string, unknown>)[k])).join(","))];
  return lines.join("\n");
}

/// `reports:export`-gated (ED/DM only, matching `ReportsService.exportCases`'s own
/// `assertRole`). Synchronous — no job/progress/status polling exists on the backend
/// (F07 instruction §29 only applies "if async"; this export is not). The CSV file offered
/// here is built from the SAME authorized, reason-logged, scope-filtered JSON the backend
/// just returned for this one request — never a separately/unaudited full-data dump
/// (F07 instruction §27: "Do not: generate CSV from all data in browser").
function ReportsExport() {
  const exportCases = useExportCases();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) return;
    setError(null);
    try {
      await exportCases.mutateAsync(reason.trim());
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  function handleDownload() {
    if (!exportCases.data || exportCases.data.rows.length === 0) return;
    const csv = toCsv(exportCases.data.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cases-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Xuất báo cáo</h1>
      <Card>
        <CardHeader>
          <CardTitle>Xuất danh sách case</CardTitle>
        </CardHeader>
        <form onSubmit={handleExport} className="space-y-3">
          <div>
            <label htmlFor={reasonId} className="mb-1 block text-sm font-medium">
              Lý do xuất báo cáo *
            </label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              minLength={3}
              maxLength={500}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">Bắt buộc — được ghi vào audit log cùng với người thực hiện.</p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={exportCases.isPending || reason.trim().length < 3}>
            {exportCases.isPending ? "Đang xuất..." : "Xuất danh sách case"}
          </Button>
        </form>
      </Card>

      {exportCases.isPending ? <LoadingState /> : null}

      {exportCases.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả ({exportCases.data.rowCount} case)</CardTitle>
            {exportCases.data.rows.length > 0 ? (
              <Button variant="secondary" onClick={handleDownload}>
                Tải xuống CSV
              </Button>
            ) : null}
          </CardHeader>
          {exportCases.data.rows.length === 0 ? (
            <EmptyState title="Không có case nào trong phạm vi của bạn." />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  {EXPORT_COLUMNS.map((c) => (
                    <TableHeaderCell key={c.key}>{c.label}</TableHeaderCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {exportCases.data.rows.map((row) => (
                  <TableRow key={row.id}>
                    {EXPORT_COLUMNS.map((c) => (
                      <TableCell key={c.key}>{row[c.key] ?? "—"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequirePermission resource="reports" action="export">
      <ReportsExport />
    </RequirePermission>
  );
}
