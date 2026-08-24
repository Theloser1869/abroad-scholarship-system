/// Mirrors `database/schema.prisma` `Offer`. Belongs to exactly one Application; an
/// Application may carry multiple Offer rows over time — a revised/renegotiated offer is a
/// NEW row, never overwriting a prior one's history (F05 instruction §20). `status`
/// includes `WITHDRAWN` in the enum but no current backend code path ever sets it
/// (confirmed against `offers.service.ts`) — rendered defensively if ever seen, no UI path
/// produces it. `depositAmount` is a Decimal field, typed `string`, display-only.

export type OfferStatus = "RECEIVED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN";
export type OfferDecision = "ACCEPT" | "DECLINE";

export interface Offer {
  id: string;
  applicationId: string;
  offerType: string;
  offerDate: string | null;
  acceptanceDeadline: string | null;
  depositAmount: string | null;
  depositCurrency: string | null;
  isConditional: boolean;
  conditions: string | null;
  status: OfferStatus;
  respondedAt: string | null;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/// Mirrors `CreateOfferDto` exactly. `offerType` is free text (Unconditional/Conditional/
/// Deferred/...), never a hard-coded dropdown — no configurable-type master-data endpoint
/// exists for it (same precedent as `WritingArtifact.type`).
export interface CreateOfferInput {
  offerType: string;
  offerDate?: string;
  acceptanceDeadline?: string;
  depositAmount?: number;
  depositCurrency?: string;
  isConditional?: boolean;
  conditions?: string;
  evidenceDocumentId?: string;
}

export interface RespondOfferInput {
  decision: OfferDecision;
}
