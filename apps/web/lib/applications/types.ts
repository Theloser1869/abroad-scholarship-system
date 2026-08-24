import type { ProgramSummary } from "../programs/types";
import type { Offer } from "../offers/types";
import type { ScholarshipApplication } from "../scholarship-applications/types";

/// Mirrors `database/schema.prisma` `Application`/`ApplicationChecklist` + the Program-
/// summary embed added in `apps/api/.../applications.service.ts` (docs/DECISIONS.md DEC-11).
/// Scoped under `/cases/:caseId/applications` (F01's real route map — matches this
/// mega-prompt's own §13, no discrepancy here). SUBMITTED reachable only via `submit()`
/// (checklist-completeness precondition); OFFER reachable only via `POST .../offers`, never
/// the generic status endpoint.

export type ApplicationStatus = "PLANNING" | "PREPARING" | "READY_FOR_REVIEW" | "SUBMITTED" | "OFFER" | "WAITLIST" | "REJECT" | "WITHDRAWN";

/// Every status the generic `PATCH .../status` endpoint accepts — excludes SUBMITTED (its
/// own `/submit` action) and OFFER (reachable only via creating an Offer). Attempting either
/// through this list is rejected client-side before ever reaching the network, matching the
/// backend DTO's own `@IsIn` whitelist exactly.
export const MANUAL_APPLICATION_STATUSES: ApplicationStatus[] = ["PLANNING", "PREPARING", "READY_FOR_REVIEW", "WAITLIST", "REJECT", "WITHDRAWN"];

/// Backend's real server-side FSM table (`applications.service.ts` `GENERIC_TRANSITIONS`) —
/// used only to grey out/hide obviously-invalid target statuses in the UI picker; the
/// backend re-validates independently and is the sole authority (F05 instruction §15).
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PLANNING: ["PREPARING", "WITHDRAWN"],
  PREPARING: ["READY_FOR_REVIEW", "PLANNING", "WITHDRAWN"],
  READY_FOR_REVIEW: ["PREPARING", "WITHDRAWN"],
  SUBMITTED: ["WAITLIST", "REJECT", "WITHDRAWN"],
  WAITLIST: ["REJECT", "WITHDRAWN"],
  OFFER: ["WITHDRAWN"],
  REJECT: [],
  WITHDRAWN: [],
};

export interface Application {
  id: string;
  applicationCode: string;
  studentId: string;
  caseId: string;
  programId: string;
  program: ProgramSummary;
  intendedIntake: string | null;
  deadline: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  submissionChannel: string | null;
  submissionReference: string | null;
  evidenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/// `GET /applications/:id` embeds these three directly (Prisma `include`) — no separate
/// round-trip needed for checklist/offers/scholarshipApplications on the detail page.
export interface ApplicationDetail extends Application {
  checklist: ApplicationChecklistItem[];
  offers: Offer[];
  scholarshipApplications: ScholarshipApplication[];
}

export type ChecklistItemStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "WAIVED";
export const CHECKLIST_ITEM_STATUSES: ChecklistItemStatus[] = ["PENDING", "IN_PROGRESS", "DONE", "WAIVED"];
export const CHECKLIST_RESOLVED_STATUSES: ChecklistItemStatus[] = ["DONE", "WAIVED"];

export interface ApplicationChecklistItem {
  id: string;
  applicationId: string;
  title: string;
  required: boolean;
  ownerId: string | null;
  deadline: string | null;
  status: ChecklistItemStatus;
  /** Real FK into the existing Document subsystem — rendered via `EvidenceDocumentLink`,
   * never a new upload UI (F05 instruction §17). */
  documentId: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationListParams {
  page?: number;
  limit?: number;
  sort?: string;
  status?: ApplicationStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateApplicationDto` exactly — `studentId`/`caseId` come from the route.
export interface CreateApplicationInput {
  programId: string;
  intendedIntake?: string;
  deadline?: string;
}

export type UpdateApplicationInput = Partial<Omit<CreateApplicationInput, "programId">>;

export interface SubmitApplicationInput {
  submissionChannel?: string;
  submissionReference?: string;
  evidenceDocumentId?: string;
}

export interface CreateChecklistItemInput {
  title: string;
  required?: boolean;
  ownerId?: string;
  deadline?: string;
  documentId?: string;
  notes?: string;
}

export interface UpdateChecklistItemInput {
  title?: string;
  required?: boolean;
  ownerId?: string;
  deadline?: string;
  status?: ChecklistItemStatus;
  documentId?: string;
  notes?: string;
}

/// `409 CHECKLIST_INCOMPLETE` on submit.
export interface ChecklistIncompleteError {
  code: "CHECKLIST_INCOMPLETE";
  message: string;
}

/// `409 ACTIVE_APPLICATION_EXISTS` shape — the real backend error code (docs/DECISIONS.md
/// DEC-05); overrides any "DUPLICATE_APPLICATION" assumption in planning docs.
export interface ActiveApplicationExistsError {
  code: "ACTIVE_APPLICATION_EXISTS";
  message: string;
  existingApplicationId: string;
}

/// `409 INVALID_APPLICATION_STATUS_TRANSITION` — the response includes the real allowed
/// list, surfaced verbatim, never pre-computed client-side.
export interface InvalidApplicationTransitionError {
  code: "INVALID_APPLICATION_STATUS_TRANSITION";
  message: string;
  allowedTransitions: ApplicationStatus[];
}
