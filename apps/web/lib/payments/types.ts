/// Mirrors `database/schema.prisma` `Payment` + `PaymentsService`'s server-computed fields
/// (`outstandingAmount`, `isOverdue` — `PaymentWithComputed`, never re-derived client-side,
/// F04 instruction §10/§13). All Decimal fields serialize as JSON strings, typed `string`
/// here, never `number` (F04 instruction §38).

export type PaymentStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "REFUNDED" | "WAIVED";

export interface Payment {
  id: string;
  paymentCode: string;
  contractId: string;
  installmentNo: number;
  amount: string;
  currency: string;
  dueDate: string;
  paidAmount: string;
  paidDate: string | null;
  method: string | null;
  reference: string | null;
  status: PaymentStatus;
  receiptDocumentId: string | null;
  refundedAmount: string;
  refundedAt: string | null;
  refundedById: string | null;
  refundReason: string | null;
  waivedAt: string | null;
  waivedById: string | null;
  waivedReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** `max(amount - (paidAmount - refundedAmount), 0)` — computed server-side only. */
  outstandingAmount: string;
  /** `status ∈ {PENDING,PARTIALLY_PAID,OVERDUE} AND dueDate < now` — computed server-side only. */
  isOverdue: boolean;
}

export interface PaymentListParams {
  page?: number;
  limit?: number;
  sort?: "dueDate" | "installmentNo" | "amount" | "status";
  status?: PaymentStatus;
  overdue?: boolean;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreatePaymentDto` — creates one installment on a SIGNED contract.
export interface CreatePaymentInput {
  installmentNo: number;
  amount: number;
  currency: string;
  dueDate: string;
}

/// Mirrors `RecordPaymentDto`. `allowOverpayment` is the explicit confirm-checkbox offered
/// only after a first attempt comes back `409 OVERPAYMENT_NOT_ALLOWED` (F04 instruction §13 —
/// never client-pre-decided).
export interface RecordPaymentInput {
  amount: number;
  paidDate?: string;
  method?: string;
  reference?: string;
  allowOverpayment?: boolean;
}

/// Mirrors `RefundPaymentDto`.
export interface RefundPaymentInput {
  amount: number;
  reason: string;
  reference?: string;
}

/// Mirrors `WaivePaymentDto`.
export interface WaivePaymentInput {
  reason: string;
}
