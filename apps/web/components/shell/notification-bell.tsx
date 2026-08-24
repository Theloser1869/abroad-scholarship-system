"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useUnreadNotificationCount } from "@/lib/notifications/hooks";

/// F02's shell entry point, shared between the staff shell and the Portal shell
/// (`(portal)/portal/layout.tsx`). `useUnreadNotificationCount` (shared with F07's inbox
/// page, so marking read there invalidates this badge too — F07 instruction §33) reads the
/// count off `meta.totalItems` via `unreadOnly=true, limit=1`, never a second full fetch.
///
/// F07's full inbox (`/notifications`) lives under the `(staff)` route group/shell — building
/// a Portal-shell equivalent is explicitly F08 scope ("Full Portal UX belongs F08," F07
/// instruction §36), so a Portal viewer keeps the F02 badge-only behavior (no navigation)
/// rather than being sent into the staff shell's sidebar/topbar chrome; a staff viewer gets
/// the real link added this phase.
export function NotificationBell() {
  const { status } = useAuth();
  const pathname = usePathname();
  const inPortal = pathname?.startsWith("/portal") ?? false;
  const { data } = useUnreadNotificationCount(status === "AUTHENTICATED");

  const unreadCount = data?.meta.totalItems ?? 0;
  const label = unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo";
  const badge =
    unreadCount > 0 ? (
      <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-danger-foreground">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null;

  if (inPortal) {
    return (
      <span aria-label={label} className="relative inline-flex rounded p-2">
        <span aria-hidden="true">🔔</span>
        {badge}
      </span>
    );
  }

  return (
    <Link href="/notifications" aria-label={label} className="relative inline-flex rounded p-2 hover:bg-muted">
      <span aria-hidden="true">🔔</span>
      {badge}
    </Link>
  );
}
