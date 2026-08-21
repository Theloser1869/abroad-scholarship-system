"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as assessmentsApi from "./api";
import type { CreateAssessmentInput, UpsertCriterionInput } from "./types";

function invalidateAssessment(queryClient: QueryClient, id: string, caseId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.assessments.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.assessments.listForCase(caseId) });
}

export function useAssessmentsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assessments.listForCase(caseId ?? ""),
    queryFn: () => assessmentsApi.listAssessmentsForCase(caseId as string),
    enabled: !!caseId,
  });
}

export function useAssessment(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assessments.detail(id ?? ""),
    queryFn: () => assessmentsApi.getAssessment(id as string),
    enabled: !!id,
  });
}

export function useCreateAssessment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssessmentInput) => assessmentsApi.createAssessment(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.assessments.listForCase(caseId) }),
  });
}

export function useSubmitAssessment(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => assessmentsApi.submitAssessment(id),
    onSuccess: () => invalidateAssessment(queryClient, id, caseId),
  });
}

export function useApproveAssessment(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => assessmentsApi.approveAssessment(id, reason),
    onSuccess: () => invalidateAssessment(queryClient, id, caseId),
  });
}

export function useRejectAssessment(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => assessmentsApi.rejectAssessment(id, reason),
    onSuccess: () => invalidateAssessment(queryClient, id, caseId),
  });
}

export function useUpsertCriterion(assessmentId: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCriterionInput) => assessmentsApi.upsertCriterion(assessmentId, input),
    onSuccess: () => invalidateAssessment(queryClient, assessmentId, caseId),
  });
}
