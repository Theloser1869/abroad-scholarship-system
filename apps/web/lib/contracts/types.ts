import type { StudentSummary } from "../cases/types";

/// Mirrors `database/schema.prisma` `Contract`/`ContractAmendment` + the student relation
/// summary added in `apps/api/src/modules/commercial/contracts/contracts.service.ts`
/// (docs/DECISIONS.md DEC-10). `value`/`currency`/`approvalThreshold` are Decimal fields —
/// Prisma serializes them as JSON **strings**, typed as `string` here deliberately, never
/// `number` (F04 instruction §38: "Do not use frontend floating-point calculations").

export type ContractStatus = "DRAFT" | "REVIEW" | "APPROVED" | "SENT" | "SIGNED" | "ACTIVE" | "COMPLETED" | "LIQUIDATED" | "ARCHIVED";

/// `PATCH /contracts/:id/status` only accepts these four (`UpdateContractStatusDto`) — every
/// earlier transition (submit/approve/reject/send/sign) is its own dedicated endpoint, never
/// reachable through this one (F04 instruction §8: "Không cho frontend PATCH status trực tiếp
/// nếu backend có dedicated endpoint").
export type ManualContractStatus = "ACTIVE" | "COMPLETED" | "LIQUIDATED" | "ARCHIVED";
export const MANUAL_CONTRACT_STATUSES: ManualContractStatus[] = ["ACTIVE", "COMPLETED", "LIQUIDATED", "ARCHIVED"];

export interface Contract {
  id: string;
  contractCode: string;
  studentId: string;
  student: StudentSummary;
  templateId: string | null;
  mergeFieldValues: Record<string, unknown> | null;
  servicePackage: string | null;
  /** Decimal string, or `null` when field-redacted for this role (defense-in-depth — such a
   * role's `ScopeKind` is already NONE on Contract, so this is unreachable in practice). */
  value: string | null;
  currency: string | null;
  status: ContractStatus;
  version: number;
  approvalThreshold: string | null;
  submittedAt: string | null;
  signedAt: string | null;
  signedDocumentId: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  liquidatedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/// The only versioning mechanism after signing — a diff record (`before`/`after`), never a
/// full contract snapshot (F04 instruction §9: distinguish Contract vs. Amendment).
export interface ContractAmendment {
  id: string;
  amendmentCode: string;
  contractId: string;
  previousVersion: number;
  newVersion: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
  approvedById: string | null;
  effectiveDate: string;
  createdAt: string;
}

export interface ContractListParams {
  page?: number;
  limit?: number;
  sort?: string;
  status?: ContractStatus;
  studentId?: string;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateContractDto` exactly.
export interface CreateContractInput {
  studentId: string;
  templateId?: string;
  servicePackage?: string;
  value: number;
  currency: string;
  mergeFieldValues?: Record<string, unknown>;
}

/// Mirrors `UpdateContractDto` — DRAFT-only server-side (`409 INVALID_CONTRACT_STATE` once
/// submitted); never offered by the UI once status !== DRAFT.
export type UpdateContractInput = Partial<Omit<CreateContractInput, "studentId">>;

/// Mirrors `CreateAmendmentDto`.
export interface CreateAmendmentInput {
  reason: string;
  effectiveDate: string;
  value?: number;
  currency?: string;
  servicePackage?: string;
  mergeFieldValues?: Record<string, unknown>;
}

export interface SendContractResult {
  contract: Contract;
  /** Shown once — never re-fetchable, per `ContractsService.send`. */
  reviewToken: string;
  reviewExpiresAt: string;
}

export interface ContractTemplate {
  id: string;
  code: string;
  name: string;
  version: number;
  active: boolean;
}
