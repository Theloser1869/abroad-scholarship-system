"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type LabelMap = Record<string, string>;

const BreadcrumbLabelContext = createContext<{
  labels: LabelMap;
  setLabel: (segment: string, label: string) => void;
  clearLabel: (segment: string) => void;
} | null>(null);

/// Wraps the staff shell so any nested page can register a friendly label for its own URL
/// segment — see `useBreadcrumbLabel` below. Without a registered label, `Breadcrumbs` falls
/// back to the raw path segment (e.g. a UUID), which is why this exists at all.
export function BreadcrumbLabelProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<LabelMap>({});

  const setLabel = useCallback((segment: string, label: string) => {
    setLabels((prev) => (prev[segment] === label ? prev : { ...prev, [segment]: label }));
  }, []);

  const clearLabel = useCallback((segment: string) => {
    setLabels((prev) => {
      if (!(segment in prev)) return prev;
      const next = { ...prev };
      delete next[segment];
      return next;
    });
  }, []);

  const value = useMemo(() => ({ labels, setLabel, clearLabel }), [labels, setLabel, clearLabel]);

  return <BreadcrumbLabelContext.Provider value={value}>{children}</BreadcrumbLabelContext.Provider>;
}

export function useBreadcrumbLabels() {
  const ctx = useContext(BreadcrumbLabelContext);
  if (!ctx) throw new Error("useBreadcrumbLabels must be used within BreadcrumbLabelProvider");
  return ctx;
}

/// Call from a page with a dynamic `[id]` segment once its entity has loaded, to swap the raw
/// UUID in the breadcrumb trail for something a customer-facing user can actually read (a case
/// code, a student's name, ...). No-ops until `label` is available; clears itself on unmount so
/// a stale label never leaks into an unrelated page that happens to reuse the same segment.
export function useBreadcrumbLabel(segment: string | undefined, label: string | undefined) {
  const { setLabel, clearLabel } = useBreadcrumbLabels();
  useEffect(() => {
    if (!segment || !label) return;
    setLabel(segment, label);
    return () => clearLabel(segment);
  }, [segment, label, setLabel, clearLabel]);
}
