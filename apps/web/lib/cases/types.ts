import type { UserSummary } from "../api/types";

/// Mirrors `database/schema.prisma` `Case`/`CaseMember` + the relation summaries added in
/// `apps/api/src/modules/case-management/cases/cases.service.ts` (docs/DECISIONS.md DEC-09).

export type CaseStatus = "OPEN" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CLOSED" | "ARCHIVED";

/// Manual transitions only — CLOSED is reachable only via `PATCH /cases/:id/close`.
export const MANUAL_CASE_STATUSES: CaseStatus[] = ["OPEN", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];

export type CaseMemberRole = "OWNER" | "COLLABORATOR";

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
  stage: string;
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
  stage: string;
  department?: string;
}

export interface AddCaseMemberInput {
  userId: string;
  role: CaseMemberRole;
}
