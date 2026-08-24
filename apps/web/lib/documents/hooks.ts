"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as documentsApi from "./api";
import type { ShareDocumentInput, UpdateDocumentInput, UploadDocumentInput } from "./types";

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id ?? ""),
    queryFn: () => documentsApi.getDocument(id as string),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  return useMutation({
    mutationFn: ({ input, file }: { input: UploadDocumentInput; file: File }) => documentsApi.uploadDocument(input, file),
  });
}

export function useUpdateDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDocumentInput) => documentsApi.updateDocument(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(id) }),
  });
}

export function useShareDocument(id: string) {
  return useMutation({
    mutationFn: (input: ShareDocumentInput) => documentsApi.shareDocument(id, input),
  });
}

export function useArchiveDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => documentsApi.archiveDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(id) }),
  });
}

/// Creating a version produces a brand-new Document row/id — there is nothing at the OLD id
/// to invalidate (it becomes an immutable predecessor), so this deliberately has no
/// `onSuccess` cache write; the caller navigates to the new document's own id instead.
export function useCreateDocumentVersion(id: string) {
  return useMutation({
    mutationFn: (file: File) => documentsApi.createDocumentVersion(id, file),
  });
}
