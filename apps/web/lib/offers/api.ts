import { apiFetch } from "../api/client";
import type { CreateOfferInput, Offer, RespondOfferInput } from "./types";

/// Typed calls against `ApplicationOffersController`/`OffersController`
/// (`apps/api/.../offers.controller.ts`). Plain array response, not paginated. Every read
/// (`listForApplication`/`getById`/`getCurrent`) lazily sweeps RECEIVED→EXPIRED past
/// `acceptanceDeadline` server-side first — never a frontend-computed expiry.

export function listOffersForApplication(applicationId: string): Promise<Offer[]> {
  return apiFetch<Offer[]>(`/applications/${applicationId}/offers`);
}

/// Backend-computed "current offer" — the ACCEPTED offer if one exists, else the most
/// recently RECEIVED, else `null`. Never derived client-side from "latest date"
/// (F05 instruction §18).
export function getCurrentOffer(applicationId: string): Promise<Offer | null> {
  return apiFetch<Offer | null>(`/applications/${applicationId}/offers/current`);
}

export function getOffer(id: string): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}`);
}

/// Requires the parent Application to be SUBMITTED/WAITLIST/OFFER server-side
/// (`409 OFFER_REQUIRES_SUBMITTED_APPLICATION` otherwise) — transitions the Application to
/// OFFER status as a side effect, never a separate frontend-issued status change.
export function createOffer(applicationId: string, input: CreateOfferInput): Promise<Offer> {
  return apiFetch<Offer>(`/applications/${applicationId}/offers`, { method: "POST", body: input });
}

/// NOT idempotent — a second respond call on an already-ACCEPTED/DECLINED offer is a real
/// `409 INVALID_OFFER_STATE`, never a silent no-op success (confirmed directly against
/// `OffersService.respond`; overrides any "accept twice = success" assumption).
export function respondToOffer(id: string, input: RespondOfferInput): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}/respond`, { method: "POST", body: input });
}
