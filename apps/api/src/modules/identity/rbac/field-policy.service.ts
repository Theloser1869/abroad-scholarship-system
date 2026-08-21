import { Injectable } from '@nestjs/common';
import { Comment, Contract, Enrollment, LetterOfRecommendation, Partner, Payment, RoleCode, ScholarshipApplication, Student, Task, Visa } from '@prisma/client';

/// 03-security/02_RBAC.md "Field-level protect" + SRS section 13's role×field matrix.
/// Budget/Finance, Internal notes (Phase 03/04), and now Contract Value / Payment/Debt
/// (Phase 05) are enforced here. The remaining SRS §13 groups (passport, commission, visa
/// evidence, audit logs) have no endpoint yet (Visa/Commission controllers are Phase
/// 09/10; audit log ACCESS is AuditLogsModule's own permission gate, not field
/// redaction). This service is the generic redaction *mechanism*; the phase that exposes
/// each remaining field group adds its own case here rather than reinventing redaction —
/// see docs/security/RBAC_MATRIX.md.
///
/// SRS's per-role grants (section 13) use three levels: "V" (full), "Hạn chế"
/// (restricted), "Không" (none). This service collapses "V" and "Hạn chế" to ALLOWED and
/// "Không" to REDACTED — a deliberate simplification applied consistently across every
/// field group (SRS does not specify what "restricted" narrows down to beyond the word
/// itself); see docs/ASSUMPTIONS.md ASM-07.
const BUDGET_REDACTED_FOR: ReadonlySet<RoleCode> = new Set<RoleCode>(['DOCUMENT_SPECIALIST', 'SALES_MARKETING', 'SYSTEM_ADMIN']);

/// SRS §13 "Contract Value" / "Payment/Debt" rows: GĐĐH=V, Trưởng phòng=Hạn chế→allow,
/// Tư vấn=Không, Hồ sơ=Không, HCTH=V, Sale=Không, HS/PH=V của mình. In practice
/// `ScopePolicyService.contractScopeKindFor` already gives every one of these
/// REDACTED_FOR roles `ScopeKind.NONE` on Contract/Payment (they never reach a record to
/// redact — 404 first). This redaction is the defense-in-depth second layer, tested
/// directly against the roles it would matter for if the scope layer were ever bypassed
/// or extended — same pattern as `BUDGET_REDACTED_FOR` above.
const FINANCIAL_REDACTED_FOR: ReadonlySet<RoleCode> = new Set<RoleCode>([
  'CONSULTANT',
  'DOCUMENT_SPECIALIST',
  'SALES_MARKETING',
  'SYSTEM_ADMIN',
]);

export type RedactedStudent = Omit<Student, 'budget' | 'budgetCurrency'> & {
  budget: Student['budget'] | null;
  budgetCurrency: Student['budgetCurrency'] | null;
};

export type RedactedContract = Omit<Contract, 'value' | 'currency' | 'approvalThreshold'> & {
  value: Contract['value'] | null;
  currency: Contract['currency'] | null;
  approvalThreshold: Contract['approvalThreshold'] | null;
};

export type RedactedPayment = Omit<Payment, 'amount' | 'currency' | 'paidAmount' | 'refundedAmount'> & {
  amount: Payment['amount'] | null;
  currency: Payment['currency'] | null;
  paidAmount: Payment['paidAmount'] | null;
  refundedAmount: Payment['refundedAmount'] | null;
};

/// SRS §13-style "Internal notes" — same reasoning as `canViewComment`'s internal
/// visibility, applied to LOR's recommender contact details/internal tracking notes
/// (07-profile/03_WRITING.md "Sensitive/internal notes phải tôn trọng field-level
/// permission"). Only STUDENT_PARENT is redacted — every staff role that can reach an LOR
/// record at all (CONSULTANT/DOCUMENT_SPECIALIST/ED/DM) needs the real contact info to do
/// the actual recommender-chasing work.
const LOR_REDACTED_FOR: ReadonlySet<RoleCode> = new Set<RoleCode>(['STUDENT_PARENT']);

export type RedactedLor = Omit<LetterOfRecommendation, 'contactEmail' | 'contactPhone' | 'internalNotes'> & {
  contactEmail: LetterOfRecommendation['contactEmail'] | null;
  contactPhone: LetterOfRecommendation['contactPhone'] | null;
  internalNotes: LetterOfRecommendation['internalNotes'] | null;
};

/// SRS §13-style "Internal notes", Phase 08 — a ScholarshipApplication's staff-only
/// strategy/interview commentary (08-admission/03_OFFER_SCHOLARSHIP.md), same pattern as
/// LOR's `internalNotes` above. Only STUDENT_PARENT is redacted.
const SCHOLARSHIP_APPLICATION_REDACTED_FOR: ReadonlySet<RoleCode> = new Set<RoleCode>(['STUDENT_PARENT']);

export type RedactedScholarshipApplication = Omit<ScholarshipApplication, 'internalNotes'> & {
  internalNotes: ScholarshipApplication['internalNotes'] | null;
};

/// SRS §13-style "Internal notes", Phase 09 — a Visa's staff-only strategy commentary
/// (09-visa/01_VISA.md sensitive-data section). Only STUDENT_PARENT is redacted;
/// `interviewNotes`/`reason`/appointment/result fields stay visible — they are the
/// affected Student/Parent's OWN visa outcome, not staff-internal secrets (see the
/// schema.prisma comment on `Visa.interviewNotes`).
const VISA_REDACTED_FOR: ReadonlySet<RoleCode> = new Set<RoleCode>(['STUDENT_PARENT']);

export type RedactedVisa = Omit<Visa, 'internalNotes'> & {
  internalNotes: Visa['internalNotes'] | null;
};

/// SRS §13-style "Internal notes", Phase 09 — "enrollment internal notes nếu có"
/// (09-visa/02_PRE_DEPARTURE_ENROLLMENT.md). Only STUDENT_PARENT is redacted.
const ENROLLMENT_REDACTED_FOR: ReadonlySet<RoleCode> = new Set<RoleCode>(['STUDENT_PARENT']);

export type RedactedEnrollment = Omit<Enrollment, 'internalNotes'> & {
  internalNotes: Enrollment['internalNotes'] | null;
};

/// Phase 10 — Partner's staff-only relationship/negotiation commentary
/// (10-partners/01_PARTNER_CRM.md "Internal partner notes phải được field-level
/// protection nếu có"). Every role granted `partner:view` in this phase's RBAC matrix
/// already sees full commercial context (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/
/// ADMIN_FINANCE) except DOCUMENT_SPECIALIST (paperwork-scoped, view-only, no commercial
/// visibility) — see docs/ASSUMPTIONS.md ASM-43.
const PARTNER_REDACTED_FOR: ReadonlySet<RoleCode> = new Set<RoleCode>(['DOCUMENT_SPECIALIST']);

export type RedactedPartner = Omit<Partner, 'internalNotes'> & {
  internalNotes: Partner['internalNotes'] | null;
};

/// Phase 11 (Portal) — "Student không tự động được thấy... internal quality score, internal
/// blocker context nếu MD không cho phép." Unlike every other `redact*` method above, this
/// one is unconditional (not role-varying) — it only ever runs on the Portal's own
/// student-facing Task response path, never on the staff-facing `TasksController`, so there
/// is no role branch to key off. `ownerId` (which staff member) is redacted too — "staff
/// assignment" is explicitly named in 11-portal/01_STUDENT_PARENT_PORTAL.md section 4 as
/// something a student never controls or needs to see. See `docs/ASSUMPTIONS.md` ASM-47.
export type RedactedTask = Omit<Task, 'blocker' | 'qualityScore' | 'ownerId'> & {
  blocker: null;
  qualityScore: null;
  ownerId: null;
};

@Injectable()
export class FieldPolicyService {
  redactStudent(student: Student, roleCode: string): RedactedStudent {
    if (!BUDGET_REDACTED_FOR.has(roleCode as RoleCode)) {
      return student;
    }
    return { ...student, budget: null, budgetCurrency: null };
  }

  /// `internal`-visibility comments are staff-only (SRS §13 "Internal notes": HS/PHHS =
  /// "Không"); `shared`-visibility comments are visible to anyone who can already see the
  /// parent record (record-level scope, checked before this is ever called).
  canViewComment(roleCode: string, comment: Pick<Comment, 'visibility'>): boolean {
    if (comment.visibility === 'internal') {
      return roleCode !== 'STUDENT_PARENT';
    }
    return true;
  }

  /// Generic over `T extends Contract` (not just the bare `Contract` type) so a caller
  /// passing `ContractWithStudent` (DEC-10 — `student` relation summary, additive to the
  /// list/detail endpoints) keeps that field in the redacted result's type, instead of it
  /// being silently widened away to plain `Contract` by a non-generic signature.
  redactContract<T extends Contract>(contract: T, roleCode: string): Omit<T, 'value' | 'currency' | 'approvalThreshold'> & Pick<RedactedContract, 'value' | 'currency' | 'approvalThreshold'> {
    if (!FINANCIAL_REDACTED_FOR.has(roleCode as RoleCode)) {
      return contract;
    }
    return { ...contract, value: null, currency: null, approvalThreshold: null };
  }

  redactPayment(payment: Payment, roleCode: string): RedactedPayment {
    if (!FINANCIAL_REDACTED_FOR.has(roleCode as RoleCode)) {
      return payment;
    }
    return { ...payment, amount: null, currency: null, paidAmount: null, refundedAmount: null };
  }

  redactLor(lor: LetterOfRecommendation, roleCode: string): RedactedLor {
    if (!LOR_REDACTED_FOR.has(roleCode as RoleCode)) {
      return lor;
    }
    return { ...lor, contactEmail: null, contactPhone: null, internalNotes: null };
  }

  redactScholarshipApplication(scholarshipApplication: ScholarshipApplication, roleCode: string): RedactedScholarshipApplication {
    if (!SCHOLARSHIP_APPLICATION_REDACTED_FOR.has(roleCode as RoleCode)) {
      return scholarshipApplication;
    }
    return { ...scholarshipApplication, internalNotes: null };
  }

  redactVisa(visa: Visa, roleCode: string): RedactedVisa {
    if (!VISA_REDACTED_FOR.has(roleCode as RoleCode)) {
      return visa;
    }
    return { ...visa, internalNotes: null };
  }

  redactEnrollment(enrollment: Enrollment, roleCode: string): RedactedEnrollment {
    if (!ENROLLMENT_REDACTED_FOR.has(roleCode as RoleCode)) {
      return enrollment;
    }
    return { ...enrollment, internalNotes: null };
  }

  redactPartner(partner: Partner, roleCode: string): RedactedPartner {
    if (!PARTNER_REDACTED_FOR.has(roleCode as RoleCode)) {
      return partner;
    }
    return { ...partner, internalNotes: null };
  }

  redactTaskForPortal(task: Task): RedactedTask {
    return { ...task, blocker: null, qualityScore: null, ownerId: null };
  }
}
