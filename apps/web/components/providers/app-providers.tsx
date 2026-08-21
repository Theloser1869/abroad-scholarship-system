"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/query-client";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";

/// Every app-wide client provider mounts here (F01 boundary, filled in this phase — see
/// docs/frontend/FRONTEND_ARCHITECTURE.md §6). `QueryClientProvider` must wrap
/// `AuthProvider`, not the other way around — `AuthProvider` calls `useQueryClient()` (to
/// clear the cache on logout/session-expiry, F02 instruction §26) and needs it in context.
/// `useState(() => createQueryClient())` — not a module-level singleton — is the documented
/// React Query pattern for Next.js: a fresh client per app instance, safe even if this ever
/// runs under strict/concurrent rendering.
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
