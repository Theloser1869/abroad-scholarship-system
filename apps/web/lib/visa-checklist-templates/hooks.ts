"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as visaChecklistTemplatesApi from "./api";
import type { CreateVisaChecklistTemplateInput, UpdateVisaChecklistTemplateInput, VisaChecklistTemplateListParams } from "./types";

export function useVisaChecklistTemplates(params: VisaChecklistTemplateListParams) {
  return useQuery({
    queryKey: queryKeys.visaChecklistTemplates.list(params),
    queryFn: () => visaChecklistTemplatesApi.listVisaChecklistTemplates(params),
  });
}

export function useVisaChecklistTemplate(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.visaChecklistTemplates.detail(id ?? ""),
    queryFn: () => visaChecklistTemplatesApi.getVisaChecklistTemplate(id as string),
    enabled: !!id,
  });
}

export function useCreateVisaChecklistTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVisaChecklistTemplateInput) => visaChecklistTemplatesApi.createVisaChecklistTemplate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visaChecklistTemplates.lists() }),
  });
}

export function useUpdateVisaChecklistTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVisaChecklistTemplateInput) => visaChecklistTemplatesApi.updateVisaChecklistTemplate(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visaChecklistTemplates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.visaChecklistTemplates.lists() });
    },
  });
}
