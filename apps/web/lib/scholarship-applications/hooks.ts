"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as scholarshipApplicationsApi from "./api";
import type { AwardScholarshipInput, ConfirmEligibilityInput, CreateScholarshipApplicationInput, UpdateScholarshipApplicationInput } from "./types";

export function useScholarshipApplicationsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scholarshipApplications.listForCase(caseId ?? ""),
    queryFn: () => scholarshipApplicationsApi.listScholarshipApplicationsForCase(caseId as string),
    enabled: !!caseId,
  });
}

export function useScholarshipApplication(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scholarshipApplications.detail(id ?? ""),
    queryFn: () => scholarshipApplicationsApi.getScholarshipApplication(id as string),
    enabled: !!id,
  });
}

export function useCreateScholarshipApplication(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScholarshipApplicationInput) => scholarshipApplicationsApi.createScholarshipApplication(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipApplications.listForCase(caseId) }),
  });
}

function invalidateScholarshipApplication(queryClient: QueryClient, id: string, caseId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipApplications.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipApplications.listForCase(caseId) });
}

export function useUpdateScholarshipApplication(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateScholarshipApplicationInput) => scholarshipApplicationsApi.updateScholarshipApplication(id, input),
    onSuccess: () => invalidateScholarshipApplication(queryClient, id, caseId),
  });
}

export function useConfirmScholarshipEligibility(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmEligibilityInput) => scholarshipApplicationsApi.confirmScholarshipEligibility(id, input),
    onSuccess: () => invalidateScholarshipApplication(queryClient, id, caseId),
  });
}

export function useUpdateScholarshipApplicationStatus(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => scholarshipApplicationsApi.updateScholarshipApplicationStatus(id, status),
    onSuccess: () => invalidateScholarshipApplication(queryClient, id, caseId),
  });
}

export function useAwardScholarship(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AwardScholarshipInput) => scholarshipApplicationsApi.awardScholarship(id, input),
    onSuccess: () => invalidateScholarshipApplication(queryClient, id, caseId),
  });
}

export function useRejectScholarshipApplication(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => scholarshipApplicationsApi.rejectScholarshipApplication(id),
    onSuccess: () => invalidateScholarshipApplication(queryClient, id, caseId),
  });
}
