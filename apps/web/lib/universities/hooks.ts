"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as universitiesApi from "./api";
import type { CreateUniversityInput, UniversityListParams, UpdateUniversityInput } from "./types";

export function useUniversities(params: UniversityListParams) {
  return useQuery({
    queryKey: queryKeys.universities.list(params),
    queryFn: () => universitiesApi.listUniversities(params),
  });
}

export function useUniversity(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.universities.detail(id ?? ""),
    queryFn: () => universitiesApi.getUniversity(id as string),
    enabled: !!id,
  });
}

export function useCreateUniversity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUniversityInput) => universitiesApi.createUniversity(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.universities.lists() }),
  });
}

export function useUpdateUniversity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUniversityInput) => universitiesApi.updateUniversity(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.universities.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.universities.lists() });
    },
  });
}

export function useVerifyUniversity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => universitiesApi.verifyUniversity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.universities.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.universities.lists() });
    },
  });
}
