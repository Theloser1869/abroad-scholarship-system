import type { RoleCode } from "./session";

/// Display labels transcribed from `database/seeds/seed.ts` `ROLES` (the `name` field for
/// each `RoleCode`) — no backend endpoint returns a human-readable role name to a
/// self-service caller (`GET /auth/me` returns only `roleCode`), so this is a client-side
/// mirror, not a live fetch. Keep in sync with `seed.ts` if a role's display name ever
/// changes there.
export const ROLE_LABELS: Record<RoleCode, string> = {
  EXECUTIVE_DIRECTOR: "Giám đốc điều hành",
  DEPARTMENT_MANAGER: "Trưởng phòng",
  CONSULTANT: "Tư vấn",
  DOCUMENT_SPECIALIST: "Hồ sơ",
  SALES_MARKETING: "Sale/Marketing",
  ADMIN_FINANCE: "Hành chính - Tài chính (HCTH)",
  STUDENT_PARENT: "Học sinh / Phụ huynh",
  SYSTEM_ADMIN: "System Admin",
};

export function roleLabel(roleCode: RoleCode | null | undefined): string {
  if (!roleCode) return "";
  return ROLE_LABELS[roleCode] ?? roleCode;
}
