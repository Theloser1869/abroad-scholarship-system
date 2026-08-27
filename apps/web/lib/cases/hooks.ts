"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as casesApi from "./api";
import type { AddCaseMemberInput, CaseListParams, UpdateCaseStageInput } from "./types";

export function useCases(params: CaseListParams) {
  return useQuery({
    queryKey: queryKeys.cases.list(params),
    queryFn: () => casesApi.listCases(params),
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.detail(id ?? ""),
    queryFn: () => casesApi.getCase(id as string),
    enabled: !!id,
  });
}

export function useCaseTimeline(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.timeline(id ?? ""),
    queryFn: () => casesApi.getCaseTimeline(id as string),
    enabled: !!id,
  });
}

export function useCaseMembers(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.members(id ?? ""),
    queryFn: () => casesApi.listCaseMembers(id as string),
    enabled: !!id,
  });
}

export function useUpdateCaseStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCaseStageInput) => casesApi.updateCaseStage(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(id) });
    },
  });
}

export function useUpdateCaseStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => casesApi.updateCaseStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(id) });
    },
  });
}

export function useAddCaseMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddCaseMemberInput) => casesApi.addCaseMember(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.members(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(id) });
    },
  });
}

export function useRemoveCaseMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => casesApi.removeCaseMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.members(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(id) });
    },
  });
}

export function useReassignCaseOwner(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => casesApi.reassignCaseOwner(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.members(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(id) });
    },
  });
}

export function useAddCaseNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, visibility }: { body: string; visibility?: "internal" | "shared" }) =>
      casesApi.addCaseNote(id, body, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.timeline(id) });
    },
  });
}
