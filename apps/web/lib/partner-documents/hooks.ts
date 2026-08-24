"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as partnerDocumentsApi from "./api";
import type { CreatePartnerDocumentInput, PartnerDocumentListParams, UpdatePartnerDocumentInput } from "./types";

export function usePartnerDocuments(partnerId: string, params: PartnerDocumentListParams) {
  return useQuery({
    queryKey: queryKeys.partnerDocuments.listForPartner(partnerId, params),
    queryFn: () => partnerDocumentsApi.listPartnerDocuments(partnerId, params),
    enabled: !!partnerId,
  });
}

export function usePartnerDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.partnerDocuments.detail(id ?? ""),
    queryFn: () => partnerDocumentsApi.getPartnerDocument(id as string),
    enabled: !!id,
  });
}

export function useCreatePartnerDocument(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePartnerDocumentInput) => partnerDocumentsApi.createPartnerDocument(partnerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.partnerDocuments.all }),
  });
}

function invalidatePartnerDocument(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.partnerDocuments.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.partnerDocuments.all });
}

export function useUpdatePartnerDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePartnerDocumentInput) => partnerDocumentsApi.updatePartnerDocument(id, input),
    onSuccess: () => invalidatePartnerDocument(queryClient, id),
  });
}

export function useActivatePartnerDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => partnerDocumentsApi.activatePartnerDocument(id),
    onSuccess: () => invalidatePartnerDocument(queryClient, id),
  });
}

export function useArchivePartnerDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => partnerDocumentsApi.archivePartnerDocument(id),
    onSuccess: () => invalidatePartnerDocument(queryClient, id),
  });
}
