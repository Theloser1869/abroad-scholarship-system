import { apiFetch } from "../api/client";
import type {
  AcademicRecord,
  Activity,
  Competition,
  CreateAcademicRecordInput,
  CreateActivityInput,
  CreateCompetitionInput,
  CreateResearchProjectInput,
  CreateTestRecordInput,
  ResearchProject,
  TestRecord,
  UpdateAcademicRecordInput,
  UpdateActivityInput,
  UpdateCompetitionInput,
  UpdateResearchProjectInput,
  UpdateTestRecordInput,
} from "./types";

/// Typed calls against `apps/api/src/modules/counseling/profile-evidence/
/// profile-evidence.controller.ts` — 5 structurally identical Case-scoped resources, each its
/// own route group (never a combined `?type=` query), consolidated here for the same reason
/// the backend consolidates them into one controller file.

// --- Academic ---
export const listAcademicRecordsForCase = (caseId: string): Promise<AcademicRecord[]> => apiFetch(`/cases/${caseId}/academic-records`);
export const getAcademicRecord = (id: string): Promise<AcademicRecord> => apiFetch(`/academic-records/${id}`);
export const createAcademicRecord = (caseId: string, input: CreateAcademicRecordInput): Promise<AcademicRecord> =>
  apiFetch(`/cases/${caseId}/academic-records`, { method: "POST", body: input });
export const updateAcademicRecord = (id: string, input: UpdateAcademicRecordInput): Promise<AcademicRecord> =>
  apiFetch(`/academic-records/${id}`, { method: "PATCH", body: input });
export const verifyAcademicRecord = (id: string): Promise<AcademicRecord> => apiFetch(`/academic-records/${id}/verify`, { method: "POST" });

// --- Test records ---
export const listTestRecordsForCase = (caseId: string): Promise<TestRecord[]> => apiFetch(`/cases/${caseId}/test-records`);
export const getTestRecord = (id: string): Promise<TestRecord> => apiFetch(`/test-records/${id}`);
/// `409 DUPLICATE_TEST_ATTEMPT` for a repeated `(testType, attemptNumber)` pair — surfaced
/// verbatim as a conflict, never silently merged (F04 instruction §24/§41).
export const createTestRecord = (caseId: string, input: CreateTestRecordInput): Promise<TestRecord> =>
  apiFetch(`/cases/${caseId}/test-records`, { method: "POST", body: input });
export const updateTestRecord = (id: string, input: UpdateTestRecordInput): Promise<TestRecord> =>
  apiFetch(`/test-records/${id}`, { method: "PATCH", body: input });
export const verifyTestRecord = (id: string): Promise<TestRecord> => apiFetch(`/test-records/${id}/verify`, { method: "POST" });

// --- Competitions ---
export const listCompetitionsForCase = (caseId: string): Promise<Competition[]> => apiFetch(`/cases/${caseId}/competitions`);
export const getCompetition = (id: string): Promise<Competition> => apiFetch(`/competitions/${id}`);
export const createCompetition = (caseId: string, input: CreateCompetitionInput): Promise<Competition> =>
  apiFetch(`/cases/${caseId}/competitions`, { method: "POST", body: input });
export const updateCompetition = (id: string, input: UpdateCompetitionInput): Promise<Competition> =>
  apiFetch(`/competitions/${id}`, { method: "PATCH", body: input });

// --- Research projects ---
export const listResearchProjectsForCase = (caseId: string): Promise<ResearchProject[]> => apiFetch(`/cases/${caseId}/research-projects`);
export const getResearchProject = (id: string): Promise<ResearchProject> => apiFetch(`/research-projects/${id}`);
export const createResearchProject = (caseId: string, input: CreateResearchProjectInput): Promise<ResearchProject> =>
  apiFetch(`/cases/${caseId}/research-projects`, { method: "POST", body: input });
export const updateResearchProject = (id: string, input: UpdateResearchProjectInput): Promise<ResearchProject> =>
  apiFetch(`/research-projects/${id}`, { method: "PATCH", body: input });

// --- Activities ---
export const listActivitiesForCase = (caseId: string): Promise<Activity[]> => apiFetch(`/cases/${caseId}/activities`);
export const getActivity = (id: string): Promise<Activity> => apiFetch(`/activities/${id}`);
export const createActivity = (caseId: string, input: CreateActivityInput): Promise<Activity> =>
  apiFetch(`/cases/${caseId}/activities`, { method: "POST", body: input });
export const updateActivity = (id: string, input: UpdateActivityInput): Promise<Activity> =>
  apiFetch(`/activities/${id}`, { method: "PATCH", body: input });
export const verifyActivity = (id: string): Promise<Activity> => apiFetch(`/activities/${id}/verify`, { method: "POST" });
