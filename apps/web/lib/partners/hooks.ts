"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as partnersApi from "./api";
import type { CreatePartnerInput, PartnerListParams, UpdatePartnerInput } from "./types";

export function usePartners(params: PartnerListParams) {
  return useQuery({
    queryKey: queryKeys.partners.list(params),
    queryFn: () => partnersApi.listPartners(params),
  });
}

export function usePartner(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.partners.detail(id ?? ""),
    queryFn: () => partnersApi.getPartner(id as string),
    enabled: !!id,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePartnerInput) => partnersApi.createPartner(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.partners.lists() }),
  });
}

export function useUpdatePartner(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePartnerInput) => partnersApi.updatePartner(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.lists() });
    },
  });
}

export function useArchivePartner(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => partnersApi.archivePartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.lists() });
    },
  });
}
