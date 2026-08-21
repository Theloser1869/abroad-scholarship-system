/// Mirrors `TimelineEntry` (`apps/api/src/modules/reporting/timeline/timeline.service.ts`)
/// exactly — a read-only merge of AuditLog + Comment rows, never re-merged client-side (F03
/// instruction §17: "Không tự merge AuditLog + Comment ở frontend nếu backend đã trả
/// timeline").
export interface TimelineEntry {
  type: "AUDIT" | "NOTE";
  action?: string;
  result?: string;
  body?: string;
  visibility?: string;
  actorId: string | null;
  createdAt: string;
}
