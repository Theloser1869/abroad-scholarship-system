import type { ProgramSummary } from "../programs/types";

/// Mirrors `database/schema.prisma` `UniversityChoice` + the Program(+University) embed
/// added in `apps/api/.../university-choices.service.ts` (docs/DECISIONS.md DEC-11). Scope
/// is `/students/:studentId/university-choices` — student-scoped, NOT case-scoped (`caseId`
/// is only an optional linkage field; F01's real route map confirms this, overriding the
/// "Case ID là source of scope" assumption in some planning docs).

export type UniversityChoiceTier = "REACH" | "MATCH" | "SAFETY";
export type UniversityChoiceStatus = "PROPOSED" | "SHORTLISTED" | "CONFIRMED" | "REMOVED";

export interface UniversityChoice {
  id: string;
  studentId: string;
  caseId: string | null;
  programId: string;
  program: ProgramSummary;
  tier: UniversityChoiceTier;
  rationale: string | null;
  status: UniversityChoiceStatus;
  ownerId: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/// Mirrors `CreateUniversityChoiceDto` exactly — `studentId` comes from the route, never a
/// body field.
export interface CreateUniversityChoiceInput {
  programId: string;
  tier: UniversityChoiceTier;
  rationale?: string;
  caseId?: string;
  ownerId?: string;
}

/// Mirrors `UpdateUniversityChoiceDto` — `programId`/`caseId` are identity-establishing and
/// not re-pointable (propose a new choice instead of re-parenting one). `status` is a plain
/// field here (no dedicated FSM action for this one entity — confirmed against the live
/// controller, unlike Application/ScholarshipApplication).
export interface UpdateUniversityChoiceInput {
  tier?: UniversityChoiceTier;
  rationale?: string;
  status?: UniversityChoiceStatus;
  ownerId?: string;
}

export interface ReviewUniversityChoiceInput {
  reviewNotes?: string;
}

/// `409 DUPLICATE_UNIVERSITY_CHOICE` shape — unique (studentId, programId).
export interface DuplicateUniversityChoiceError {
  code: "DUPLICATE_UNIVERSITY_CHOICE";
  message: string;
  existingUniversityChoiceId: string;
}
