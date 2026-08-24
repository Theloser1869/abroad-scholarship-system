"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as notificationsApi from "./notifications-api";
import type { NotificationListParams } from "./types";

export function useNotifications(params: NotificationListParams) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => notificationsApi.listNotifications(params),
  });
}

/// `unreadOnly=true, limit=1` reads the unread count off `meta.totalItems` without fetching a
/// real page of rows — same technique the F02 `NotificationBell` foundation already used,
/// centralized here so the bell and the full inbox page share one query key (F07 instruction
/// §33: "mark read → invalidate notification + unread count").
export function useUnreadNotificationCount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationsApi.listNotifications({ unreadOnly: true, limit: 1 }),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
