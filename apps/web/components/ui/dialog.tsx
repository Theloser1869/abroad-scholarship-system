"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** "modal" centers the dialog; "drawer" slides in from the right, full-height. */
  variant?: "modal" | "drawer";
}

/// Built on the native `<dialog>` element rather than a hand-rolled focus trap — the
/// platform already gives correct modal semantics for free: `showModal()` traps focus and
/// makes background content inert, Escape closes it, and the `::backdrop` pseudo-element
/// needs no portal/z-index management (F02 instruction §28 accessibility requirements:
/// keyboard/focus/aria/dialog semantics all come from the element itself, not re-implemented
/// here). `variant="drawer"` is the same element, styled to slide in from the edge instead
/// of centering — still real modal semantics, just different placement.
export function Dialog({ open, onClose, title, children, variant = "modal" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      className={cn(
        "m-0 max-h-none border-none bg-transparent p-0 backdrop:bg-black/40",
        variant === "modal" && "fixed inset-0 flex h-full max-w-none items-center justify-center",
        variant === "drawer" && "fixed inset-y-0 right-0 h-full max-w-none",
      )}
    >
      <div
        className={cn(
          "flex flex-col bg-background shadow-lg",
          variant === "modal" && "max-h-[85vh] w-full max-w-lg rounded-lg",
          variant === "drawer" && "h-full w-full max-w-sm",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
