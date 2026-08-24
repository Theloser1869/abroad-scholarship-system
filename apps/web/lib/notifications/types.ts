/// Mirrors `Notification` (`database/schema.prisma`) as returned by `GET /notifications`
/// (`apps/api/src/modules/notifications/notifications/notifications.controller.ts`).
export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "ZALO" | "WHATSAPP";

export interface NotificationRecord {
  id: string;
  recipientId: string;
  event: string;
  channel: NotificationChannel;
  payload: unknown;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}

/// Mirrors `NotificationQueryDto` — `sort` comes from the shared `ListQueryDto` base
/// (`createdAt`/`sentAt`, matching `SORTABLE_FIELDS` in `notifications.service.ts`).
export interface NotificationListParams {
  page?: number;
  limit?: number;
  channel?: NotificationChannel;
  unreadOnly?: boolean;
  sort?: string;
  [key: string]: string | number | boolean | undefined;
}
