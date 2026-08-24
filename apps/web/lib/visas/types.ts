/// Mirrors `database/schema.prisma` `Visa`/`VisaChecklistItem`. Case-scoped (F06 instruction
/// §7): reached only via `/cases/:caseId/visas`, never a global `/visas` list. `offerId` is a
/// bare FK (no University/Program/Offer embed exists on this entity — confirmed against the
/// live service; F06's own display requirements for Visa don't need it, only Enrollment's do,
/// which DEC-12 already fixes). `internalNotes` is `null` when field-redacted for
/// STUDENT_PARENT; `interviewNotes`/`reason` are NOT redacted — they're the affected Student/
/// Parent's own outcome, not staff-internal commentary.

export type VisaStatus = "NOT_STARTED" | "PREPARING" | "READY" | "SUBMITTED" | "APPOINTMENT" | "INTERVIEW" | "GRANTED" | "REFUSED" | "WITHDRAWN";

/// Every status the generic `PATCH .../status` endpoint accepts — excludes SUBMITTED/
/// APPOINTMENT/INTERVIEW (their own dedicated, data-carrying actions) and GRANTED/REFUSED
/// (their own dedicated `result` action). Matches the backend DTO's `@IsIn` whitelist exactly.
export const MANUAL_VISA_STATUSES: VisaStatus[] = ["NOT_STARTED", "PREPARING", "READY", "WITHDRAWN"];

/// Backend's real server-side FSM table (`visas.service.ts` `GENERIC_TRANSITIONS`) — used
/// only to decide whether the "Chuyển trạng thái" button should render; the backend
/// re-validates independently and is the sole authority (F06 instruction §8).
export const VISA_TRANSITIONS: Record<VisaStatus, VisaStatus[]> = {
  NOT_STARTED: ["PREPARING", "WITHDRAWN"],
  PREPARING: ["READY", "NOT_STARTED", "WITHDRAWN"],
  READY: ["PREPARING", "WITHDRAWN"],
  SUBMITTED: ["WITHDRAWN"],
  APPOINTMENT: ["WITHDRAWN"],
  INTERVIEW: ["WITHDRAWN"],
  GRANTED: [],
  REFUSED: [],
  WITHDRAWN: [],
};

export interface Visa {
  id: string;
  visaCode: string;
  studentId: string;
  caseId: string;
  offerId: string | null;
  countryCode: string;
  visaType: string;
  status: VisaStatus;
  submittedAt: string | null;
  submissionReference: string | null;
  evidenceDocumentId: string | null;
  appointmentAt: string | null;
  appointmentLocation: string | null;
  appointmentReference: string | null;
  interviewAt: string | null;
  interviewNotes: string | null;
  resultDate: string | null;
  resultEvidenceDocumentId: string | null;
  reason: string | null;
  /** `null` when field-redacted for STUDENT_PARENT, or genuinely unset. */
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisaListParams {
  page?: number;
  limit?: number;
  sort?: string;
  status?: VisaStatus;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateVisaDto` exactly — `studentId`/`caseId` come from the route.
export interface CreateVisaInput {
  countryCode: string;
  visaType: string;
  offerId?: string;
}

export interface UpdateVisaInput {
  countryCode?: string;
  visaType?: string;
  offerId?: string;
  internalNotes?: string;
}

export interface SubmitVisaInput {
  submissionReference?: string;
  evidenceDocumentId?: string;
}

export interface ScheduleAppointmentInput {
  appointmentAt: string;
  appointmentLocation?: string;
  appointmentReference?: string;
}

export interface RecordInterviewInput {
  interviewAt: string;
  interviewNotes?: string;
}

export type VisaResult = "GRANTED" | "REFUSED";

export interface RecordVisaResultInput {
  result: VisaResult;
  resultDate?: string;
  resultEvidenceDocumentId?: string;
  reason?: string;
}

/// Shared `VisaChecklistItem` shape — the same Prisma model backs BOTH Visa checklist rows
/// (`entityType: 'Visa'`) and Pre-departure checklist rows (`entityType: 'PreDeparture'`),
/// polymorphic per the schema's own design comment. Reused by `lib/pre-departure/types.ts`
/// rather than duplicated.
export type ChecklistItemStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "WAIVED";
export const CHECKLIST_ITEM_STATUSES: ChecklistItemStatus[] = ["PENDING", "IN_PROGRESS", "DONE", "WAIVED"];

export interface VisaChecklistItem {
  id: string;
  entityType: "Visa" | "PreDeparture";
  entityId: string;
  title: string;
  /** Free-text grouping — Pre-departure-relevant only; a Visa-scoped item leaves this unset. */
  category: string | null;
  required: boolean;
  ownerId: string | null;
  deadline: string | null;
  status: ChecklistItemStatus;
  documentId: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisaChecklistItemInput {
  title: string;
  required?: boolean;
  ownerId?: string;
  deadline?: string;
  documentId?: string;
  notes?: string;
}

export interface UpdateVisaChecklistItemInput {
  title?: string;
  required?: boolean;
  ownerId?: string;
  deadline?: string;
  status?: ChecklistItemStatus;
  documentId?: string;
  notes?: string;
}

/// `409 CHECKLIST_INCOMPLETE` — thrown both by the generic status endpoint (targeting
/// READY) and by `submit` (re-verifying the same gate).
export interface ChecklistIncompleteError {
  code: "CHECKLIST_INCOMPLETE";
  message: string;
}

/// `409 ACTIVE_VISA_EXISTS` — the real backend error code, same "single existing-record ID"
/// shape as every other duplicate-detection 409 in this app.
export interface ActiveVisaExistsError {
  code: "ACTIVE_VISA_EXISTS";
  message: string;
  existingVisaId: string;
}

export interface InvalidVisaTransitionError {
  code: "INVALID_VISA_STATUS_TRANSITION";
  message: string;
  allowedTransitions: VisaStatus[];
}
