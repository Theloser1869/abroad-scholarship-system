import type { UserSummary } from "../api/types";

/// Mirrors `database/schema.prisma` `Lead` + the owner summary added in
/// `apps/api/src/modules/crm/leads/leads.service.ts` (see docs/DECISIONS.md DEC-09) exactly
/// — nothing here is invented ahead of the real backend response.

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONSULTATION" | "CONTRACTING" | "CONVERTED" | "LOST";

/// Manual transitions only — CONVERTED is reachable only via `POST /leads/:id/convert`
/// (backend: `UpdateLeadStatusDto` excludes it). Never construct/send `CONVERTED` through
/// `updateLeadStatus`.
export const MANUAL_LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CONSULTATION", "CONTRACTING", "LOST"];

export interface Lead {
  id: string;
  leadCode: string;
  contactName: string;
  parentName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  campaign: string | null;
  countryInterest: string | null;
  majorInterest: string | null;
  intake: string | null;
  serviceInterest: string | null;
  ownerId: string;
  owner: UserSummary;
  score: number | null;
  status: LeadStatus;
  convertedStudentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  status?: LeadStatus;
  ownerId?: string;
  [key: string]: string | number | boolean | undefined | null;
}

export interface CreateLeadInput {
  contactName: string;
  parentName?: string;
  email?: string;
  phone?: string;
  source?: string;
  campaign?: string;
  countryInterest?: string;
  majorInterest?: string;
  intake?: string;
  serviceInterest?: string;
  ownerId?: string;
  score?: number;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

/// Mirrors `ConvertLeadDto` exactly (`apps/api/src/modules/crm/leads/dto/convert-lead.dto.ts`).
export interface ConvertLeadInput {
  dateOfBirth?: string;
  confirmMatch?: "MERGE" | "CREATE_NEW";
  mergeIntoStudentId?: string;
  caseOwnerId?: string;
  caseStage?: string;
}

/// Mirrors `ConvertResult` (`LeadsService.convert`'s return shape).
export interface ConvertLeadResult {
  student: { id: string; studentCode: string; fullName: string };
  case: { id: string; caseCode: string };
  merged: boolean;
}

/// One candidate in a `409 DUPLICATE_STUDENT_CANDIDATES` response's `candidates` array.
export interface DuplicateStudentCandidate {
  id: string;
  studentCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
}
