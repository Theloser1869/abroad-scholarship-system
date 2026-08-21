"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as api from "./api";
import type {
  CreateAcademicRecordInput,
  CreateActivityInput,
  CreateCompetitionInput,
  CreateResearchProjectInput,
  CreateTestRecordInput,
  UpdateAcademicRecordInput,
  UpdateActivityInput,
  UpdateCompetitionInput,
  UpdateResearchProjectInput,
  UpdateTestRecordInput,
} from "./types";

function invalidateKind(queryClient: QueryClient, kind: string, id: string, caseId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.profileEvidence.detail(kind, id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.profileEvidence.listForCase(kind, caseId) });
}

// --- Academic ---
export function useAcademicRecordsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileEvidence.listForCase("academic", caseId ?? ""),
    queryFn: () => api.listAcademicRecordsForCase(caseId as string),
    enabled: !!caseId,
  });
}
export function useCreateAcademicRecord(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAcademicRecordInput) => api.createAcademicRecord(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileEvidence.listForCase("academic", caseId) }),
  });
}
export function useUpdateAcademicRecord(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAcademicRecordInput) => api.updateAcademicRecord(id, input),
    onSuccess: () => invalidateKind(queryClient, "academic", id, caseId),
  });
}
export function useVerifyAcademicRecord(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.verifyAcademicRecord(id),
    onSuccess: () => invalidateKind(queryClient, "academic", id, caseId),
  });
}

// --- Test records ---
export function useTestRecordsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileEvidence.listForCase("test", caseId ?? ""),
    queryFn: () => api.listTestRecordsForCase(caseId as string),
    enabled: !!caseId,
  });
}
export function useCreateTestRecord(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTestRecordInput) => api.createTestRecord(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileEvidence.listForCase("test", caseId) }),
  });
}
export function useUpdateTestRecord(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTestRecordInput) => api.updateTestRecord(id, input),
    onSuccess: () => invalidateKind(queryClient, "test", id, caseId),
  });
}
export function useVerifyTestRecord(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.verifyTestRecord(id),
    onSuccess: () => invalidateKind(queryClient, "test", id, caseId),
  });
}

// --- Competitions ---
export function useCompetitionsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileEvidence.listForCase("competition", caseId ?? ""),
    queryFn: () => api.listCompetitionsForCase(caseId as string),
    enabled: !!caseId,
  });
}
export function useCreateCompetition(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompetitionInput) => api.createCompetition(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileEvidence.listForCase("competition", caseId) }),
  });
}
export function useUpdateCompetition(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompetitionInput) => api.updateCompetition(id, input),
    onSuccess: () => invalidateKind(queryClient, "competition", id, caseId),
  });
}

// --- Research projects ---
export function useResearchProjectsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileEvidence.listForCase("research", caseId ?? ""),
    queryFn: () => api.listResearchProjectsForCase(caseId as string),
    enabled: !!caseId,
  });
}
export function useCreateResearchProject(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateResearchProjectInput) => api.createResearchProject(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileEvidence.listForCase("research", caseId) }),
  });
}
export function useUpdateResearchProject(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateResearchProjectInput) => api.updateResearchProject(id, input),
    onSuccess: () => invalidateKind(queryClient, "research", id, caseId),
  });
}

// --- Activities ---
export function useActivitiesForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileEvidence.listForCase("activity", caseId ?? ""),
    queryFn: () => api.listActivitiesForCase(caseId as string),
    enabled: !!caseId,
  });
}
export function useCreateActivity(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivityInput) => api.createActivity(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileEvidence.listForCase("activity", caseId) }),
  });
}
export function useUpdateActivity(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateActivityInput) => api.updateActivity(id, input),
    onSuccess: () => invalidateKind(queryClient, "activity", id, caseId),
  });
}
export function useVerifyActivity(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.verifyActivity(id),
    onSuccess: () => invalidateKind(queryClient, "activity", id, caseId),
  });
}
