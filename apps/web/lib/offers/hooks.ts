"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import * as offersApi from "./api";
import type { CreateOfferInput, RespondOfferInput } from "./types";

export function useOffersForApplication(applicationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offers.listForApplication(applicationId ?? ""),
    queryFn: () => offersApi.listOffersForApplication(applicationId as string),
    enabled: !!applicationId,
  });
}

export function useCurrentOffer(applicationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offers.current(applicationId ?? ""),
    queryFn: () => offersApi.getCurrentOffer(applicationId as string),
    enabled: !!applicationId,
  });
}

export function useOffer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offers.detail(id ?? ""),
    queryFn: () => offersApi.getOffer(id as string),
    enabled: !!id,
  });
}

/// A new Offer transitions the parent Application to OFFER status server-side — invalidates
/// the Application's own detail too, not just the offer list (F05 instruction §29 example:
/// "Offer accept → invalidate offers + application summary").
function invalidateOffersForApplication(queryClient: QueryClient, applicationId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.offers.listForApplication(applicationId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.offers.current(applicationId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) });
}

export function useCreateOffer(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferInput) => offersApi.createOffer(applicationId, input),
    onSuccess: () => invalidateOffersForApplication(queryClient, applicationId),
  });
}

export function useRespondToOffer(id: string, applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RespondOfferInput) => offersApi.respondToOffer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offers.detail(id) });
      invalidateOffersForApplication(queryClient, applicationId);
    },
  });
}
