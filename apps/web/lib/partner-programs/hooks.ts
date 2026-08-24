"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as partnerProgramsApi from "./api";
import type { CreatePartnerProgramInput, PartnerProgramListParams, UpdatePartnerProgramInput } from "./types";

export function usePartnerPrograms(partnerId: string, params: PartnerProgramListParams) {
  return useQuery({
    queryKey: queryKeys.partnerPrograms.listForPartner(partnerId, params),
    queryFn: () => partnerProgramsApi.listPartnerPrograms(partnerId, params),
    enabled: !!partnerId,
  });
}

export function usePartnerProgram(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.partnerPrograms.detail(id ?? ""),
    queryFn: () => partnerProgramsApi.getPartnerProgram(id as string),
    enabled: !!id,
  });
}

export function useCreatePartnerProgram(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePartnerProgramInput) => partnerProgramsApi.createPartnerProgram(partnerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.partnerPrograms.all }),
  });
}

export function useUpdatePartnerProgram(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePartnerProgramInput) => partnerProgramsApi.updatePartnerProgram(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partnerPrograms.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.partnerPrograms.all });
    },
  });
}

export function useArchivePartnerProgram(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => partnerProgramsApi.archivePartnerProgram(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partnerPrograms.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.partnerPrograms.all });
    },
  });
}
