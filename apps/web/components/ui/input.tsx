import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/// F09 accessibility hardening — WCAG 2.4.7 (Focus Visible). The old style
/// (`outline-none focus:border-primary`) removed the browser's default focus outline and
/// replaced it with only a 1px border-color change, which is too subtle a difference to
/// reliably read as "focused" (especially for low-vision users) — this adds a real focus
/// ring back. Exported so `Textarea` (and any future form control) shares the exact same
/// focus treatment rather than each re-deriving its own.
export const FORM_CONTROL_CLASSES =
  "w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FORM_CONTROL_CLASSES, className)} {...props} />;
}
