/// Mirrors `database/schema.prisma` `AuditLog` (`apps/api/.../audit-logs/audit-logs.service.ts`)
/// exactly — read-only, no create/update/delete anywhere on the frontend either (audit is
/// append-only, `03-security/03_AUDIT.md` "admin không xóa log tùy tiện").

export type AuditResult = "SUCCESS" | "DENIED" | "ERROR";

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  studentId: string | null;
  caseId: string | null;
  result: string;
  ipAddress: string | null;
  userAgent: string | null;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  metadata: unknown;
  requestId: string | null;
  createdAt: string;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  sort?: string;
  actorId?: string;
  action?: string;
  objectType?: string;
  objectId?: string;
  studentId?: string;
  caseId?: string;
  result?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | number | boolean | undefined | null;
}
