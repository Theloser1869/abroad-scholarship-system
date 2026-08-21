import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreatePaymentInput, Payment, PaymentListParams, RecordPaymentInput, RefundPaymentInput, WaivePaymentInput } from "./types";

/// Typed calls against `apps/api/src/modules/commercial/payments/payments.controller.ts`.
/// No bare `GET /payments` list exists — installments are always browsed via their parent
/// Contract (docs/frontend/FRONTEND_ROUTES.md "Payments" note); `getPayment` is used for the
/// single-record detail dialog.

export function listPaymentsForContract(contractId: string, params: PaymentListParams): Promise<PaginatedResponse<Payment>> {
  return apiFetch<PaginatedResponse<Payment>>(`/contracts/${contractId}/payments`, { query: params });
}

export function getPayment(id: string): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${id}`);
}

export function createPayment(contractId: string, input: CreatePaymentInput): Promise<Payment> {
  return apiFetch<Payment>(`/contracts/${contractId}/payments`, { method: "POST", body: input });
}

/// `409 OVERPAYMENT_NOT_ALLOWED { outstandingBeforePayment }` surfaced verbatim on a first
/// attempt without `allowOverpayment: true` — the caller decides whether to resubmit with it,
/// never pre-decided here.
export function recordPayment(id: string, input: RecordPaymentInput): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${id}/record`, { method: "POST", body: input });
}

export function refundPayment(id: string, input: RefundPaymentInput): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${id}/refund`, { method: "POST", body: input });
}

export function waivePayment(id: string, input: WaivePaymentInput): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${id}/waive`, { method: "POST", body: input });
}
