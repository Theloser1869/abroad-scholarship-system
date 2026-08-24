"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as applicationsApi from "./api";
import type { ApplicationListParams, CreateApplicationInput, CreateChecklistItemInput, SubmitApplicationInput, UpdateApplicationInput, UpdateChecklistItemInput } from "./types";

export function useApplicationsForCase(caseId: string, params: ApplicationListParams) {
  return useQuery({
    queryKey: queryKeys.applications.listForCase(caseId, params),
    queryFn: () => applicationsApi.listApplicationsForCase(caseId, params),
    enabled: !!caseId,
  });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id ?? ""),
    queryFn: () => applicationsApi.getApplication(id as string),
    enabled: !!id,
  });
}

export function useCreateApplication(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApplicationInput) => applicationsApi.createApplication(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
  });
}

function invalidateApplication(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
}

export function useUpdateApplication(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateApplicationInput) => applicationsApi.updateApplication(id, input),
    onSuccess: () => invalidateApplication(queryClient, id),
  });
}

export function useSubmitApplication(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitApplicationInput) => applicationsApi.submitApplication(id, input),
    onSuccess: () => invalidateApplication(queryClient, id),
  });
}

export function useUpdateApplicationStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => applicationsApi.updateApplicationStatus(id, status, reason),
    onSuccess: () => invalidateApplication(queryClient, id),
  });
}

/// Checklist items are embedded on the Application detail response — mutations invalidate
/// the parent Application's own detail query (which re-fetches the checklist alongside it),
/// not a separate always-stale checklist cache entry.
export function useCreateChecklistItem(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChecklistItemInput) => applicationsApi.createChecklistItem(applicationId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) }),
  });
}

export function useUpdateChecklistItem(id: string, applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateChecklistItemInput) => applicationsApi.updateChecklistItem(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) }),
  });
}
