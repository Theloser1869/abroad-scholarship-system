import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { StatusCount } from "@/lib/reports/types";

/// Renders a backend `{status,count}[]` breakdown as-is — never re-aggregated or recomputed
/// client-side (F07 instruction §30). `labelMap` reuses each domain's own existing
/// `*_STATUS_LABEL` map from `components/crm/status-badge.tsx` so labels stay consistent with
/// every other page that shows the same enum, instead of a new label set invented for reports.
export function StatusCountTable({ title, data, labelMap }: { title: string; data: StatusCount[]; labelMap?: Record<string, string> }) {
  if (data.length === 0) {
    return (
      <div>
        <p className="mb-1 text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
      </div>
    );
  }
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div>
      <p className="mb-1 text-sm font-medium">
        {title} <span className="text-muted-foreground">({total})</span>
      </p>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Trạng thái</TableHeaderCell>
            <TableHeaderCell>Số lượng</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.status}>
              <TableCell>{labelMap?.[row.status] ?? row.status}</TableCell>
              <TableCell>{row.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
