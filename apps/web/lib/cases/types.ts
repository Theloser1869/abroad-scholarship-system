import type { UserSummary } from "../api/types";

/// Mirrors `database/schema.prisma` `Case`/`CaseMember` + the relation summaries added in
/// `apps/api/src/modules/case-management/cases/cases.service.ts` (docs/DECISIONS.md DEC-09).

export type CaseStatus = "OPEN" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CLOSED" | "ARCHIVED";

/// Manual transitions only — CLOSED is reachable only via the unified Closure workflow
/// (`POST /cases/:id/closure/close` — see `lib/closure/api.ts`).
export const MANUAL_CASE_STATUSES: CaseStatus[] = ["OPEN", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];

export type CaseMemberRole = "OWNER" | "COLLABORATOR";

/// REQ-CASE-016 (2026-08-26) — sheet08 (Case_Workflow)'s 15-stage narrative, mirrors the
/// Prisma `CaseStage` enum exactly. Previously free text.
export type CaseStage =
  | "LEAD_TO_CONTRACT"
  | "CONTRACT_SIGNING"
  | "ASSESSMENT"
  | "ROADMAP"
  | "PROFILE_DEVELOPMENT"
  | "WRITING"
  | "SCHOOL_SELECTION"
  | "APPLICATION"
  | "OFFER"
  | "SCHOLARSHIP"
  | "VISA"
  | "PRE_DEPARTURE"
  | "ENROLLMENT"
  | "CLOSURE"
  | "ARCHIVE";

export const CASE_STAGES: CaseStage[] = [
  "LEAD_TO_CONTRACT",
  "CONTRACT_SIGNING",
  "ASSESSMENT",
  "ROADMAP",
  "PROFILE_DEVELOPMENT",
  "WRITING",
  "SCHOOL_SELECTION",
  "APPLICATION",
  "OFFER",
  "SCHOLARSHIP",
  "VISA",
  "PRE_DEPARTURE",
  "ENROLLMENT",
  "CLOSURE",
  "ARCHIVE",
];

export interface StudentSummary {
  id: string;
  studentCode: string;
  fullName: string;
}

export interface Case {
  id: string;
  caseCode: string;
  studentId: string;
  student: StudentSummary;
  contractId: string | null;
  ownerId: string;
  owner: UserSummary;
  department: string | null;
  stage: CaseStage;
  status: CaseStatus;
  closureReason: string | null;
  openedAt: string;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseMember {
  caseId: string;
  userId: string;
  user: UserSummary;
  role: CaseMemberRole;
  addedAt: string;
  removedAt: string | null;
}

export interface CaseListParams {
  page?: number;
  limit?: number;
  sort?: string;
  status?: CaseStatus;
  studentId?: string;
  [key: string]: string | number | boolean | undefined | null;
}

export interface UpdateCaseStageInput {
  stage: CaseStage;
  department?: string;
}

export interface AddCaseMemberInput {
  userId: string;
  role: CaseMemberRole;
}
