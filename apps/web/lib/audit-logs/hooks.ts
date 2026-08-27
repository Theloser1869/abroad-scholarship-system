"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as auditLogsApi from "./api";
import type { AuditLogListParams } from "./types";

export function useAuditLogs(params: AuditLogListParams) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params),
    queryFn: () => auditLogsApi.listAuditLogs(params),
  });
}
