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
