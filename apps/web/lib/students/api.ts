import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { TimelineEntry } from "../timeline/types";
import type { Case } from "../cases/types";
import type {
  CreateStudentContactInput,
  CreateStudentInput,
  Student,
  StudentContact,
  StudentListParams,
  UpdateStudentInput,
} from "./types";

/// Typed calls against `apps/api/src/modules/case-management/students/students.controller.ts`
/// + the StudentContacts sub-resource (`apps/api/src/modules/portal/portal-access/
/// portal-access.controller.ts` — a Student sub-resource, not a Portal-surface route despite
/// living in that module; see docs/frontend/FRONTEND_API_MAP.md).

export function listStudents(params: StudentListParams): Promise<PaginatedResponse<Student>> {
  return apiFetch<PaginatedResponse<Student>>("/students", { query: params });
}

export function getStudent(id: string): Promise<Student> {
  return apiFetch<Student>(`/students/${id}`);
}

export function createStudent(input: CreateStudentInput): Promise<Student> {
  return apiFetch<Student>("/students", { method: "POST", body: input });
}

export function updateStudent(id: string, input: UpdateStudentInput): Promise<Student> {
  return apiFetch<Student>(`/students/${id}`, { method: "PATCH", body: input });
}

export function archiveStudent(id: string): Promise<Student> {
  return apiFetch<Student>(`/students/${id}/archive`, { method: "PATCH" });
}

export function addStudentNote(id: string, body: string, visibility: "internal" | "shared" = "internal") {
  return apiFetch(`/students/${id}/notes`, { method: "POST", body: { body, visibility } });
}

export function getStudentTimeline(id: string): Promise<TimelineEntry[]> {
  return apiFetch<TimelineEntry[]>(`/students/${id}/timeline`);
}

export function listStudentContacts(studentId: string): Promise<StudentContact[]> {
  return apiFetch<StudentContact[]>(`/students/${studentId}/contacts`);
}

export function createStudentContact(studentId: string, input: CreateStudentContactInput): Promise<StudentContact> {
  return apiFetch<StudentContact>(`/students/${studentId}/contacts`, { method: "POST", body: input });
}

/// F08 — staff-side trigger for the Parent portal-access lifecycle (`PortalAccessService.
/// inviteParent`/`revokeParentAccess`). `devToken` is only ever returned outside production
/// (no email-delivery integration exists yet, same documented gap as password reset) — shown
/// to the inviting staff member so they can relay the acceptance link out-of-band in this
/// environment; never logged, never persisted client-side beyond the toast that shows it once.
export function inviteParent(studentId: string, contactId: string): Promise<{ devToken?: string }> {
  return apiFetch<{ devToken?: string }>(`/students/${studentId}/contacts/${contactId}/invite`, { method: "POST" });
}

export function revokeParentAccess(studentId: string, contactId: string): Promise<StudentContact> {
  return apiFetch<StudentContact>(`/students/${studentId}/contacts/${contactId}/revoke`, { method: "POST" });
}

/// `Student.cases` has no dedicated endpoint — reuses `GET /cases?studentId=` (the filter
/// added alongside this phase, docs/DECISIONS.md DEC-09), never a second parallel query
/// mechanism.
export function listCasesForStudent(studentId: string): Promise<PaginatedResponse<Case>> {
  return apiFetch<PaginatedResponse<Case>>("/cases", { query: { studentId, limit: 50 } });
}

/// `POST /students/:id/cases` — opens a new Case lifecycle for an existing Student
/// (`CasesService.createForStudent`; blocked server-side if an active Case already exists —
/// `409 DUPLICATE_ACTIVE_CASE`, never pre-checked client-side).
export function createCaseForStudent(studentId: string, input: { ownerId?: string; stage?: string; department?: string }): Promise<Case> {
  return apiFetch<Case>(`/students/${studentId}/cases`, { method: "POST", body: input });
}
