import { apiFetch } from "../api/client";
import type { CreateMilestoneInput, CreateRoadmapInput, Roadmap, RoadmapMilestone, UpdateMilestoneInput } from "./types";

/// Typed calls against `apps/api/src/modules/counseling/roadmaps/{roadmaps,milestones}.controller.ts`.

export function listRoadmapsForCase(caseId: string): Promise<Roadmap[]> {
  return apiFetch<Roadmap[]>(`/cases/${caseId}/roadmaps`);
}

export function getRoadmap(id: string): Promise<Roadmap> {
  return apiFetch<Roadmap>(`/roadmaps/${id}`);
}

export function createRoadmap(caseId: string, input: CreateRoadmapInput): Promise<Roadmap> {
  return apiFetch<Roadmap>(`/cases/${caseId}/roadmaps`, { method: "POST", body: input });
}

export function submitRoadmap(id: string): Promise<Roadmap> {
  return apiFetch<Roadmap>(`/roadmaps/${id}/submit`, { method: "POST" });
}

/// `409 ASSESSMENT_BASELINE_REQUIRED`/`ASSESSMENT_BASELINE_NOT_APPROVED` surfaced verbatim —
/// SRS 6.5 "Roadmap chỉ được approve khi assessment baseline tồn tại," never pre-checked here.
export function approveRoadmap(id: string, reason?: string): Promise<Roadmap> {
  return apiFetch<Roadmap>(`/roadmaps/${id}/approve`, { method: "POST", body: { reason } });
}

export function rejectRoadmap(id: string, reason: string): Promise<Roadmap> {
  return apiFetch<Roadmap>(`/roadmaps/${id}/reject`, { method: "POST", body: { reason } });
}

export function updateRoadmapStatus(id: string, status: string): Promise<Roadmap> {
  return apiFetch<Roadmap>(`/roadmaps/${id}/status`, { method: "PATCH", body: { status } });
}

export function listMilestones(roadmapId: string): Promise<RoadmapMilestone[]> {
  return apiFetch<RoadmapMilestone[]>(`/roadmaps/${roadmapId}/milestones`);
}

export function getMilestone(id: string): Promise<RoadmapMilestone> {
  return apiFetch<RoadmapMilestone>(`/milestones/${id}`);
}

export function createMilestone(roadmapId: string, input: CreateMilestoneInput): Promise<RoadmapMilestone> {
  return apiFetch<RoadmapMilestone>(`/roadmaps/${roadmapId}/milestones`, { method: "POST", body: input });
}

export function updateMilestone(id: string, input: UpdateMilestoneInput): Promise<RoadmapMilestone> {
  return apiFetch<RoadmapMilestone>(`/milestones/${id}`, { method: "PATCH", body: input });
}

/// `409 PREREQUISITE_NOT_DONE` for a DONE attempt with unmet dependencies/tasks — surfaced
/// verbatim, never pre-checked client-side (F04 instruction §20/§21).
export function updateMilestoneStatus(id: string, status: string): Promise<RoadmapMilestone> {
  return apiFetch<RoadmapMilestone>(`/milestones/${id}/status`, { method: "PATCH", body: { status } });
}

export function addMilestoneDependency(id: string, dependsOnMilestoneId: string): Promise<{ added: boolean }> {
  return apiFetch<{ added: boolean }>(`/milestones/${id}/dependencies`, { method: "POST", body: { dependsOnMilestoneId } });
}

export function removeMilestoneDependency(id: string, dependsOnMilestoneId: string): Promise<{ removed: boolean }> {
  return apiFetch<{ removed: boolean }>(`/milestones/${id}/dependencies/${dependsOnMilestoneId}`, { method: "DELETE" });
}
