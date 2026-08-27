/// Mirrors `database/schema.prisma`'s 5 Profile Evidence models. All 5 share the one
/// `profile_evidence` permission resource and the same `verify` action (gated on
/// `profile_evidence:edit`, not a distinct permission — confirmed directly against
/// `profile-evidence.controller.ts`). Consolidated into one module (types/api/hooks) mirroring
/// the backend's own single-file `profile-evidence.controller.ts` — these are 5 structurally
/// identical Case-scoped resources, not 5 independent concepts.

export interface AcademicRecord {
  id: string;
  caseId: string;
  school: string;
  /** Client Acceptance Remediation DEC-05(b) — optional link to a curated SchoolMaster row; null means `school` is free text. */
  schoolMasterId: string | null;
  period: string;
  /** Client Acceptance Remediation GAP-004 — required before Assessment approval (409 STUDENT_PROFILE_INCOMPLETE). */
  grade: string | null;
  /** GPA is Optional per client decision (2026-08-25, CONFLICT-004) — not part of the Assessment-approval gate. */
  gpa: string | null;
  gradingScale: string | null;
  evidenceDocumentId: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestRecord {
  id: string;
  caseId: string;
  testType: string;
  attemptNumber: number;
  testDate: string | null;
  plannedDate: string | null;
  score: string | null;
  subscores: Record<string, unknown> | null;
  target: string | null;
  evidenceDocumentId: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Competition {
  id: string;
  competitionCode: string;
  caseId: string;
  eventName: string;
  year: number | null;
  season: string | null;
  category: string | null;
  registrationStatus: string | null;
  preparation: string | null;
  result: string | null;
  rank: string | null;
  award: string | null;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProject {
  id: string;
  researchCode: string;
  caseId: string;
  title: string;
  mentor: string | null;
  role: string | null;
  startAt: string | null;
  endAt: string | null;
  methodology: string | null;
  output: string | null;
  publication: string | null;
  award: string | null;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  caseId: string;
  organization: string;
  role: string | null;
  category: string | null;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  hours: string | null;
  impact: string | null;
  award: string | null;
  verifierName: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcademicRecordInput {
  school: string;
  schoolMasterId?: string;
  period: string;
  grade?: string;
  gpa?: number;
  gradingScale?: string;
  evidenceDocumentId?: string;
}
export type UpdateAcademicRecordInput = Partial<CreateAcademicRecordInput>;

export interface CreateTestRecordInput {
  testType: string;
  attemptNumber: number;
  testDate?: string;
  plannedDate?: string;
  score?: number;
  subscores?: Record<string, unknown>;
  target?: number;
  evidenceDocumentId?: string;
}
/// `testType`/`attemptNumber` identify the attempt (`@@unique([caseId, testType,
/// attemptNumber])`) and are omitted from the update DTO server-side — correcting either
/// means creating a new attempt record, never re-targeting an existing one via edit.
export type UpdateTestRecordInput = Partial<Omit<CreateTestRecordInput, "testType" | "attemptNumber">>;

export interface CreateCompetitionInput {
  eventName: string;
  year?: number;
  season?: string;
  category?: string;
  registrationStatus?: string;
  preparation?: string;
  result?: string;
  rank?: string;
  award?: string;
  evidenceDocumentId?: string;
}
export type UpdateCompetitionInput = Partial<CreateCompetitionInput>;

export interface CreateResearchProjectInput {
  title: string;
  mentor?: string;
  role?: string;
  startAt?: string;
  endAt?: string;
  methodology?: string;
  output?: string;
  publication?: string;
  award?: string;
  evidenceDocumentId?: string;
}
export type UpdateResearchProjectInput = Partial<CreateResearchProjectInput>;

export interface CreateActivityInput {
  organization: string;
  role?: string;
  category?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  hours?: number;
  impact?: string;
  award?: string;
  verifierName?: string;
  evidenceDocumentId?: string;
}
export type UpdateActivityInput = Partial<CreateActivityInput>;
