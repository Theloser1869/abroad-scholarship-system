/// Mirrors `database/schema.prisma` `Roadmap`/`RoadmapMilestone`/`RoadmapMilestoneDependency`.

export type RoadmapStatus = "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

/// `PATCH /roadmaps/:id/status` only accepts these three — DRAFT/REVIEW/APPROVED are reached
/// via submit/approve/reject only (F04 instruction §20).
export type ManualRoadmapStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";
export const MANUAL_ROADMAP_STATUSES: ManualRoadmapStatus[] = ["ACTIVE", "COMPLETED", "ARCHIVED"];

export type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export const MILESTONE_STATUSES: MilestoneStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];

export interface RoadmapMilestone {
  id: string;
  roadmapId: string;
  stage: string | null;
  objective: string;
  metric: string | null;
  target: string | null;
  ownerRole: string | null;
  ownerId: string | null;
  startAt: string | null;
  deadline: string | null;
  status: MilestoneStatus;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Roadmap {
  id: string;
  caseId: string;
  assessmentId: string | null;
  version: number;
  horizonYears: number | null;
  status: RoadmapStatus;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  milestones: RoadmapMilestone[];
}

export interface CreateRoadmapInput {
  assessmentId?: string;
  horizonYears?: number;
}

export interface CreateMilestoneInput {
  stage?: string;
  objective: string;
  metric?: string;
  target?: string;
  ownerId?: string;
  startAt?: string;
  deadline?: string;
}

export type UpdateMilestoneInput = Partial<CreateMilestoneInput> & { evidenceDocumentId?: string };

/// A milestone's DONE transition requires every dependency milestone AND every linked Task
/// DONE/CANCELLED — `409 PREREQUISITE_NOT_DONE { unmetMilestoneIds, unmetTaskIds }` surfaced
/// verbatim, never pre-checked client-side.
export interface PrerequisiteNotDoneDetail {
  unmetMilestoneIds?: string[];
  unmetTaskIds?: string[];
}
