"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as leadsApi from "./api";
import type { ConvertLeadInput, CreateLeadInput, LeadListParams, UpdateLeadInput } from "./types";

export function useLeads(params: LeadListParams) {
  return useQuery({
    queryKey: queryKeys.leads.list(params),
    queryFn: () => leadsApi.listLeads(params),
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leads.detail(id ?? ""),
    queryFn: () => leadsApi.getLead(id as string),
    enabled: !!id,
  });
}

export function useLeadTimeline(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leads.timeline(id ?? ""),
    queryFn: () => leadsApi.getLeadTimeline(id as string),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => leadsApi.createLead(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
    },
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLeadInput) => leadsApi.updateLead(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
    },
  });
}

export function useUpdateLeadStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => leadsApi.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.timeline(id) });
    },
  });
}

export function useAssignLeadOwner(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ownerId: string) => leadsApi.assignLeadOwner(id, ownerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
    },
  });
}

export function useConvertLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConvertLeadInput) => leadsApi.convertLead(id, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
      // A new Student(+Case) now exists — invalidate those lists too so a subsequent visit
      // to /students or /cases reflects the conversion immediately.
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      if (result.merged) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(result.student.id) });
      }
    },
  });
}

export function useAddLeadNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, visibility }: { body: string; visibility?: "internal" | "shared" }) =>
      leadsApi.addLeadNote(id, body, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.timeline(id) });
    },
  });
}
