/// Mirrors `database/schema.prisma` `PartnerStudentLink` + the Partner/Student-summary embed
/// added in `apps/api/.../partner-student-links.service.ts` (docs/DECISIONS.md DEC-12).
/// A pure junction row (SRS 6.17) — never a duplicate Student/Case/Application/Partner
/// entity, GLOBAL/permission-gated only (no case-scope check at all, confirmed against the
/// live service). `linkType` is free text (Referral/Agent/Sponsor/...), never a hard-coded
/// enum.

export type PartnerLinkStatus = "ACTIVE" | "ARCHIVED";

export interface PartnerStudentLinkPartnerSummary {
  id: string;
  name: string;
  countryCode: string;
}

export interface PartnerStudentLinkStudentSummary {
  id: string;
  studentCode: string;
  fullName: string;
}

export interface PartnerStudentLink {
  id: string;
  partnerId: string;
  partner: PartnerStudentLinkPartnerSummary;
  studentId: string;
  student: PartnerStudentLinkStudentSummary;
  caseId: string | null;
  applicationId: string | null;
  linkType: string;
  status: PartnerLinkStatus;
  effectiveDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerStudentLinkListParams {
  page?: number;
  limit?: number;
  status?: PartnerLinkStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreatePartnerStudentLinkDto` exactly.
export interface CreatePartnerStudentLinkInput {
  studentId: string;
  caseId?: string;
  applicationId?: string;
  linkType: string;
  effectiveDate?: string;
  notes?: string;
}

export interface UpdatePartnerStudentLinkInput {
  linkType?: string;
  effectiveDate?: string;
  notes?: string;
}

/// `409 DUPLICATE_PARTNER_STUDENT_LINK` on an active `(partnerId, studentId, caseId,
/// applicationId)` tuple.
export interface DuplicatePartnerStudentLinkError {
  code: "DUPLICATE_PARTNER_STUDENT_LINK";
  message: string;
  existingLinkId: string;
}
