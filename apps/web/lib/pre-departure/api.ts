import { apiFetch } from "../api/client";
import type { CreatePreDepartureItemInput, PreDepartureItem, UpdatePreDepartureItemInput } from "./types";

/// Typed calls against `CasePreDepartureController`/`PreDepartureItemController`
/// (`apps/api/.../pre-departure.controller.ts`). No completion/"mark done" action exists for
/// the checklist as a whole — only per-item status (F06 instruction §13: never compute
/// overdue/complete client-side, reflect the server's own per-item state).

export function listPreDepartureItems(caseId: string): Promise<PreDepartureItem[]> {
  return apiFetch<PreDepartureItem[]>(`/cases/${caseId}/pre-departure`);
}

export function createPreDepartureItem(caseId: string, input: CreatePreDepartureItemInput): Promise<PreDepartureItem> {
  return apiFetch<PreDepartureItem>(`/cases/${caseId}/pre-departure`, { method: "POST", body: input });
}

export function updatePreDepartureItem(id: string, input: UpdatePreDepartureItemInput): Promise<PreDepartureItem> {
  return apiFetch<PreDepartureItem>(`/pre-departure-items/${id}`, { method: "PATCH", body: input });
}
