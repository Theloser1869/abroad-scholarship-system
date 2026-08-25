import { ConflictException } from '@nestjs/common';

/// Hard ceiling on any single export response (09_Account_Security "Export Control: Hạn
/// chế export hàng loạt" — Bắt buộc, and 07_Audit_Log row6 "Không cho export hàng loạt").
/// The customer sheet requires bulk export to be RESTRICTED but names no specific number —
/// this value is an explicit, documented engineering decision, not an implied requirement.
/// See docs/ASSUMPTIONS.md ASM-70.
///
/// Every export query must fetch `EXPORT_ROW_CAP + 1` rows (never the full unbounded set)
/// so the cap is enforced at the database-query level, not by truncating an
/// already-fully-fetched result — see `enforceExportRowCap` below.
export const EXPORT_ROW_CAP = 5000;

export class ExportRowLimitExceededException extends ConflictException {
  constructor(scopeDescription: string) {
    super({
      code: 'EXPORT_ROW_LIMIT_EXCEEDED',
      message: `This export would return more than ${EXPORT_ROW_CAP} rows (${scopeDescription}). Narrow your filters and try again.`,
    });
  }
}

/// Call with the result of a `findMany({ ..., take: EXPORT_ROW_CAP + 1 })` query. Returns
/// the rows unchanged when within the cap; throws (409, `EXPORT_ROW_LIMIT_EXCEEDED`) when
/// the cap was exceeded — never silently truncates, since a silently truncated export would
/// misreport `rowCount` in the audit log as if the export were complete (SRS 6.21 "row
/// count... phải chính xác").
export function enforceExportRowCap<T>(rows: T[], scopeDescription: string): T[] {
  if (rows.length > EXPORT_ROW_CAP) {
    throw new ExportRowLimitExceededException(scopeDescription);
  }
  return rows;
}
