/// Mirrors `database/schema.prisma` `WritingArtifact`/`WritingVersion`. `Comment` reuses
/// F03's shared entity (`POST/GET .../comments`) — see `lib/timeline/types.ts`'s
/// `TimelineEntry` for the equivalent shape; this is a direct (unmerged) comment list, not a
/// timeline, so it's typed separately here.

export type WritingStatus = "DRAFT" | "REVIEW" | "REVISION" | "FINAL" | "SUBMITTED";
export const WRITING_STATUSES: WritingStatus[] = ["DRAFT", "REVIEW", "REVISION", "FINAL", "SUBMITTED"];

export type WritingReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

export interface WritingVersion {
  id: string;
  artifactId: string;
  versionNumber: number;
  createdById: string;
  changeSummary: string | null;
  content: string | null;
  documentId: string | null;
  reviewStatus: WritingReviewStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface WritingArtifact {
  id: string;
  caseId: string;
  type: string;
  title: string;
  status: WritingStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  versions: WritingVersion[];
}

export interface WritingComment {
  id: string;
  entityType: string;
  entityId: string;
  authorId: string;
  body: string;
  visibility: string;
  createdAt: string;
}

export interface CreateWritingArtifactInput {
  type: string;
  title: string;
  ownerId?: string;
  content?: string;
}

/// Always creates a NEW row — there is no "edit version content" endpoint (F04 instruction
/// §29: "Không có Edit Final direct mutation").
export interface CreateWritingVersionInput {
  content?: string;
  documentId?: string;
  changeSummary?: string;
}
