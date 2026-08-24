"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type ToastVariant = "default" | "success" | "danger";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss. Default 5000. Pass 0 to require manual dismiss. */
  durationMs?: number;
}

interface ToastRecord extends ToastInput {
  id: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  default: "border-border bg-background text-foreground",
  success: "border-success bg-success text-success-foreground",
  danger: "border-danger bg-danger text-danger-foreground",
};

/// Foundation-only toast system (F02 design-foundation scope — no queueing beyond a simple
/// stack, no swipe-to-dismiss). `useToast()` is how any future error/success handler
/// surfaces a message — e.g. `error.requestId` on an unexpected 500
/// (docs/frontend/FRONTEND_API_MAP.md §1.8), never a raw stack trace.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, ...input }]);
      const duration = input.durationMs ?? 5000;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext value={{ toast }}>
      {children}
      <div
        role="region"
        aria-label="Thông báo"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            // F09 accessibility hardening (instruction §24 "toast announcements"): an error
            // toast needs the assertive announcement `role="alert"` gives (interrupts the
            // screen reader immediately, same as native form-validation errors elsewhere in
            // this app) — `role="status"`/`aria-live="polite"` waits for a pause, appropriate
            // for success/info but too easy to miss for a failure the user needs to act on.
            role={t.variant === "danger" ? "alert" : "status"}
            aria-live={t.variant === "danger" ? "assertive" : "polite"}
            className={cn(
              "pointer-events-auto relative rounded border px-4 py-3 pr-8 text-sm shadow-md",
              VARIANT_CLASSES[t.variant ?? "default"],
            )}
          >
            <p className="font-medium">{t.title}</p>
            {t.description ? <p className="mt-1 opacity-90">{t.description}</p> : null}
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => dismiss(t.id)}
              className="absolute right-2 top-2 text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() must be used within <ToastProvider>.");
  }
  return ctx;
}
