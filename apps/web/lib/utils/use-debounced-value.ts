"use client";

import { useEffect, useState } from "react";

/// Debounces a fast-changing value (e.g. a search input) before it drives a query — F03
/// instruction: "search phải debounce, không load hết rồi filter client-side". The query
/// itself still goes to the backend on every settled value; this only limits how often.
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
