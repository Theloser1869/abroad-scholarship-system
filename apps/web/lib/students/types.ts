/// Mirrors `database/schema.prisma` `Student`/`StudentContact` + the field redaction
/// `FieldPolicyService.redactStudent` applies server-side (`RedactedStudent` —
/// `apps/api/src/modules/identity/rbac/field-policy.service.ts`). `budget`/`budgetCurrency`
/// come back `null` for roles the backend redacts them for — the frontend renders whatever
/// it receives and never requests an alternate endpoint to work around a `null`
/// (F03 instruction §10: "Không request endpoint khác để cố lấy field bị redact").

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  targetCountry: string | null;
  targetMajor: string | null;
  targetIntake: string | null;
  /** Decimal, serialized as a string by Prisma's own JSON encoding — or null (redacted, or genuinely unset). */
  budget: string | null;
  budgetCurrency: string | null;
  archivedAt: string | null;
  portalUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PortalLinkStatus = "NONE" | "INVITED" | "ACTIVE" | "REVOKED";

export interface StudentContact {
  id: string;
  studentId: string;
  type: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  portalUserId: string | null;
  portalStatus: PortalLinkStatus;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  targetCountry?: string;
  [key: string]: string | number | boolean | undefined | null;
}

export interface CreateStudentInput {
  fullName: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  targetCountry?: string;
  targetMajor?: string;
  targetIntake?: string;
  budget?: number;
  budgetCurrency?: string;
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

export interface CreateStudentContactInput {
  type: string;
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
}
