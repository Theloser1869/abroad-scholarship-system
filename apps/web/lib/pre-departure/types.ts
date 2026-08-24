import type { CreateVisaChecklistItemInput as BaseCreateInput, UpdateVisaChecklistItemInput as BaseUpdateInput, VisaChecklistItem } from "../visas/types";

/// Pre-departure is the identical `VisaChecklistItem` model (`entityType: 'PreDeparture'`,
/// `entityId: caseId`) — **no separate PreDeparture model exists in the database at all**
/// (confirmed directly against `database/schema.prisma`; `PreDepartureService.listForCase`
/// returns a plain `VisaChecklistItem[]`, not a singular record). F06 instruction §12/§13's
/// "overview/progress/status" is therefore item-by-item checklist state — there is no
/// separate "pre-departure complete" flag or action anywhere; the only place completeness is
/// actually enforced is Case Closure (`409 PRE_DEPARTURE_CHECKLIST_INCOMPLETE`, F03/F04
/// scope, unchanged here). Re-exported (not duplicated) from `lib/visas/types.ts`.
export type PreDepartureItem = VisaChecklistItem;

/// Adds `category` (used here — suggested passport/visa/flight/insurance/accommodation/
/// airport-transfer/orientation/emergency-contact/tuition-deposit/travel-documents groupings,
/// always free text, never a hard-coded enum) on top of the shared checklist-item shape.
export interface CreatePreDepartureItemInput extends BaseCreateInput {
  category?: string;
}

export interface UpdatePreDepartureItemInput extends BaseUpdateInput {
  category?: string;
}
