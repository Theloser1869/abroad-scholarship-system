import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { UserListItem } from "./types";

/// `GET /users` is `users:view`-gated (EXECUTIVE_DIRECTOR/SYSTEM_ADMIN only —
/// docs/security/RBAC_MATRIX.md) — most roles that actually assign a Lead/Case owner
/// (DEPARTMENT_MANAGER, CONSULTANT) do NOT have this grant. Callers must check
/// `usePermissions().can("users", "view")` before using this and fall back to a manual
/// user-ID input otherwise (see `components/crm/user-picker.tsx`) — never call this endpoint
/// unconditionally and treat a 403 as "no users".
export function listUsers(params: { search?: string; limit?: number }): Promise<PaginatedResponse<UserListItem>> {
  return apiFetch<PaginatedResponse<UserListItem>>("/users", { query: params });
}
