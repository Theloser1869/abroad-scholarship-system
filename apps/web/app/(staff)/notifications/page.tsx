"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications, useMarkNotificationRead } from "@/lib/notifications/hooks";
import { notificationEventMeta } from "@/lib/notifications/notification-event-map";
import { queryKeys } from "@/lib/api/query-keys";
import type { NotificationChannel, NotificationRecord } from "@/lib/notifications/types";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { cn } from "@/lib/utils/cn";

const CHANNEL_OPTIONS: { value: NotificationChannel | ""; label: string }[] = [
  { value: "", label: "Tất cả kênh" },
  { value: "IN_APP", label: "Trong ứng dụng" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "ZALO", label: "Zalo" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

/// Self-service inbox — every authenticated role reads/marks-read only its OWN notifications
/// (`NotificationsController` has no `@RequirePermission`; `NotificationsService` enforces
/// `recipientId === principal.userId` unconditionally). No permission gate needed here beyond
/// `RequireAuth` (already applied by the `(staff)` layout) — F07 instruction §17/§36.
function NotificationsInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [channel, setChannel] = useState<NotificationChannel | "">("");
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: 20,
    ...(tab === "unread" ? { unreadOnly: true } : {}),
    ...(channel ? { channel } : {}),
  };
  const { data, isLoading, error, refetch } = useNotifications(params);
  const markRead = useMarkNotificationRead();

  async function handleMarkRead(id: string) {
    try {
      await markRead.mutateAsync(id);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  async function handleOpen(n: NotificationRecord, href: string | null) {
    if (!n.readAt) await handleMarkRead(n.id);
    if (href) router.push(href);
  }

  const unreadOnPage = (data?.data ?? []).filter((n) => !n.readAt);

  /// No "mark all read" endpoint exists on the backend (`NotificationsController` has only
  /// `PATCH /notifications/:id/read`, no bulk route) — this loops the same single-item call
  /// over the unread rows currently loaded on this page/filter, never inventing a bulk
  /// endpoint. Documented limitation: it does not reach unread rows on OTHER pages.
  async function handleMarkAllReadOnPage() {
    try {
      await Promise.all(unreadOnPage.map((n) => markRead.mutateAsync(n.id)));
      toast({ title: `Đã đánh dấu đã đọc ${unreadOnPage.length} thông báo (trang hiện tại).`, variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Thông báo</h1>
        {unreadOnPage.length > 0 ? (
          <Button variant="secondary" onClick={handleMarkAllReadOnPage} disabled={markRead.isPending}>
            Đánh dấu đã đọc (trang này)
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded border border-border text-sm">
          <button
            type="button"
            onClick={() => {
              setTab("all");
              setPage(1);
            }}
            className={cn("px-3 py-1.5", tab === "all" && "bg-muted font-medium")}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("unread");
              setPage(1);
            }}
            className={cn("px-3 py-1.5", tab === "unread" && "bg-muted font-medium")}
          >
            Chưa đọc
          </button>
        </div>
        <select
          aria-label="Lọc theo kênh"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as NotificationChannel | "");
            setPage(1);
          }}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm"
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có thông báo nào." description={tab === "unread" ? "Bạn đã đọc hết thông báo." : undefined} />
      ) : (
        <>
          <ul className="space-y-2">
            {data.data.map((n) => {
              const meta = notificationEventMeta(n.event);
              const payload = (n.payload && typeof n.payload === "object" ? (n.payload as Record<string, unknown>) : {}) as Record<string, unknown>;
              const href = meta.buildHref ? meta.buildHref(payload) : null;
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <Card className={cn("flex items-start justify-between gap-3", unread && "border-primary/40 bg-primary/5")}>
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="text-lg">
                        {meta.icon}
                      </span>
                      <div>
                        {href ? (
                          <button
                            type="button"
                            onClick={() => handleOpen(n, href)}
                            className={cn("text-left text-sm hover:underline", unread ? "font-semibold" : "font-medium")}
                          >
                            {meta.label}
                          </button>
                        ) : (
                          <p className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{meta.label}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("vi-VN")}</p>
                      </div>
                    </div>
                    {unread ? (
                      <Button variant="secondary" onClick={() => handleMarkRead(n.id)} disabled={markRead.isPending}>
                        Đánh dấu đã đọc
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Đã đọc</span>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return <NotificationsInbox />;
}

export { NotificationsInbox as NotificationsInboxContent };
