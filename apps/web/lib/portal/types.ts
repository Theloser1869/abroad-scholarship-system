import type { Student } from "../students/types";
import type { Roadmap } from "../roadmaps/types";
import type { Application, ApplicationChecklistItem } from "../applications/types";
import type { Offer } from "../offers/types";
import type { ScholarshipApplication } from "../scholarship-applications/types";
import type { Visa } from "../visas/types";
import type { VisaChecklistItem } from "../visas/types";
import type { Enrollment } from "../enrollments/types";
import type { Contract } from "../contracts/types";
import type { Payment } from "../payments/types";

/// Mirrors `PortalController`/`PortalService`/`PortalAccessService`
/// (`apps/api/src/modules/portal/**`) exactly — every response shape here is the SAME
/// underlying domain entity every staff type already models (`Application`/`Visa`/
/// `Enrollment`/`Contract`/`Payment`/`ScholarshipApplication`/`Roadmap`), reused directly
/// rather than duplicated, since Portal delegates straight into the existing Phase 05-10
/// domain services with no parallel entity of its own (F08 instruction §2's own source
/// comment: "Portal chỉ là một lớp truy cập an toàn vào dữ liệu hiện có"). Only the few
/// genuinely Portal-specific shapes (the `/me` student-picker list, the redacted Task, the
/// Application-detail's `currentOffer` embed) get their own type below.

/// `GET /portal/me` — resolves the caller's own accessible student(s) without trusting any
/// client-supplied id. `relationship` is `"SELF"` when the caller IS the student, or the
/// `StudentContact.relationship` free-text value (e.g. "Mother"/"Father"/"Guardian",
/// defaulting to `"PARENT"`) when the caller is a linked parent — the ONLY place the
/// frontend distinguishes "am I the student or a parent," and it comes entirely from the
/// backend, never guessed from role/email/name (F08 instruction §28).
export interface PortalMeStudent {
  id: string;
  studentCode: string;
  fullName: string;
  relationship: string;
}

export interface PortalMeResponse {
  userId: string;
  roleCode: string;
  students: PortalMeStudent[];
}

/// `GET /portal/students/:id` — `FieldPolicyService.redactStudent`'s output; identical shape
/// to the staff `Student` type (budget/budgetCurrency come back `null` when redacted for this
/// role, same as everywhere else — no portal-only field exists on Student).
export type PortalProfile = Student;

/// `GET /portal/students/:id/roadmap` — the current (highest-version) Roadmap, with a
/// server-computed `progress` percentage over its own milestones. `null` when the student's
/// Case has no roadmap yet at all — rendered as an empty state, never a fabricated 0%.
export type PortalRoadmap = Roadmap & { progress: number };

/// `FieldPolicyService.redactTaskForPortal` — unconditional (every Portal Task response,
/// regardless of Student-vs-Parent), never role-varying. `blocker`/`qualityScore`/`ownerId`
/// are ALWAYS `null` here — "staff assignment"/"internal blocker context"/"internal quality
/// score" are explicitly staff-only (F08 instruction §15). `isOverdue` is the same
/// server-computed field every Task response carries (`TasksService.isOverdue`), never
/// re-derived client-side.
export interface PortalTask {
  id: string;
  taskCode: string;
  caseId: string | null;
  module: string;
  taskType: string;
  title: string;
  ownerId: null;
  priority: string | null;
  startAt: string | null;
  deadline: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  output: string | null;
  qualityScore: null;
  blocker: null;
  templateId: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  milestoneId: string | null;
  visibleToStudent: boolean;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
}

/// Narrower than the full `TaskStatus` enum — a student may only ever request one of these
/// two targets (`PortalUpdateTaskStatusDto`); BLOCKED/CANCELLED/NOT_STARTED stay staff-only
/// judgment calls, never reachable from the Portal UI (F08 instruction §16).
export type PortalTaskStatusTarget = "IN_PROGRESS" | "DONE";

/// `GET /portal/students/:id/applications/:applicationId` — unlike the staff
/// `ApplicationDetail` (which embeds ALL `offers[]`), Portal embeds only the single
/// `currentOffer` (`OffersService.getCurrent`) — a deliberate narrower shape confirmed
/// directly against `PortalService.getApplication`, not a frontend simplification.
export interface PortalApplicationDetail extends Application {
  checklist: ApplicationChecklistItem[];
  currentOffer: Offer | null;
}

export interface PortalListParams {
  page?: number;
  limit?: number;
  status?: string;
  [key: string]: string | number | boolean | undefined;
}

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007) — mirrors `PortalService.
/// getClosure`'s redacted shape (`ClosureStatus` from `lib/closure/types.ts` with
/// `handover.notes` always `null`).
export interface PortalClosureStatus {
  caseId: string;
  caseCode: string;
  caseStatus: string;
  checklist: { key: string; status: "PASS" | "FAIL" | "NOT_APPLICABLE"; detail?: string }[];
  readyToClose: boolean;
  handover: { status: "PENDING" | "COMPLETED"; handedOverAt: string | null; recipientName: string | null; notes: null };
  liquidation: PortalLiquidationStatus | null;
}

export interface PortalLiquidationStatus {
  status: "PENDING" | "LIQUIDATED";
  companyConfirmedAt: string | null;
  studentParentConfirmedAt: string | null;
}

export type { Application, ApplicationChecklistItem, ScholarshipApplication, Visa, VisaChecklistItem, Enrollment, Contract, Payment };
