"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import { markNotificationRead } from "../notifications/notifications-api";
import * as portalApi from "./api";
import type { PortalListParams, PortalTaskStatusTarget } from "./types";

export function usePortalMe(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.portal.me(), queryFn: portalApi.getPortalMe, enabled });
}

/// F09 hardening (instruction §15/§27) — this is `PortalStudentShell`'s own authorization
/// probe (F08), not just a profile display: a mount within the app's default 30s
/// `staleTime` window (`lib/api/query-client.ts`) would otherwise serve a cached response
/// without re-asking the backend, which is the wrong tradeoff for the one query every other
/// Portal request's authorization gate depends on — a revoked parent must be re-checked on
/// every navigation, not up to 30s stale. `staleTime: 0` here only affects THIS query.
export function usePortalProfile(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.profile(studentId ?? ""),
    queryFn: () => portalApi.getPortalProfile(studentId as string),
    enabled: !!studentId,
    staleTime: 0,
  });
}

export function usePortalRoadmap(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.roadmap(studentId ?? ""),
    queryFn: () => portalApi.getPortalRoadmap(studentId as string),
    enabled: !!studentId,
  });
}

export function useSubmitMilestoneEvidence(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { milestoneId: string; documentId: string }) => portalApi.submitMilestoneEvidence(studentId, input.milestoneId, input.documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.portal.student.roadmap(studentId) }),
  });
}

export function usePortalTasks(studentId: string | undefined, params: PortalListParams) {
  return useQuery({
    queryKey: queryKeys.portal.student.tasks(studentId ?? "", params),
    queryFn: () => portalApi.listPortalTasks(studentId as string, params),
    enabled: !!studentId,
  });
}

export function usePortalTask(studentId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.taskDetail(studentId ?? "", taskId ?? ""),
    queryFn: () => portalApi.getPortalTask(studentId as string, taskId as string),
    enabled: !!studentId && !!taskId,
  });
}

function invalidatePortalTask(queryClient: QueryClient, studentId: string, taskId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.portal.student.taskDetail(studentId, taskId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.portal.student.all(studentId), exact: false, predicate: (q) => q.queryKey[3] === "tasks" });
}

export function useSubmitPortalTaskOutput(studentId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (output: string) => portalApi.submitPortalTaskOutput(studentId, taskId, output),
    onSuccess: () => invalidatePortalTask(queryClient, studentId, taskId),
  });
}

export function useUpdatePortalTaskStatus(studentId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: PortalTaskStatusTarget) => portalApi.updatePortalTaskStatus(studentId, taskId, status),
    onSuccess: () => invalidatePortalTask(queryClient, studentId, taskId),
  });
}

export function usePortalDocuments(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.documents(studentId ?? ""),
    queryFn: () => portalApi.listPortalDocuments(studentId as string),
    enabled: !!studentId,
  });
}

export function usePortalApplications(studentId: string | undefined, params: PortalListParams) {
  return useQuery({
    queryKey: queryKeys.portal.student.applications(studentId ?? "", params),
    queryFn: () => portalApi.listPortalApplications(studentId as string, params),
    enabled: !!studentId,
  });
}

export function usePortalApplication(studentId: string | undefined, applicationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.applicationDetail(studentId ?? "", applicationId ?? ""),
    queryFn: () => portalApi.getPortalApplication(studentId as string, applicationId as string),
    enabled: !!studentId && !!applicationId,
  });
}

export function useSubmitChecklistEvidence(studentId: string, applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { checklistItemId: string; documentId: string }) => portalApi.submitChecklistEvidence(studentId, input.checklistItemId, input.documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.portal.student.applicationDetail(studentId, applicationId) }),
  });
}

export function usePortalScholarships(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.scholarships(studentId ?? ""),
    queryFn: () => portalApi.listPortalScholarships(studentId as string),
    enabled: !!studentId,
  });
}

export function usePortalScholarship(studentId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.scholarshipDetail(studentId ?? "", id ?? ""),
    queryFn: () => portalApi.getPortalScholarship(studentId as string, id as string),
    enabled: !!studentId && !!id,
  });
}

export function usePortalVisas(studentId: string | undefined, params: PortalListParams) {
  return useQuery({
    queryKey: queryKeys.portal.student.visas(studentId ?? "", params),
    queryFn: () => portalApi.listPortalVisas(studentId as string, params),
    enabled: !!studentId,
  });
}

export function usePortalVisa(studentId: string | undefined, visaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.visaDetail(studentId ?? "", visaId ?? ""),
    queryFn: () => portalApi.getPortalVisa(studentId as string, visaId as string),
    enabled: !!studentId && !!visaId,
  });
}

export function usePortalPreDeparture(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.preDeparture(studentId ?? ""),
    queryFn: () => portalApi.getPortalPreDeparture(studentId as string),
    enabled: !!studentId,
  });
}

export function usePortalEnrollments(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portal.student.enrollment(studentId ?? ""),
    queryFn: () => portalApi.getPortalEnrollments(studentId as string),
    enabled: !!studentId,
  });
}

export function usePortalContracts(studentId: string | undefined, params: PortalListParams) {
  return useQuery({
    queryKey: queryKeys.portal.student.contracts(studentId ?? "", params),
    queryFn: () => portalApi.listPortalContracts(studentId as string, params),
    enabled: !!studentId,
  });
}

export function usePortalContractPayments(studentId: string | undefined, contractId: string | undefined, params: PortalListParams) {
  return useQuery({
    queryKey: queryKeys.portal.student.payments(studentId ?? "", contractId ?? "", params),
    queryFn: () => portalApi.listPortalContractPayments(studentId as string, contractId as string, params),
    enabled: !!studentId && !!contractId,
  });
}

export function usePortalNotifications(studentId: string | undefined, params: PortalListParams) {
  return useQuery({
    queryKey: queryKeys.portal.student.notifications(studentId ?? "", params),
    queryFn: () => portalApi.listPortalNotifications(studentId as string, params),
    enabled: !!studentId,
  });
}

/// Reuses F07's recipient-scoped `markNotificationRead` (`PATCH /notifications/:id/read`) —
/// there is no Portal-specific mark-read endpoint, and none is needed (the inbox is the same
/// one regardless of which student context the URL names). Invalidates the current student's
/// notification list/unread-count together, same "mark read → invalidate list + unread
/// count" rule F07 established.
export function useMarkPortalNotificationRead(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.student.all(studentId), exact: false, predicate: (q) => q.queryKey[3] === "notifications" });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
