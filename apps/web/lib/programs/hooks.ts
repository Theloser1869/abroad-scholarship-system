"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as programsApi from "./api";
import type { CreateProgramInput, ProgramListParams, UpdateProgramInput } from "./types";

export function usePrograms(params: ProgramListParams) {
  return useQuery({
    queryKey: queryKeys.programs.list(params),
    queryFn: () => programsApi.listPrograms(params),
  });
}

export function useProgram(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.programs.detail(id ?? ""),
    queryFn: () => programsApi.getProgram(id as string),
    enabled: !!id,
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProgramInput) => programsApi.createProgram(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.programs.lists() }),
  });
}

export function useUpdateProgram(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProgramInput) => programsApi.updateProgram(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.lists() });
    },
  });
}

export function useVerifyProgram(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => programsApi.verifyProgram(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.lists() });
    },
  });
}
