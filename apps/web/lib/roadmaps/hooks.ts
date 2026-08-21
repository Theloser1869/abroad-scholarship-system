"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as roadmapsApi from "./api";
import type { CreateMilestoneInput, CreateRoadmapInput, UpdateMilestoneInput } from "./types";

function invalidateRoadmap(queryClient: QueryClient, id: string, caseId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.listForCase(caseId) });
}

function invalidateMilestone(queryClient: QueryClient, milestoneId: string, roadmapId: string, caseId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.milestoneDetail(milestoneId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.milestones(roadmapId) });
  invalidateRoadmap(queryClient, roadmapId, caseId);
}

export function useRoadmapsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roadmaps.listForCase(caseId ?? ""),
    queryFn: () => roadmapsApi.listRoadmapsForCase(caseId as string),
    enabled: !!caseId,
  });
}

export function useRoadmap(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roadmaps.detail(id ?? ""),
    queryFn: () => roadmapsApi.getRoadmap(id as string),
    enabled: !!id,
  });
}

export function useCreateRoadmap(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoadmapInput) => roadmapsApi.createRoadmap(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.listForCase(caseId) }),
  });
}

export function useSubmitRoadmap(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => roadmapsApi.submitRoadmap(id),
    onSuccess: () => invalidateRoadmap(queryClient, id, caseId),
  });
}

export function useApproveRoadmap(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => roadmapsApi.approveRoadmap(id, reason),
    onSuccess: () => invalidateRoadmap(queryClient, id, caseId),
  });
}

export function useRejectRoadmap(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => roadmapsApi.rejectRoadmap(id, reason),
    onSuccess: () => invalidateRoadmap(queryClient, id, caseId),
  });
}

export function useUpdateRoadmapStatus(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => roadmapsApi.updateRoadmapStatus(id, status),
    onSuccess: () => invalidateRoadmap(queryClient, id, caseId),
  });
}

export function useCreateMilestone(roadmapId: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilestoneInput) => roadmapsApi.createMilestone(roadmapId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.milestones(roadmapId) });
      invalidateRoadmap(queryClient, roadmapId, caseId);
    },
  });
}

export function useUpdateMilestone(id: string, roadmapId: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMilestoneInput) => roadmapsApi.updateMilestone(id, input),
    onSuccess: () => invalidateMilestone(queryClient, id, roadmapId, caseId),
  });
}

export function useUpdateMilestoneStatus(id: string, roadmapId: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => roadmapsApi.updateMilestoneStatus(id, status),
    onSuccess: () => invalidateMilestone(queryClient, id, roadmapId, caseId),
  });
}

export function useAddMilestoneDependency(id: string, roadmapId: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependsOnMilestoneId: string) => roadmapsApi.addMilestoneDependency(id, dependsOnMilestoneId),
    onSuccess: () => invalidateMilestone(queryClient, id, roadmapId, caseId),
  });
}

export function useRemoveMilestoneDependency(id: string, roadmapId: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependsOnMilestoneId: string) => roadmapsApi.removeMilestoneDependency(id, dependsOnMilestoneId),
    onSuccess: () => invalidateMilestone(queryClient, id, roadmapId, caseId),
  });
}
