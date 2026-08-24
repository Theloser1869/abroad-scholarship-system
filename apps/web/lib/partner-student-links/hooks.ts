"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as partnerStudentLinksApi from "./api";
import type { CreatePartnerStudentLinkInput, PartnerStudentLinkListParams, UpdatePartnerStudentLinkInput } from "./types";

export function usePartnerStudentLinksForPartner(partnerId: string, params: PartnerStudentLinkListParams) {
  return useQuery({
    queryKey: queryKeys.partnerStudentLinks.listForPartner(partnerId, params),
    queryFn: () => partnerStudentLinksApi.listPartnerStudentLinksForPartner(partnerId, params),
    enabled: !!partnerId,
  });
}

export function usePartnerStudentLinksForStudent(studentId: string, params: PartnerStudentLinkListParams) {
  return useQuery({
    queryKey: queryKeys.partnerStudentLinks.listForStudent(studentId, params),
    queryFn: () => partnerStudentLinksApi.listPartnerStudentLinksForStudent(studentId, params),
    enabled: !!studentId,
  });
}

export function usePartnerStudentLink(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.partnerStudentLinks.detail(id ?? ""),
    queryFn: () => partnerStudentLinksApi.getPartnerStudentLink(id as string),
    enabled: !!id,
  });
}

export function useCreatePartnerStudentLink(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePartnerStudentLinkInput) => partnerStudentLinksApi.createPartnerStudentLink(partnerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.partnerStudentLinks.all }),
  });
}

function invalidatePartnerStudentLink(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.partnerStudentLinks.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.partnerStudentLinks.all });
}

export function useUpdatePartnerStudentLink(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePartnerStudentLinkInput) => partnerStudentLinksApi.updatePartnerStudentLink(id, input),
    onSuccess: () => invalidatePartnerStudentLink(queryClient, id),
  });
}

export function useArchivePartnerStudentLink(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => partnerStudentLinksApi.archivePartnerStudentLink(id),
    onSuccess: () => invalidatePartnerStudentLink(queryClient, id),
  });
}
