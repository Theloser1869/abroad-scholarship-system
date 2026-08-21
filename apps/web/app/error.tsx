"use client"; // Error boundaries must be Client Components (Next.js 16 — see AGENTS.md).

import { useEffect } from "react";

// Global fallback for an unexpected runtime error in any route segment. Domain routes
// (F03+) that need to distinguish 401/403/404 from a genuine crash use their own explicit
// state per docs/frontend/FRONTEND_API_MAP.md error-contract mapping, not this boundary —
// this only catches what's left: unhandled thrown errors.
//
// Next.js 16 renamed the recovery callback from `reset` (pre-16) to `retry` — verified
// against node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Đã xảy ra lỗi.</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Vui lòng thử lại. Nếu lỗi tiếp diễn, liên hệ quản trị viên hệ thống.
      </p>
      <button
        onClick={() => retry()}
        className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Thử lại
      </button>
    </div>
  );
}
