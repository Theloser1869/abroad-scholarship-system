"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as commissionTransactionsApi from "./api";
import type {
  CancelCommissionTransactionInput,
  CommissionTransactionListParams,
  CreateCommissionTransactionInput,
  PayCommissionTransactionInput,
  UpdateCommissionTransactionLinkageInput,
} from "./types";

export function useCommissionTransactions(params: CommissionTransactionListParams) {
  return useQuery({
    queryKey: queryKeys.commissionTransactions.list(params),
    queryFn: () => commissionTransactionsApi.listCommissionTransactions(params),
  });
}

export function useCommissionTransactionsForPartner(partnerId: string, params: CommissionTransactionListParams) {
  return useQuery({
    queryKey: queryKeys.commissionTransactions.listForPartner(partnerId, params),
    queryFn: () => commissionTransactionsApi.listCommissionTransactionsForPartner(partnerId, params),
    enabled: !!partnerId,
  });
}

export function useCommissionTransaction(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.commissionTransactions.detail(id ?? ""),
    queryFn: () => commissionTransactionsApi.getCommissionTransaction(id as string),
    enabled: !!id,
  });
}

export function useCreateCommissionTransaction(partnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommissionTransactionInput) => commissionTransactionsApi.createCommissionTransaction(partnerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.commissionTransactions.all }),
  });
}

function invalidateCommissionTransaction(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.commissionTransactions.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.commissionTransactions.all });
}

export function useUpdateCommissionTransactionLinkage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCommissionTransactionLinkageInput) => commissionTransactionsApi.updateCommissionTransactionLinkage(id, input),
    onSuccess: () => invalidateCommissionTransaction(queryClient, id),
  });
}

export function useConfirmCommissionEligibility(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commissionTransactionsApi.confirmCommissionEligibility(id),
    onSuccess: () => invalidateCommissionTransaction(queryClient, id),
  });
}

export function useCalculateCommissionTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commissionTransactionsApi.calculateCommissionTransaction(id),
    onSuccess: () => invalidateCommissionTransaction(queryClient, id),
  });
}

export function useApproveCommissionTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commissionTransactionsApi.approveCommissionTransaction(id),
    onSuccess: () => invalidateCommissionTransaction(queryClient, id),
  });
}

export function useMarkCommissionTransactionPayable(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commissionTransactionsApi.markCommissionTransactionPayable(id),
    onSuccess: () => invalidateCommissionTransaction(queryClient, id),
  });
}

export function usePayCommissionTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PayCommissionTransactionInput) => commissionTransactionsApi.payCommissionTransaction(id, input),
    onSuccess: () => invalidateCommissionTransaction(queryClient, id),
  });
}

export function useCancelCommissionTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelCommissionTransactionInput) => commissionTransactionsApi.cancelCommissionTransaction(id, input),
    onSuccess: () => invalidateCommissionTransaction(queryClient, id),
  });
}
