import type { PaginationMeta } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

/// Drives F02's `{ data, meta }` server-side pagination contract — never a client-side slice
/// of a fully-fetched array (F03 instruction: "list phải dùng backend pagination").
export function PaginationControls({ meta, onPageChange }: { meta: PaginationMeta; onPageChange: (page: number) => void }) {
  if (meta.totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
      <p>
        Trang {meta.page}/{meta.totalPages} — {meta.totalItems} kết quả
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Trước
        </Button>
        <Button
          variant="secondary"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}
