/// Mirrors `database/schema.prisma` `Assessment`/`AssessmentCriterion`. List endpoints under
/// this domain return plain arrays, never `{data, meta}` — every list here is Case-scoped
/// with naturally small row counts (docs/frontend/FRONTEND_API_MAP.md has no §2 row for this
/// domain's envelope shape yet; confirmed directly against `assessments.controller.ts`).

export type AssessmentStatus = "DRAFT" | "REVIEW" | "APPROVED" | "SUPERSEDED";

export interface AssessmentCriterion {
  id: string;
  assessmentId: string;
  area: string;
  currentScore: string | null;
  targetScore: string | null;
  /** Computed server-side (`targetScore - currentScore`) — never recompute client-side
   * (F04 instruction §18: "Không tự tính gap = target - current nếu backend đã trả gap"). */
  gap: string | null;
  priority: string | null;
  recommendation: string | null;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  caseId: string;
  version: number;
  status: AssessmentStatus;
  changeReason: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  criteria: AssessmentCriterion[];
}

/// Always creates the NEXT version — `changeReason` required only when the latest version is
/// already APPROVED (`409 CHANGE_REASON_REQUIRED` otherwise); never client-pre-validated.
export interface CreateAssessmentInput {
  changeReason?: string;
}

/// Mirrors the real `POST /assessments/:id/criteria` upsert — `area` travels in the BODY, not
/// a path param (docs/api/API_CONVENTIONS.md documents a `PUT .../criteria/:area` that does
/// not actually exist — implementation wins, see docs/DECISIONS.md / PHASE_F04 report).
export interface UpsertCriterionInput {
  area: string;
  currentScore?: number;
  targetScore?: number;
  priority?: string;
  recommendation?: string;
  evidenceDocumentId?: string;
}
