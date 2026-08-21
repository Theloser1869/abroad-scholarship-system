import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/// Loading placeholder — used inside route-level `loading.tsx` files and any component
/// awaiting server data, so a slow response shows a shaped placeholder instead of a blank
/// area or a layout jump.
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} {...props} />;
}
