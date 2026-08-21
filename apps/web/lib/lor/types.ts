/// Mirrors `database/schema.prisma` `LetterOfRecommendation` — "LOR tracking" (F04
/// instruction §28), a status/logistics record (recommender, request/submission status,
/// deadline), structurally separate from `WritingArtifact`/`WritingVersion` (no content/
/// review workflow of its own).

export type LorRequestStatus = "NOT_REQUESTED" | "REQUESTED" | "IN_PROGRESS" | "RECEIVED" | "DECLINED";
export const LOR_REQUEST_STATUSES: LorRequestStatus[] = ["NOT_REQUESTED", "REQUESTED", "IN_PROGRESS", "RECEIVED", "DECLINED"];

export type LorSubmissionStatus = "PENDING" | "SUBMITTED" | "NOT_REQUIRED";
export const LOR_SUBMISSION_STATUSES: LorSubmissionStatus[] = ["PENDING", "SUBMITTED", "NOT_REQUIRED"];

export interface LetterOfRecommendation {
  id: string;
  caseId: string;
  recommenderName: string;
  relationship: string | null;
  /** `null` when field-redacted for STUDENT_PARENT (`FieldPolicyService.redactLor`), never a workaround fetch. */
  contactEmail: string | null;
  contactPhone: string | null;
  requestDate: string | null;
  deadline: string | null;
  requestStatus: LorRequestStatus;
  submissionStatus: LorSubmissionStatus;
  internalNotes: string | null;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLorInput {
  recommenderName: string;
  relationship?: string;
  contactEmail?: string;
  contactPhone?: string;
  requestDate?: string;
  deadline?: string;
  internalNotes?: string;
}

export type UpdateLorInput = Partial<CreateLorInput> & {
  requestStatus?: LorRequestStatus;
  submissionStatus?: LorSubmissionStatus;
  evidenceDocumentId?: string;
};
