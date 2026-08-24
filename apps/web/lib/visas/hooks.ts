"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as visasApi from "./api";
import type {
  CreateVisaChecklistItemInput,
  CreateVisaInput,
  RecordInterviewInput,
  RecordVisaResultInput,
  ScheduleAppointmentInput,
  SubmitVisaInput,
  UpdateVisaChecklistItemInput,
  UpdateVisaInput,
  VisaListParams,
} from "./types";

export function useVisasForCase(caseId: string, params: VisaListParams) {
  return useQuery({
    queryKey: queryKeys.visas.listForCase(caseId, params),
    queryFn: () => visasApi.listVisasForCase(caseId, params),
    enabled: !!caseId,
  });
}

export function useVisa(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.visas.detail(id ?? ""),
    queryFn: () => visasApi.getVisa(id as string),
    enabled: !!id,
  });
}

export function useCreateVisa(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVisaInput) => visasApi.createVisa(caseId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visas.all }),
  });
}

function invalidateVisa(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.visas.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.visas.all });
}

export function useUpdateVisa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVisaInput) => visasApi.updateVisa(id, input),
    onSuccess: () => invalidateVisa(queryClient, id),
  });
}

export function useUpdateVisaStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => visasApi.updateVisaStatus(id, status),
    onSuccess: () => invalidateVisa(queryClient, id),
  });
}

export function useSubmitVisa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitVisaInput) => visasApi.submitVisa(id, input),
    onSuccess: () => invalidateVisa(queryClient, id),
  });
}

export function useScheduleVisaAppointment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleAppointmentInput) => visasApi.scheduleVisaAppointment(id, input),
    onSuccess: () => invalidateVisa(queryClient, id),
  });
}

export function useRecordVisaInterview(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordInterviewInput) => visasApi.recordVisaInterview(id, input),
    onSuccess: () => invalidateVisa(queryClient, id),
  });
}

export function useRecordVisaResult(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordVisaResultInput) => visasApi.recordVisaResult(id, input),
    onSuccess: () => invalidateVisa(queryClient, id),
  });
}

export function useVisaChecklist(visaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.visas.checklist(visaId ?? ""),
    queryFn: () => visasApi.listVisaChecklist(visaId as string),
    enabled: !!visaId,
  });
}

export function useCreateVisaChecklistItem(visaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVisaChecklistItemInput) => visasApi.createVisaChecklistItem(visaId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visas.checklist(visaId) }),
  });
}

export function useUpdateVisaChecklistItem(id: string, visaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVisaChecklistItemInput) => visasApi.updateVisaChecklistItem(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visas.checklist(visaId) }),
  });
}
