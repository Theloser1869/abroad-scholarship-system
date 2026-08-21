"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as lorApi from "./api";
import type { CreateLorInput, UpdateLorInput } from "./types";

const lorKeys = {
  listForCase: (caseId: string) => ["lor", "list", caseId] as const,
};

export function useLorForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: lorKeys.listForCase(caseId ?? ""),
    queryFn: () => lorApi.listLorForCase(caseId as string),
    enabled: !!caseId,
  });
}

export function useCreateLor(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLorInput) => lorApi.createLor(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lorKeys.listForCase(caseId) }),
  });
}

export function useUpdateLor(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLorInput) => lorApi.updateLor(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lorKeys.listForCase(caseId) }),
  });
}
