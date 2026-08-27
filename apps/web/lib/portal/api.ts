import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { DocumentRecord } from "../documents/types";
import type { NotificationRecord } from "../notifications/types";
import type { RoadmapMilestone } from "../roadmaps/types";
import type {
  PortalApplicationDetail,
  PortalClosureStatus,
  PortalListParams,
  PortalLiquidationStatus,
  PortalMeResponse,
  PortalProfile,
  PortalRoadmap,
  PortalTask,
  PortalTaskStatusTarget,
} from "./types";
import type { Application, ApplicationChecklistItem, Contract, Enrollment, Payment, ScholarshipApplication, Visa, VisaChecklistItem } from "./types";

/// Typed calls against `apps/api/src/modules/portal/portal/portal.controller.ts` — every
/// path/shape here is transcribed directly from the live controller, never invented ahead of
/// it (F08 instruction §2). `studentId` is always a real path segment the backend
/// independently re-verifies via `ScopePolicyService.assertStudentAccessible` — this module
/// never decides on its own whether a given studentId is allowed (F08 instruction §5).

export function getPortalMe(): Promise<PortalMeResponse> {
  return apiFetch<PortalMeResponse>("/portal/me");
}

export function getPortalProfile(studentId: string): Promise<PortalProfile> {
  return apiFetch<PortalProfile>(`/portal/students/${studentId}`);
}

export function getPortalRoadmap(studentId: string): Promise<PortalRoadmap | null> {
  return apiFetch<PortalRoadmap | null>(`/portal/students/${studentId}/roadmap`);
}

/// The evidence document must already exist and have been uploaded by the calling principal
/// themselves (`409 DOCUMENT_NOT_OWNED` otherwise) — upload it first via `uploadDocument`
/// (`lib/documents/api.ts`, F07), then submit its id here.
export function submitMilestoneEvidence(studentId: string, milestoneId: string, documentId: string): Promise<RoadmapMilestone> {
  return apiFetch<RoadmapMilestone>(`/portal/students/${studentId}/roadmap/milestones/${milestoneId}/evidence`, {
    method: "POST",
    body: { documentId },
  });
}

export function listPortalTasks(studentId: string, params: PortalListParams): Promise<PaginatedResponse<PortalTask>> {
  return apiFetch<PaginatedResponse<PortalTask>>(`/portal/students/${studentId}/tasks`, { query: params });
}

export function getPortalTask(studentId: string, taskId: string): Promise<PortalTask> {
  return apiFetch<PortalTask>(`/portal/students/${studentId}/tasks/${taskId}`);
}

export function submitPortalTaskOutput(studentId: string, taskId: string, output: string): Promise<PortalTask> {
  return apiFetch<PortalTask>(`/portal/students/${studentId}/tasks/${taskId}/output`, { method: "PATCH", body: { output } });
}

/// Reuses the exact staff Task FSM server-side (`TasksService.portalUpdateStatus` calls the
/// same `applyStatusTransition` the generic status endpoint does) — this call can still fail
/// with `409 INVALID_TASK_STATUS_TRANSITION`, never pre-validated client-side.
export function updatePortalTaskStatus(studentId: string, taskId: string, status: PortalTaskStatusTarget): Promise<PortalTask> {
  return apiFetch<PortalTask>(`/portal/students/${studentId}/tasks/${taskId}/status`, { method: "POST", body: { status } });
}

/// No pagination — mirrors `DocumentsService.listAccessibleTo`'s plain array (exactly the
/// grants the caller currently holds, never a scan by owner entity — F08 instruction §17).
export function listPortalDocuments(studentId: string): Promise<DocumentRecord[]> {
  return apiFetch<DocumentRecord[]>(`/portal/students/${studentId}/documents`);
}

/// Step 1 of the same 2-step signed-download flow F04/F07 established — returns a
/// short-lived, backend-relative `downloadUrl`, never a permanent link.
export function requestPortalDocumentDownload(studentId: string, documentId: string): Promise<{ downloadUrl: string }> {
  return apiFetch<{ downloadUrl: string }>(`/portal/students/${studentId}/documents/${documentId}/download`);
}

export function listPortalApplications(studentId: string, params: PortalListParams): Promise<PaginatedResponse<Application>> {
  return apiFetch<PaginatedResponse<Application>>(`/portal/students/${studentId}/applications`, { query: params });
}

export function getPortalApplication(studentId: string, applicationId: string): Promise<PortalApplicationDetail> {
  return apiFetch<PortalApplicationDetail>(`/portal/students/${studentId}/applications/${applicationId}`);
}

export function submitChecklistEvidence(studentId: string, checklistItemId: string, documentId: string): Promise<ApplicationChecklistItem> {
  return apiFetch<ApplicationChecklistItem>(`/portal/students/${studentId}/applications/checklist/${checklistItemId}/evidence`, {
    method: "POST",
    body: { documentId },
  });
}

/// Plain array — mirrors `ScholarshipApplicationsService.listForCase`'s shape (no pagination
/// on this list anywhere in the app, staff or Portal).
export function listPortalScholarships(studentId: string): Promise<ScholarshipApplication[]> {
  return apiFetch<ScholarshipApplication[]>(`/portal/students/${studentId}/scholarships`);
}

export function getPortalScholarship(studentId: string, id: string): Promise<ScholarshipApplication> {
  return apiFetch<ScholarshipApplication>(`/portal/students/${studentId}/scholarships/${id}`);
}

export function listPortalVisas(studentId: string, params: PortalListParams): Promise<PaginatedResponse<Visa>> {
  return apiFetch<PaginatedResponse<Visa>>(`/portal/students/${studentId}/visa`, { query: params });
}

export function getPortalVisa(studentId: string, visaId: string): Promise<Visa> {
  return apiFetch<Visa>(`/portal/students/${studentId}/visa/${visaId}`);
}

/// Plain array — the identical `VisaChecklistItem` model as a Visa's own checklist
/// (`entityType: 'PreDeparture'`), no separate PreDeparture entity (same F06 finding, ASM-69
/// — Portal reuses the exact same backend service).
export function getPortalPreDeparture(studentId: string): Promise<VisaChecklistItem[]> {
  return apiFetch<VisaChecklistItem[]>(`/portal/students/${studentId}/pre-departure`);
}

export function getPortalEnrollments(studentId: string): Promise<Enrollment[]> {
  return apiFetch<Enrollment[]>(`/portal/students/${studentId}/enrollment`);
}

export function listPortalContracts(studentId: string, params: PortalListParams): Promise<PaginatedResponse<Contract>> {
  return apiFetch<PaginatedResponse<Contract>>(`/portal/students/${studentId}/contracts`, { query: params });
}

export function listPortalContractPayments(studentId: string, contractId: string, params: PortalListParams): Promise<PaginatedResponse<Payment>> {
  return apiFetch<PaginatedResponse<Payment>>(`/portal/students/${studentId}/contracts/${contractId}/payments`, { query: params });
}

/// Recipient-scoped, not actually student-scoped (`Notification.recipientId`) —
/// `PortalService.listNotifications` verifies `:studentId` purely for URL-path/404
/// consistency with every other Portal route; the underlying inbox returned is always the
/// CALLING principal's own, regardless of which student context the URL names (same inbox
/// `markNotificationRead`, F07's `lib/notifications/notifications-api.ts`, already reaches).
export function listPortalNotifications(studentId: string, params: PortalListParams): Promise<PaginatedResponse<NotificationRecord>> {
  return apiFetch<PaginatedResponse<NotificationRecord>>(`/portal/students/${studentId}/notifications`, { query: params });
}

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007) — read-only closure summary
/// (`PortalService.getClosure` strips `handover.notes`, the one field that might carry
/// internal staff commentary — every other field is already student/parent-safe).
export function getPortalClosure(studentId: string): Promise<PortalClosureStatus> {
  return apiFetch<PortalClosureStatus>(`/portal/students/${studentId}/closure`);
}

/// DEC-08 — the student/parent side of the two-party liquidation confirmation. Only
/// reachable once the linked Case is CLOSED; the acting party (self or an ACTIVE linked
/// parent) is resolved server-side, never client-supplied.
export function confirmPortalLiquidation(studentId: string): Promise<PortalLiquidationStatus> {
  return apiFetch<PortalLiquidationStatus>(`/portal/students/${studentId}/closure/liquidation/confirm`, { method: "POST" });
}
