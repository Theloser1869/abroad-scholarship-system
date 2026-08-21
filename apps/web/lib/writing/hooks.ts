"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as writingApi from "./api";
import type { CreateWritingArtifactInput, CreateWritingVersionInput, WritingReviewStatus } from "./types";

export function useWritingArtifactsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.writingArtifacts.listForCase(caseId ?? ""),
    queryFn: () => writingApi.listWritingArtifactsForCase(caseId as string),
    enabled: !!caseId,
  });
}

export function useWritingArtifact(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.writingArtifacts.detail(id ?? ""),
    queryFn: () => writingApi.getWritingArtifact(id as string),
    enabled: !!id,
  });
}

export function useCreateWritingArtifact(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWritingArtifactInput) => writingApi.createWritingArtifact(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.writingArtifacts.listForCase(caseId) }),
  });
}

export function useUpdateWritingStatus(id: string, caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => writingApi.updateWritingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.writingArtifacts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.writingArtifacts.listForCase(caseId) });
    },
  });
}

export function useCreateWritingVersion(artifactId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWritingVersionInput) => writingApi.createWritingVersion(artifactId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.writingArtifacts.detail(artifactId) }),
  });
}

export function useReviewWritingVersion(versionId: string, artifactId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewStatus: WritingReviewStatus) => writingApi.reviewWritingVersion(versionId, reviewStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.writingArtifacts.detail(artifactId) }),
  });
}

export function useWritingVersionComments(versionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.writingArtifacts.versionComments(versionId ?? ""),
    queryFn: () => writingApi.listWritingVersionComments(versionId as string),
    enabled: !!versionId,
  });
}

export function useAddWritingVersionComment(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, visibility }: { body: string; visibility?: "internal" | "shared" }) =>
      writingApi.addWritingVersionComment(versionId, body, visibility),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.writingArtifacts.versionComments(versionId) }),
  });
}
