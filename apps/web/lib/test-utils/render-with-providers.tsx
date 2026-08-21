import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";

/// Shared test wrapper for any component using TanStack Query hooks + the toast context
/// (F03's dialogs use `useToast()`). `retry: false` — a mocked API rejection should surface
/// immediately as `isError`, not retry 3 times and time the test out.
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>
    <ToastProvider>{ui}</ToastProvider>
  </QueryClientProvider>);
}
