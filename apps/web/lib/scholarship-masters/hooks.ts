"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as scholarshipMastersApi from "./api";
import type { CreateScholarshipMasterInput, ScholarshipMasterListParams, UpdateScholarshipMasterInput } from "./types";

export function useScholarshipMasters(params: ScholarshipMasterListParams) {
  return useQuery({
    queryKey: queryKeys.scholarshipMasters.list(params),
    queryFn: () => scholarshipMastersApi.listScholarshipMasters(params),
  });
}

export function useScholarshipMaster(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scholarshipMasters.detail(id ?? ""),
    queryFn: () => scholarshipMastersApi.getScholarshipMaster(id as string),
    enabled: !!id,
  });
}

export function useCreateScholarshipMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScholarshipMasterInput) => scholarshipMastersApi.createScholarshipMaster(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipMasters.lists() }),
  });
}

export function useUpdateScholarshipMaster(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateScholarshipMasterInput) => scholarshipMastersApi.updateScholarshipMaster(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipMasters.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipMasters.lists() });
    },
  });
}

export function useVerifyScholarshipMaster(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => scholarshipMastersApi.verifyScholarshipMaster(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipMasters.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipMasters.lists() });
    },
  });
}
