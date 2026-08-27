import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { AuditLog, AuditLogListParams } from "./types";

/// Typed call against `AuditLogsController` (`apps/api/.../audit-logs/audit-logs.controller.ts`)
/// — the only route on this controller, `GET /audit-logs` (`audit_logs:view`).
export function listAuditLogs(params: AuditLogListParams): Promise<PaginatedResponse<AuditLog>> {
  return apiFetch<PaginatedResponse<AuditLog>>("/audit-logs", { query: params });
}
