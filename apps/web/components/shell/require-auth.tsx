"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

/// Protected-route boundary (F02 instruction §9) — a CLIENT-side gate, not the security
/// boundary itself (the backend re-checks every API call regardless, see
/// docs/architecture/TARGET_ARCHITECTURE.md §1). Used by both `(staff)` and
/// `(portal)/portal` layouts to require AUTHENTICATED before rendering their children.
/// Distinguishes every `AuthStatus` explicitly — never a bare truthy/falsy check that would
/// flash the unauthenticated UI during the INITIALIZING bootstrap window.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "UNAUTHENTICATED") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "INITIALIZING" || status === "REFRESHING") {
    return (
      <div className="flex flex-1 flex-col gap-3 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  if (status === "ERROR") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h2 className="text-lg font-semibold">Không thể xác thực phiên đăng nhập.</h2>
        <p className="text-sm text-muted-foreground">Vui lòng tải lại trang. Nếu lỗi tiếp diễn, liên hệ quản trị viên.</p>
      </div>
    );
  }

  if (status === "UNAUTHENTICATED") {
    // Redirect effect above is in flight — render nothing rather than a flash of protected
    // content or a second competing loading state.
    return null;
  }

  return <>{children}</>;
}
