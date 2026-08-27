"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as closureApi from "./api";
import type { ConfirmHandoverInput, ExecuteClosureInput, RequestClosureInput } from "./types";

export function useClosureStatus(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.closure.detail(caseId ?? ""),
    queryFn: () => closureApi.getClosureStatus(caseId as string),
    enabled: !!caseId,
  });
}

function invalidateClosure(queryClient: ReturnType<typeof useQueryClient>, caseId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.closure.detail(caseId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(caseId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.cases.lists() });
}

export function useRequestClosure(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestClosureInput) => closureApi.requestClosure(caseId, input),
    onSuccess: () => invalidateClosure(queryClient, caseId),
  });
}

export function useConfirmHandover(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmHandoverInput) => closureApi.confirmHandover(caseId, input),
    onSuccess: () => invalidateClosure(queryClient, caseId),
  });
}

export function useExecuteClosure(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExecuteClosureInput) => closureApi.executeClosure(caseId, input),
    onSuccess: () => invalidateClosure(queryClient, caseId),
  });
}

export function useConfirmLiquidationCompany(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (overrideReason?: string) => closureApi.confirmLiquidationCompany(caseId, overrideReason),
    onSuccess: () => invalidateClosure(queryClient, caseId),
  });
}
