/// Mirrors `database/schema.prisma` `CommissionTransaction` + the Partner/Student-summary
/// embed added in `apps/api/.../commission-transactions.service.ts` (docs/DECISIONS.md
/// DEC-12). The actual financial fact (`CommissionRule` above is config; this is what
/// happened). `basis`/`basisAmount`/`rate`/`calculatedAmount`/`currency` are SNAPSHOTTED at
/// `calculate()` time from whichever CommissionRule matched — a later edit to the rule never
/// rewrites a transaction's own history. All Decimal fields are typed `string`, NEVER
/// `number` — the frontend must not perform authoritative money math on them anywhere
/// (F06 instruction §24), only format for display via the shared `Money` component.
/// `studentId`/`caseId`/`applicationId` are nullable convenience FKs. PAID and CANCELLED are
/// both terminal — no adjustment/reversal mechanism exists.

export type CommissionTransactionStatus = "PENDING" | "ELIGIBLE" | "CALCULATED" | "APPROVED" | "PAYABLE" | "PAID" | "CANCELLED";
export const TERMINAL_COMMISSION_TRANSACTION_STATUSES: CommissionTransactionStatus[] = ["PAID", "CANCELLED"];

/// Backend's real server-side FSM (`commission-transactions.service.ts`) — used only to
/// decide which action buttons render; the backend independently re-validates and is the
/// sole authority (F06 instruction §23).
export const COMMISSION_TRANSACTION_TRANSITIONS: Record<CommissionTransactionStatus, string[]> = {
  PENDING: ["confirm-eligibility", "cancel"],
  ELIGIBLE: ["calculate", "cancel"],
  CALCULATED: ["approve", "cancel"],
  APPROVED: ["mark-payable", "cancel"],
  PAYABLE: ["pay", "cancel"],
  PAID: [],
  CANCELLED: [],
};

export type CommissionSourceType = "Contract" | "Payment";

export interface CommissionTransactionPartnerSummary {
  id: string;
  name: string;
  countryCode: string;
}

export interface CommissionTransactionStudentSummary {
  id: string;
  studentCode: string;
  fullName: string;
}

export interface CommissionTransaction {
  id: string;
  partnerId: string;
  partner: CommissionTransactionPartnerSummary;
  commissionRuleId: string | null;
  studentId: string | null;
  student: CommissionTransactionStudentSummary | null;
  caseId: string | null;
  applicationId: string | null;
  sourceType: CommissionSourceType;
  sourceId: string | null;
  basis: string | null;
  basisAmount: string | null;
  rate: string | null;
  calculatedAmount: string | null;
  currency: string;
  status: CommissionTransactionStatus;
  paidAt: string | null;
  paymentReference: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionTransactionListParams {
  page?: number;
  limit?: number;
  partnerId?: string;
  status?: CommissionTransactionStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateCommissionTransactionDto` exactly.
export interface CreateCommissionTransactionInput {
  sourceType: CommissionSourceType;
  sourceId: string;
  partnerProgramId?: string;
  commissionRuleId?: string;
  studentId?: string;
  caseId?: string;
  applicationId?: string;
}

/// Only while PENDING — never touches money/status.
export interface UpdateCommissionTransactionLinkageInput {
  studentId?: string;
  caseId?: string;
  applicationId?: string;
}

export interface PayCommissionTransactionInput {
  paymentReference: string;
  paidAt?: string;
}

export interface CancelCommissionTransactionInput {
  reason: string;
}

/// `409 PARTNER_STUDENT_LINK_REQUIRED` — a real, non-obvious precondition: commission
/// cannot be attributed to a partner with no active PartnerStudentLink to the source
/// student, surfaced verbatim, never pre-validated.
export interface PartnerStudentLinkRequiredError {
  code: "PARTNER_STUDENT_LINK_REQUIRED";
  message: string;
}

/// `409 DUPLICATE_COMMISSION_TRANSACTION` on a repeat, non-cancelled transaction for the
/// same (sourceType, sourceId, rule).
export interface DuplicateCommissionTransactionError {
  code: "DUPLICATE_COMMISSION_TRANSACTION";
  message: string;
  existingTransactionId: string;
}

/// `409 INVALID_COMMISSION_TRANSACTION_STATE` — a prose message naming the required status
/// list, unlike Application/Visa/ScholarshipApplication's `allowedTransitions` array (this
/// entity's dedicated actions don't return one — confirmed against the live service).
export interface InvalidCommissionTransactionStateError {
  code: "INVALID_COMMISSION_TRANSACTION_STATE";
  message: string;
}
