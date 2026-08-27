/// Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014) — mirrors
/// `apps/api/src/modules/case-management/closure/closure.service.ts`'s `ClosureStatus`.

export type ClosureChecklistItemStatus = "PASS" | "FAIL" | "NOT_APPLICABLE";
export type ClosureChecklistItemKey = "DEBT" | "OPEN_TASKS" | "VISA" | "ENROLLMENT" | "PRE_DEPARTURE" | "DOCUMENT_HANDOVER";

export interface ClosureChecklistItem {
  key: ClosureChecklistItemKey;
  status: ClosureChecklistItemStatus;
  detail?: string;
}

export interface ClosureHandoverStatus {
  status: "PENDING" | "COMPLETED";
  handedOverAt: string | null;
  recipientName: string | null;
  notes: string | null;
}

export interface ClosureLiquidationStatus {
  status: "PENDING" | "LIQUIDATED";
  companyConfirmedAt: string | null;
  studentParentConfirmedAt: string | null;
}

export interface ClosureStatus {
  caseId: string;
  caseCode: string;
  caseStatus: string;
  checklist: ClosureChecklistItem[];
  readyToClose: boolean;
  handover: ClosureHandoverStatus;
  liquidation: ClosureLiquidationStatus | null;
}

export interface RequestClosureInput {
  reason: string;
}

export interface ConfirmHandoverInput {
  recipientName?: string;
  notes?: string;
  overrideReason?: string;
}

export interface ExecuteClosureInput {
  closureReason: string;
  overrideReason?: string;
}
