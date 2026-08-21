import type { TimelineEntry } from "@/lib/timeline/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, QueryErrorState } from "./query-states";

/// Renders the backend's already-merged Timeline verbatim (`TimelineService.forEntity()`) —
/// never re-merges AuditLog + Comment client-side (F03 instruction §17). Distinguishes
/// AUDIT (further split into status-transition vs. other actions) from NOTE, and
/// internal vs. shared visibility on notes.
function entryKind(entry: TimelineEntry): { label: string; variant: "info" | "warning" | "neutral" | "success" } {
  if (entry.type === "NOTE") {
    return entry.visibility === "shared" ? { label: "Ghi chú (chia sẻ)", variant: "success" } : { label: "Ghi chú (nội bộ)", variant: "neutral" };
  }
  if (entry.action === "EDIT" || entry.action?.includes("STATUS")) {
    return { label: "Chuyển trạng thái", variant: "warning" };
  }
  return { label: entry.action ?? "Sự kiện hệ thống", variant: "info" };
}

export function TimelineView({
  entries,
  isLoading,
  error,
  onRetry,
}: {
  entries: TimelineEntry[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
}) {
  if (isLoading) return <LoadingState rows={4} />;
  if (error) return <QueryErrorState error={error} onRetry={onRetry} />;
  if (!entries || entries.length === 0) {
    return <EmptyState title="Chưa có hoạt động nào." />;
  }

  const sorted = [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <ol className="space-y-3">
      {sorted.map((entry, i) => {
        const kind = entryKind(entry);
        return (
          <li key={i} className="flex gap-3 border-l-2 border-border pl-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={kind.variant}>{kind.label}</Badge>
                <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString("vi-VN")}
                </time>
              </div>
              {entry.body ? <p className="mt-1 text-sm">{entry.body}</p> : null}
              {entry.type === "AUDIT" && entry.result ? (
                <p className="mt-1 text-xs text-muted-foreground">Kết quả: {entry.result}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
