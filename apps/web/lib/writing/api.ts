import { apiFetch } from "../api/client";
import type { CreateWritingArtifactInput, CreateWritingVersionInput, WritingArtifact, WritingComment, WritingReviewStatus } from "./types";

/// Typed calls against `apps/api/src/modules/counseling/writing/writing-artifacts.controller.ts`.

export function listWritingArtifactsForCase(caseId: string): Promise<WritingArtifact[]> {
  return apiFetch<WritingArtifact[]>(`/cases/${caseId}/writing-artifacts`);
}

/// Includes `.versions` — there is no separate versions-list endpoint (implementation
/// discrepancy vs. docs/api/API_CONVENTIONS.md, see docs/frontend/phase-status/PHASE_F04.md).
export function getWritingArtifact(id: string): Promise<WritingArtifact> {
  return apiFetch<WritingArtifact>(`/writing-artifacts/${id}`);
}

export function createWritingArtifact(caseId: string, input: CreateWritingArtifactInput): Promise<WritingArtifact> {
  return apiFetch<WritingArtifact>(`/cases/${caseId}/writing-artifacts`, { method: "POST", body: input });
}

/// FSM-validated server-side — `409 INVALID_WRITING_STATUS_TRANSITION` for anything outside
/// DRAFT→REVIEW→{REVISION,FINAL}→...→SUBMITTED, never pre-validated here.
export function updateWritingStatus(id: string, status: string): Promise<WritingArtifact> {
  return apiFetch<WritingArtifact>(`/writing-artifacts/${id}/status`, { method: "PATCH", body: { status } });
}

/// Always a new row — `409 WRITING_ARTIFACT_SUBMITTED` once terminal.
export function createWritingVersion(artifactId: string, input: CreateWritingVersionInput) {
  return apiFetch(`/writing-artifacts/${artifactId}/versions`, { method: "POST", body: input });
}

export function reviewWritingVersion(versionId: string, reviewStatus: WritingReviewStatus) {
  return apiFetch(`/writing-versions/${versionId}/review`, { method: "POST", body: { reviewStatus } });
}

export function listWritingVersionComments(versionId: string): Promise<WritingComment[]> {
  return apiFetch<WritingComment[]>(`/writing-versions/${versionId}/comments`);
}

export function addWritingVersionComment(versionId: string, body: string, visibility: "internal" | "shared" = "internal") {
  return apiFetch(`/writing-versions/${versionId}/comments`, { method: "POST", body: { body, visibility } });
}
