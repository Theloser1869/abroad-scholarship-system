"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as commissionRulesApi from "./api";
import type { CommissionRuleListParams, CreateCommissionRuleInput, UpdateCommissionRuleInput } from "./types";

export function useCommissionRules(partnerId: string, params: CommissionRuleListParams) {
  return useQuery({
    queryKey: queryKeys.commissionRules.listForPartner(partnerId, params),
    queryFn: () => commissionRulesApi.listCommissionRules(partnerId, params),
    enabled: !!partnerId,
  });
}

export function useCommissionRule(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.commissionRules.detail(id ?? ""),
    queryFn: () => commissionRulesApi.getCommissionRule(id as string),
    enabled: !!id,
  });
}

export function useCreateCommissionRule(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommissionRuleInput) => commissionRulesApi.createCommissionRule(partnerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.commissionRules.all }),
  });
}

function invalidateCommissionRule(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.commissionRules.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.commissionRules.all });
}

export function useUpdateCommissionRule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCommissionRuleInput) => commissionRulesApi.updateCommissionRule(id, input),
    onSuccess: () => invalidateCommissionRule(queryClient, id),
  });
}

export function useActivateCommissionRule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commissionRulesApi.activateCommissionRule(id),
    onSuccess: () => invalidateCommissionRule(queryClient, id),
  });
}

export function useDeactivateCommissionRule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commissionRulesApi.deactivateCommissionRule(id),
    onSuccess: () => invalidateCommissionRule(queryClient, id),
  });
}
