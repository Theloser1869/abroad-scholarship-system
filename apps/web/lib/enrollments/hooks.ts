"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as enrollmentsApi from "./api";
import type { ConfirmEnrollmentInput, CreateEnrollmentInput, UpdateEnrollmentInput } from "./types";

export function useEnrollmentsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.enrollments.listForCase(caseId ?? ""),
    queryFn: () => enrollmentsApi.listEnrollmentsForCase(caseId as string),
    enabled: !!caseId,
  });
}

export function useEnrollment(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.enrollments.detail(id ?? ""),
    queryFn: () => enrollmentsApi.getEnrollment(id as string),
    enabled: !!id,
  });
}

export function useCreateEnrollment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEnrollmentInput) => enrollmentsApi.createEnrollment(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.listForCase(caseId) }),
  });
}

function invalidateEnrollment(queryClient: QueryClient, id: string, caseId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.listForCase(caseId) });
}

export function useUpdateEnrollment(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEnrollmentInput) => enrollmentsApi.updateEnrollment(id, input),
    onSuccess: () => invalidateEnrollment(queryClient, id, caseId),
  });
}

export function useConfirmEnrollment(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmEnrollmentInput) => enrollmentsApi.confirmEnrollment(id, input),
    onSuccess: () => invalidateEnrollment(queryClient, id, caseId),
  });
}

export function useWithdrawEnrollment(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => enrollmentsApi.withdrawEnrollment(id),
    onSuccess: () => invalidateEnrollment(queryClient, id, caseId),
  });
}
