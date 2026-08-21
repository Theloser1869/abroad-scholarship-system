"use client";

import { useState } from "react";

/// Resets a dialog's local state when `open` transitions false→true. Uses the React-endorsed
/// "adjust state during render" pattern (comparing against a previous-value snapshot) instead
/// of `useEffect` + `setState`, which the `react-hooks/set-state-in-effect` lint rule flags —
/// an always-mounted `<Dialog>` (F02's, driven by `open`/`showModal()`) needs its form state
/// re-initialized on every reopen, not just once on mount.
export function useResetOnOpen(open: boolean, reset: () => void): void {
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) reset();
  }
}
