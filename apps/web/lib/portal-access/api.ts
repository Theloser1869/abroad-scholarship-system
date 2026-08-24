import { apiFetch } from "../api/client";
import type { AcceptParentInvitationInput, AcceptParentInvitationResult } from "./types";

/// `@Public()` on the backend (`PublicParentInvitationsController`) — the invited parent has
/// no session yet by definition; the raw token itself IS the authorization, same pattern as
/// the F04 contract-review-link flow. Never gated behind `RequireAuth`.
export function acceptParentInvitation(token: string, input: AcceptParentInvitationInput): Promise<AcceptParentInvitationResult> {
  return apiFetch<AcceptParentInvitationResult>(`/public/portal/parent-invitations/${token}/accept`, { method: "POST", body: input });
}
