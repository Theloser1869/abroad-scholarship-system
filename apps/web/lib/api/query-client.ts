import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./types";

/// Centralized QueryClient config (F02 instruction §24). Retry policy is deliberately
/// conservative: a 401/403/404/409/422/429 response will never fix itself by blindly
/// retrying the same request (401 is already handled by `lib/api/client.ts`'s own
/// refresh-and-retry-once, not by React Query re-firing the query; 403/404/409/422 are
/// business/authorization outcomes, retrying changes nothing; 429 needs a real backoff, not
/// an immediate re-fire) — only a genuinely transient failure (network blip, 5xx) gets the
/// default retry. Mutations never auto-retry at all (F02 instruction §24: "Không retry:
/// authentication mutations, financial mutations, document uploads, workflow transitions
/// một cách mù quáng" — a caller that specifically wants safe retry on an `@Idempotent()`
/// backend endpoint does so explicitly with its own `Idempotency-Key`, not via this global
/// default).
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && [401, 403, 404, 409, 422, 429].includes(error.status)) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
