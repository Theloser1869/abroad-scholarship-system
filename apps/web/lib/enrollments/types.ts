import type { ProgramUniversitySummary } from "../programs/types";

/// Mirrors `database/schema.prisma` `Enrollment` + the University/Program-summary embed
/// added in `apps/api/.../enrollments.service.ts` (docs/DECISIONS.md DEC-12 — mirrors
/// DEC-09/10/11 exactly). A Student/Case-level **transaction**, not master data — multiple
/// rows may exist per Case (history of attempts); at most one CONFIRMED at a time
/// (`409 CONFIRMED_ENROLLMENT_EXISTS`). `universityId`/`programId` are real FKs, derived
/// server-side from the target Offer's Application at create time — never client-supplied,
/// never a duplicated name (F06 instruction §14).

export type EnrollmentStatus = "PLANNED" | "CONFIRMED" | "WITHDRAWN";

export interface Enrollment {
  id: string;
  studentId: string;
  caseId: string;
  offerId: string;
  universityId: string;
  university: ProgramUniversitySummary;
  programId: string;
  program: { id: string; degreeLevel: string; major: string };
  startDate: string | null;
  confirmationDate: string | null;
  status: EnrollmentStatus;
  evidenceDocumentId: string | null;
  /** `null` when field-redacted for STUDENT_PARENT, or genuinely unset. */
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/// Mirrors `CreateEnrollmentDto` exactly — `universityId`/`programId` are derived
/// server-side from `offer.application.programId`, never client-supplied (structurally
/// impossible to "create new institution/program records from the frontend").
export interface CreateEnrollmentInput {
  offerId: string;
  startDate?: string;
  evidenceDocumentId?: string;
}

export interface UpdateEnrollmentInput {
  startDate?: string;
  evidenceDocumentId?: string;
  internalNotes?: string;
}

export interface ConfirmEnrollmentInput {
  confirmationDate?: string;
  evidenceDocumentId?: string;
}

/// `409 INVALID_ENROLLMENT_TARGET` — the Offer must belong to this Case and be ACCEPTED;
/// this is F06 instruction §16's "offer validity" check, enforced at Enrollment-create time
/// (not a separate endpoint) — never pre-filtered client-side by an invented validity rule.
export interface InvalidEnrollmentTargetError {
  code: "INVALID_ENROLLMENT_TARGET";
  message: string;
}

/// `409 CONFIRMED_ENROLLMENT_EXISTS` — at most one CONFIRMED enrollment per Case.
export interface ConfirmedEnrollmentExistsError {
  code: "CONFIRMED_ENROLLMENT_EXISTS";
  message: string;
  existingEnrollmentId: string;
}
