"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as contractsApi from "./api";
import type { ContractListParams, CreateAmendmentInput, CreateContractInput, UpdateContractInput } from "./types";

function invalidateContract(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
}

export function useContracts(params: ContractListParams) {
  return useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: () => contractsApi.listContracts(params),
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id ?? ""),
    queryFn: () => contractsApi.getContract(id as string),
    enabled: !!id,
  });
}

export function useContractAmendments(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contracts.amendments(id ?? ""),
    queryFn: () => contractsApi.listContractAmendments(id as string),
    enabled: !!id,
  });
}

export function useContractTemplates(enabled: boolean) {
  return useQuery({
    queryKey: ["contract-templates"],
    queryFn: () => contractsApi.listContractTemplates(),
    enabled,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) => contractsApi.createContract(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() }),
  });
}

export function useUpdateContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateContractInput) => contractsApi.updateContract(id, input),
    onSuccess: () => invalidateContract(queryClient, id),
  });
}

export function useSubmitContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => contractsApi.submitContract(id),
    onSuccess: () => invalidateContract(queryClient, id),
  });
}

export function useApproveContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => contractsApi.approveContract(id, reason),
    onSuccess: () => invalidateContract(queryClient, id),
  });
}

export function useRejectContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => contractsApi.rejectContract(id, reason),
    onSuccess: () => invalidateContract(queryClient, id),
  });
}

export function useSendContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => contractsApi.sendContract(id),
    onSuccess: () => invalidateContract(queryClient, id),
  });
}

export function useSignContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signedDocumentId: string) => contractsApi.signContract(id, signedDocumentId),
    onSuccess: () => invalidateContract(queryClient, id),
  });
}

export function useUpdateContractStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => contractsApi.updateContractStatus(id, status, reason),
    onSuccess: () => invalidateContract(queryClient, id),
  });
}

export function useCreateContractAmendment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAmendmentInput) => contractsApi.createContractAmendment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.amendments(id) });
      invalidateContract(queryClient, id);
    },
  });
}
