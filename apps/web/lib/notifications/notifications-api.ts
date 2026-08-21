import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { NotificationRecord } from "./types";

/// Foundation only (F02 instruction §20 — "chỉ cần foundation... không xây toàn bộ
/// notification center nếu F07 scope mới là owner"). This is enough for the shell's bell
/// icon/unread badge; the full inbox UI (mark-all-read, filtering by channel, ...) is F07.
export async function listNotifications(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}): Promise<PaginatedResponse<NotificationRecord>> {
  return apiFetch<PaginatedResponse<NotificationRecord>>("/notifications", { query: params });
}

export async function markNotificationRead(id: string): Promise<NotificationRecord> {
  return apiFetch<NotificationRecord>(`/notifications/${id}/read`, { method: "PATCH" });
}
