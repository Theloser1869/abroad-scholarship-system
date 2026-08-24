"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as universityChoicesApi from "./api";
import type { CreateUniversityChoiceInput, ReviewUniversityChoiceInput, UpdateUniversityChoiceInput } from "./types";

export function useUniversityChoicesForStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.universityChoices.listForStudent(studentId ?? ""),
    queryFn: () => universityChoicesApi.listUniversityChoicesForStudent(studentId as string),
    enabled: !!studentId,
  });
}

export function useUniversityChoice(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.universityChoices.detail(id ?? ""),
    queryFn: () => universityChoicesApi.getUniversityChoice(id as string),
    enabled: !!id,
  });
}

export function useCreateUniversityChoice(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUniversityChoiceInput) => universityChoicesApi.createUniversityChoice(studentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.universityChoices.listForStudent(studentId) }),
  });
}

function invalidateUniversityChoice(queryClient: ReturnType<typeof useQueryClient>, id: string, studentId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.universityChoices.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.universityChoices.listForStudent(studentId) });
}

export function useUpdateUniversityChoice(id: string, studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUniversityChoiceInput) => universityChoicesApi.updateUniversityChoice(id, input),
    onSuccess: () => invalidateUniversityChoice(queryClient, id, studentId),
  });
}

export function useReviewUniversityChoice(id: string, studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewUniversityChoiceInput) => universityChoicesApi.reviewUniversityChoice(id, input),
    onSuccess: () => invalidateUniversityChoice(queryClient, id, studentId),
  });
}
