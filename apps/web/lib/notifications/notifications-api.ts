import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { NotificationListParams, NotificationRecord } from "./types";

/// F02 built the bell/unread-badge foundation against this same call; F07 adds the full
/// inbox UI (filtering by channel/read-state, pagination) on top — this function itself
/// didn't need to change, only its param type widened to the full `NotificationQueryDto`
/// shape (`channel`/`sort` were always backend-supported, just unused by the F02 bell).
export async function listNotifications(params: NotificationListParams = {}): Promise<PaginatedResponse<NotificationRecord>> {
  return apiFetch<PaginatedResponse<NotificationRecord>>("/notifications", { query: params });
}

export async function markNotificationRead(id: string): Promise<NotificationRecord> {
  return apiFetch<NotificationRecord>(`/notifications/${id}/read`, { method: "PATCH" });
}
