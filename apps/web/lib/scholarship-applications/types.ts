/// Mirrors `database/schema.prisma` `ScholarshipApplication` + the ScholarshipMaster-summary
/// embed added in `apps/api/.../scholarship-applications.service.ts` (docs/DECISIONS.md
/// DEC-11). Kept fully separate from `ScholarshipMaster` (`lib/scholarship-masters/`) — this
/// is the per-student transaction (F05 instruction §21). `internalNotes` comes back `null`
/// when field-redacted for STUDENT_PARENT (`FieldPolicyService.redactScholarshipApplication`)
/// — rendered exactly as returned, never a client workaround. Award fields are deliberately
/// never linked to Contract/Payment — no such field exists on this entity at all.

export type ScholarshipApplicationStatus = "PLANNING" | "SUBMITTED" | "UNDER_REVIEW" | "INTERVIEW" | "AWARDED" | "REJECTED" | "WITHDRAWN";

/// Every status besides AWARDED/REJECTED (their own dedicated `/award`/`/reject` actions —
/// a real award carries required extra data a bare status flip can't express safely).
export const MANUAL_SCHOLARSHIP_APPLICATION_STATUSES: ScholarshipApplicationStatus[] = ["PLANNING", "SUBMITTED", "UNDER_REVIEW", "INTERVIEW", "WITHDRAWN"];

export interface ScholarshipApplicationMasterSummary {
  id: string;
  scholarshipCode: string;
  provider: string;
  name: string;
  coverageType: string | null;
  amount: string | null;
  percentage: string | null;
  amountCurrency: string | null;
}

export interface ScholarshipApplication {
  id: string;
  scholarshipApplicationCode: string;
  studentId: string;
  caseId: string;
  scholarshipMasterId: string;
  scholarshipMaster: ScholarshipApplicationMasterSummary;
  applicationId: string | null;
  status: ScholarshipApplicationStatus;
  /** Gate for submission — SUBMITTED is blocked (`409 ELIGIBILITY_NOT_CONFIRMED`) until this
   * is true. Set only via `confirm-eligibility`, never a plain field edit. */
  eligibilityConfirmed: boolean;
  eligibilityNotes: string | null;
  deadline: string | null;
  essayArtifactId: string | null;
  interviewAt: string | null;
  /** `null` when field-redacted for STUDENT_PARENT, or genuinely unset. */
  internalNotes: string | null;
  conditions: string | null;
  awardAmount: string | null;
  awardCurrency: string | null;
  awardCoverageType: string | null;
  awardPeriod: string | null;
  awardAcceptanceDeadline: string | null;
  evidenceDocumentId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/// Mirrors `CreateScholarshipApplicationDto` exactly — `studentId`/`caseId` come from the
/// route, never body fields.
export interface CreateScholarshipApplicationInput {
  scholarshipMasterId: string;
  applicationId?: string;
  deadline?: string;
  essayArtifactId?: string;
}

export interface UpdateScholarshipApplicationInput {
  applicationId?: string;
  deadline?: string;
  essayArtifactId?: string;
  interviewAt?: string;
  internalNotes?: string;
  conditions?: string;
}

export interface ConfirmEligibilityInput {
  eligibilityNotes?: string;
}

export interface AwardScholarshipInput {
  awardAmount?: number;
  awardCurrency?: string;
  awardCoverageType?: string;
  awardPeriod?: string;
  awardAcceptanceDeadline?: string;
  evidenceDocumentId?: string;
}
