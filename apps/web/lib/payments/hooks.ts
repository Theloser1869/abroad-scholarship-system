"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as paymentsApi from "./api";
import type { CreatePaymentInput, PaymentListParams, RecordPaymentInput, RefundPaymentInput, WaivePaymentInput } from "./types";

/// A Payment mutation always invalidates its own detail query, the parent Contract's
/// installment list (every list is scoped to one `contractId`), and the parent Contract's own
/// detail query — `Contract.status` can move to ACTIVE/COMPLETED only once every installment
/// resolves, so a payment action can indirectly change what the Contract page shows too.
function invalidatePayment(queryClient: QueryClient, id: string, contractId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.payments.detail(id) });
  queryClient.invalidateQueries({ queryKey: [...queryKeys.payments.all, "list", contractId] });
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
}

export function usePaymentsForContract(contractId: string | undefined, params: PaymentListParams) {
  return useQuery({
    queryKey: queryKeys.payments.listForContract(contractId ?? "", params),
    queryFn: () => paymentsApi.listPaymentsForContract(contractId as string, params),
    enabled: !!contractId,
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id ?? ""),
    queryFn: () => paymentsApi.getPayment(id as string),
    enabled: !!id,
  });
}

export function useCreatePayment(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => paymentsApi.createPayment(contractId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.payments.all, "list", contractId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
    },
  });
}

export function useRecordPayment(id: string, contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => paymentsApi.recordPayment(id, input),
    onSuccess: () => invalidatePayment(queryClient, id, contractId),
  });
}

export function useRefundPayment(id: string, contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RefundPaymentInput) => paymentsApi.refundPayment(id, input),
    onSuccess: () => invalidatePayment(queryClient, id, contractId),
  });
}

export function useWaivePayment(id: string, contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WaivePaymentInput) => paymentsApi.waivePayment(id, input),
    onSuccess: () => invalidatePayment(queryClient, id, contractId),
  });
}
