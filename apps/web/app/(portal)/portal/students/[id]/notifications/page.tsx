"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalNotifications, useMarkPortalNotificationRead } from "@/lib/portal/hooks";
import { notificationEventMeta } from "@/lib/notifications/notification-event-map";
import { portalNotificationHref } from "@/lib/portal/notification-links";
import type { NotificationRecord } from "@/lib/notifications/types";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { cn } from "@/lib/utils/cn";

/// Reuses F07's inbox mechanics (same event→label/icon map, same mark-read endpoint) — the
/// inbox itself is recipient-scoped, not student-scoped, so this is the SAME data a
/// staff-shell `/notifications` visit would show for this same account; the `:id` in the URL
/// only exists for Portal route-shape/scope-check consistency (F08 instruction §25: "Reuse
/// F07 notification system... own inbox only"). Navigation is Portal-aware
/// (`portalNotificationHref`), not F07's staff-route map — clicking a notification here must
/// land back inside the Portal shell at the SAME student context, never the staff shell.
export function NotificationsContent({ studentId }: { studentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = usePortalNotifications(studentId, { page, limit: 20 });
  const markRead = useMarkPortalNotificationRead(studentId);

  async function handleOpen(n: NotificationRecord, href: string | null) {
    if (!n.readAt) {
      try {
        await markRead.mutateAsync(n.id);
      } catch (err) {
        toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
      }
    }
    if (href) router.push(href);
  }

  if (isLoading) return <LoadingState />;
  if (error || !data) return <QueryErrorState error={error} onRetry={() => refetch()} />;
  if (data.data.length === 0) return <EmptyState title="Không có thông báo nào." />;

  return (
    <div className="space-y-3">
      {data.data.map((n) => {
        const meta = notificationEventMeta(n.event);
        const payload = (n.payload && typeof n.payload === "object" ? (n.payload as Record<string, unknown>) : {}) as Record<string, unknown>;
        const href = portalNotificationHref(n.event, studentId, payload);
        const unread = !n.readAt;
        return (
          <Card key={n.id} className={cn("flex items-start justify-between gap-3", unread && "border-primary/40 bg-primary/5")}>
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="text-lg">
                {meta.icon}
              </span>
              <div>
                {href ? (
                  <button type="button" onClick={() => handleOpen(n, href)} className={cn("text-left text-sm hover:underline", unread ? "font-semibold" : "font-medium")}>
                    {meta.label}
                  </button>
                ) : (
                  <p className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{meta.label}</p>
                )}
                <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("vi-VN")}</p>
              </div>
            </div>
            {unread ? (
              <Button variant="secondary" onClick={() => handleOpen(n, null)} disabled={markRead.isPending}>
                Đánh dấu đã đọc
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Đã đọc</span>
            )}
          </Card>
        );
      })}
      <PaginationControls meta={data.meta} onPageChange={setPage} />
    </div>
  );
}

export default function PortalNotificationsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalNotificationsPageInner params={params} />
    </Suspense>
  );
}

function PortalNotificationsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <NotificationsContent studentId={id} />
    </PortalStudentShell>
  );
}
