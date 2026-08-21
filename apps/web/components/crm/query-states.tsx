import { ApiError } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/// Shared list/detail state components (F03 instruction: "trạng thái rõ ràng cho
/// loading/empty/error/forbidden/not-found"). `ScopeErrorState` renders the exact required
/// copy for a 404 — out-of-scope and nonexistent records are deliberately indistinguishable
/// here (docs/security/RBAC_MATRIX.md §3), never "record exists but you lack permission".

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Đang tải dữ liệu">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/// The exact required copy — never distinguishes "not found" from "forbidden" (F03
/// instruction §21: never "Record tồn tại nhưng bạn không có quyền.").
export function ScopeErrorState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-8 text-center">
      <p className="text-sm font-medium">Không tìm thấy hoặc bạn không có quyền truy cập.</p>
    </div>
  );
}

export function QueryErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
    return <ScopeErrorState />;
  }
  const message = error instanceof ApiError ? error.raw.message : "Đã xảy ra lỗi không xác định.";
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/5 p-8 text-center">
      <p className="text-sm font-medium">Đã xảy ra lỗi khi tải dữ liệu.</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      {requestId ? <p className="text-xs text-muted-foreground">Mã yêu cầu: {requestId}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
