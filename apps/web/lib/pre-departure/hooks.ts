"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as preDepartureApi from "./api";
import type { CreatePreDepartureItemInput, UpdatePreDepartureItemInput } from "./types";

export function usePreDepartureItems(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.preDeparture.listForCase(caseId ?? ""),
    queryFn: () => preDepartureApi.listPreDepartureItems(caseId as string),
    enabled: !!caseId,
  });
}

export function useCreatePreDepartureItem(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePreDepartureItemInput) => preDepartureApi.createPreDepartureItem(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.preDeparture.listForCase(caseId) }),
  });
}

export function useUpdatePreDepartureItem(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePreDepartureItemInput) => preDepartureApi.updatePreDepartureItem(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.preDeparture.listForCase(caseId) }),
  });
}
