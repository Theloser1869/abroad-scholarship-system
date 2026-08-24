import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/// Presentational primitives only — no built-in pagination/sorting/fetch logic. Every list
/// page (F03+) drives this from server-side pagination per docs/api/API_CONVENTIONS.md §4
/// (`{ data, meta }`), never a client-side slice of an unbounded array (master context:
/// "pagination/filter server-side khi backend hỗ trợ").

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-border text-left", className)} {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border last:border-0", className)} {...props} />;
}

export function TableHeaderCell({ className, scope = "col", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  // F09 accessibility hardening (instruction §22 "table headers") — every `<th>` in this app
  // is a column header (no row-header usage exists anywhere), so `scope="col"` is a correct
  // default everywhere; still overridable via the `scope` prop for the rare future case that
  // needs one.
  return <th scope={scope} className={cn("px-3 py-2 font-medium text-muted-foreground", className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2", className)} {...props} />;
}
