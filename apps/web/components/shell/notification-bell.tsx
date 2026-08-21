"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { listNotifications } from "@/lib/notifications/notifications-api";

/// Shell entry point only (F02 instruction §20) — unread-count badge, no dropdown/inbox yet
/// (F07 owns the full notification center). `unreadOnly=true, limit=1` reads the count off
/// `meta.totalItems` without fetching a real page of rows just to show a badge.
export function NotificationBell() {
  const { status } = useAuth();
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => listNotifications({ unreadOnly: true, limit: 1 }),
    enabled: status === "AUTHENTICATED",
    // Polling here (not just cache-on-mount) is a reasonable default for a bell badge; F07
    // may replace this with a push/subscription mechanism if the backend ever adds one.
    refetchInterval: 60_000,
  });

  const unreadCount = data?.meta.totalItems ?? 0;

  return (
    <button
      type="button"
      aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
      className="relative rounded p-2 hover:bg-muted"
    >
      <span aria-hidden="true">🔔</span>
      {unreadCount > 0 ? (
        <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-danger-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
