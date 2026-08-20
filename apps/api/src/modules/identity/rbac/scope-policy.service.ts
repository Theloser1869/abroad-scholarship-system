import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';

/// 03-security/02_RBAC.md "Scope policy": Case ownership, Student self, Parent-linked
/// student, Department/team scope. Every role maps to exactly one ScopeKind — see
/// `ROLE_SCOPE` below — and every scope-checked resource (Student, Case today; more as
/// later phases add controllers) asks this service both "give me a WHERE filter for a
/// list" and "is this ONE record in my scope" rather than re-implementing the mapping
/// per-endpoint. This is the piece 02_RBAC.md means by "Authorization must execute
/// server-side" for record-scope, layered under AuthGuard's role→permission check
/// (docs/api/API_CONVENTIONS.md) — passing the guard only proves the caller may use the
/// verb at all, not that this particular row is theirs to use it on.
export enum ScopeKind {
  /// No record-scope restriction — every row is in scope (still gated by the base
  /// role→permission grant, and still audited).
  GLOBAL = 'GLOBAL',
  /// In scope only via CaseMember (owner or collaborator) on a Case belonging to the
  /// record.
  CASE_MEMBER = 'CASE_MEMBER',
  /// In scope only if the record IS the caller (Student.portalUserId) or the caller is a
  /// linked parent/guardian (StudentContact.portalUserId) of that Student.
  OWN_STUDENT = 'OWN_STUDENT',
  /// No record is ever in scope for this resource via this role (the role simply doesn't
  /// operate on Student/Case data — e.g. Sales/Marketing, SRS section 3: "Không passport,
  /// tài chính, visa, tài liệu nhạy cảm").
  NONE = 'NONE',
  /// In scope only if the record's `ownerId` is the caller — Lead scope (04-core-crm/
  /// 01_LEAD.md), distinct from CASE_MEMBER/OWN_STUDENT because Lead already has a plain
  /// `ownerId` column (no schema gap to work around, unlike Case's missing Department —
  /// see docs/ASSUMPTIONS.md ASM-06).
  OWN_LEAD = 'OWN_LEAD',
}

/// See docs/ASSUMPTIONS.md ASM-06 for why DEPARTMENT_MANAGER maps to GLOBAL rather than a
/// true department-partitioned scope: no `Department` entity exists anywhere in the Core
/// Entities list (00_MASTER_CONTEXT.md) or the Phase 02 schema, and inventing one now,
/// unprompted by any phase's instructions, would violate "Không tự suy diễn requirement".
const ROLE_SCOPE: Record<RoleCode, ScopeKind> = {
  EXECUTIVE_DIRECTOR: ScopeKind.GLOBAL,
  DEPARTMENT_MANAGER: ScopeKind.GLOBAL,
  CONSULTANT: ScopeKind.CASE_MEMBER,
  DOCUMENT_SPECIALIST: ScopeKind.CASE_MEMBER,
  SALES_MARKETING: ScopeKind.NONE,
  ADMIN_FINANCE: ScopeKind.NONE,
  STUDENT_PARENT: ScopeKind.OWN_STUDENT,
  SYSTEM_ADMIN: ScopeKind.NONE,
};

/// A separate mapping from `ROLE_SCOPE` above — Lead scope genuinely differs per role from
/// Student/Case scope (SALES_MARKETING owns Leads but nothing else; CONSULTANT/
/// DOCUMENT_SPECIALIST own no Leads at all, only Case membership). One role can carry a
/// different ScopeKind per resource; there is no single "the" scope for a role independent
/// of what it's being applied to.
const LEAD_ROLE_SCOPE: Record<RoleCode, ScopeKind> = {
  EXECUTIVE_DIRECTOR: ScopeKind.GLOBAL,
  DEPARTMENT_MANAGER: ScopeKind.GLOBAL,
  SALES_MARKETING: ScopeKind.OWN_LEAD,
  CONSULTANT: ScopeKind.NONE,
  DOCUMENT_SPECIALIST: ScopeKind.NONE,
  ADMIN_FINANCE: ScopeKind.NONE,
  STUDENT_PARENT: ScopeKind.NONE,
  SYSTEM_ADMIN: ScopeKind.NONE,
};

/// A third, separate mapping — Contract/Payment scope (05-commercial). Deliberately NOT
/// CASE_MEMBER for CONSULTANT/DOCUMENT_SPECIALIST, unlike Student/Case: SRS section 3 is
/// explicit that Tư vấn/Hồ sơ do not get commercial data by default just from being on the
/// case ("Không xem dữ liệu thương mại"), and 05-commercial's own instructions single this
/// out — "Consultant không được xem các financial fields nếu RBAC không cho phép",
/// "Sales/Marketing không được tự động có quyền đọc Contract/Payment chỉ vì có quyền
/// Lead." ADMIN_FINANCE gets GLOBAL here specifically — Contract/Payment/Closure is its
/// entire SRS-defined domain ("HCTH: Hợp đồng, phụ lục, payment, công nợ, thanh lý"),
/// unlike its NONE scope on Student/Case. Payment has no `ownerId`/`portalUserId` of its
/// own — `assertPaymentAccessible` resolves scope through the parent Contract's Student.
const CONTRACT_ROLE_SCOPE: Record<RoleCode, ScopeKind> = {
  EXECUTIVE_DIRECTOR: ScopeKind.GLOBAL,
  DEPARTMENT_MANAGER: ScopeKind.GLOBAL,
  ADMIN_FINANCE: ScopeKind.GLOBAL,
  STUDENT_PARENT: ScopeKind.OWN_STUDENT,
  CONSULTANT: ScopeKind.NONE,
  DOCUMENT_SPECIALIST: ScopeKind.NONE,
  SALES_MARKETING: ScopeKind.NONE,
  SYSTEM_ADMIN: ScopeKind.NONE,
};

@Injectable()
export class ScopePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  scopeKindFor(roleCode: string): ScopeKind {
    return ROLE_SCOPE[roleCode as RoleCode] ?? ScopeKind.NONE;
  }

  /// WHERE clause to AND into a `student.findMany` query so a list endpoint only returns
  /// rows the caller's scope actually covers.
  studentListFilter(principal: Principal): Prisma.StudentWhereInput {
    switch (this.scopeKindFor(principal.roleCode)) {
      case ScopeKind.GLOBAL:
        return {};
      case ScopeKind.CASE_MEMBER:
        return { cases: { some: { members: { some: { userId: principal.userId } } } } };
      case ScopeKind.OWN_STUDENT:
        return { OR: [{ portalUserId: principal.userId }, { contacts: { some: { portalUserId: principal.userId, portalStatus: 'ACTIVE' } } }] };
      case ScopeKind.NONE:
      default:
        return { id: IMPOSSIBLE_ID };
    }
  }

  /// Throws 404 (not 403) when `studentId` exists but is out of the caller's scope — SRS
  /// AC-02 "Một user không thuộc case không thể đọc Student/Document dù biết Student ID":
  /// a 403 would confirm the record exists; 404 does not.
  ///
  /// A linked-parent match additionally requires `StudentContact.portalStatus = ACTIVE`
  /// (Phase 11) — not merely a non-null `portalUserId` — so a revoked parent loses access
  /// on the very next request, no caching/session staleness possible since this is a fresh
  /// DB read every call: "quyền truy cập phải mất ngay theo policy." See
  /// `docs/ASSUMPTIONS.md` ASM-46.
  async assertStudentAccessible(principal: Principal, studentId: string): Promise<void> {
    const kind = this.scopeKindFor(principal.roleCode);
    if (kind === ScopeKind.GLOBAL) return;
    if (kind === ScopeKind.NONE) throw notFound();

    if (kind === ScopeKind.CASE_MEMBER) {
      const membership = await this.prisma.caseMember.findFirst({
        where: { userId: principal.userId, case: { studentId } },
      });
      if (!membership) throw notFound();
      return;
    }

    // OWN_STUDENT
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { portalUserId: true, contacts: { select: { portalUserId: true, portalStatus: true } } },
    });
    const isSelf = student?.portalUserId === principal.userId;
    const isLinkedParent = student?.contacts.some((c) => c.portalUserId === principal.userId && c.portalStatus === 'ACTIVE') ?? false;
    if (!isSelf && !isLinkedParent) throw notFound();
  }

  caseListFilter(principal: Principal): Prisma.CaseWhereInput {
    switch (this.scopeKindFor(principal.roleCode)) {
      case ScopeKind.GLOBAL:
        return {};
      case ScopeKind.CASE_MEMBER:
        return { members: { some: { userId: principal.userId } } };
      case ScopeKind.OWN_STUDENT:
        return { student: { OR: [{ portalUserId: principal.userId }, { contacts: { some: { portalUserId: principal.userId, portalStatus: 'ACTIVE' } } }] } };
      case ScopeKind.NONE:
      default:
        return { id: IMPOSSIBLE_ID };
    }
  }

  async assertCaseAccessible(principal: Principal, caseId: string): Promise<void> {
    const kind = this.scopeKindFor(principal.roleCode);
    if (kind === ScopeKind.GLOBAL) return;
    if (kind === ScopeKind.NONE) throw notFound();

    if (kind === ScopeKind.CASE_MEMBER) {
      const membership = await this.prisma.caseMember.findFirst({ where: { userId: principal.userId, caseId } });
      if (!membership) throw notFound();
      return;
    }

    const record = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { student: { select: { portalUserId: true, contacts: { select: { portalUserId: true, portalStatus: true } } } } },
    });
    const isSelf = record?.student.portalUserId === principal.userId;
    const isLinkedParent = record?.student.contacts.some((c) => c.portalUserId === principal.userId && c.portalStatus === 'ACTIVE') ?? false;
    if (!isSelf && !isLinkedParent) throw notFound();
  }

  leadScopeKindFor(roleCode: string): ScopeKind {
    return LEAD_ROLE_SCOPE[roleCode as RoleCode] ?? ScopeKind.NONE;
  }

  leadListFilter(principal: Principal): Prisma.LeadWhereInput {
    switch (this.leadScopeKindFor(principal.roleCode)) {
      case ScopeKind.GLOBAL:
        return {};
      case ScopeKind.OWN_LEAD:
        return { ownerId: principal.userId };
      default:
        return { id: IMPOSSIBLE_ID };
    }
  }

  async assertLeadAccessible(principal: Principal, leadId: string): Promise<void> {
    const kind = this.leadScopeKindFor(principal.roleCode);
    if (kind === ScopeKind.GLOBAL) return;
    if (kind === ScopeKind.NONE) throw notFound();

    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { ownerId: true } });
    if (!lead || lead.ownerId !== principal.userId) throw notFound();
  }

  contractScopeKindFor(roleCode: string): ScopeKind {
    return CONTRACT_ROLE_SCOPE[roleCode as RoleCode] ?? ScopeKind.NONE;
  }

  contractListFilter(principal: Principal): Prisma.ContractWhereInput {
    switch (this.contractScopeKindFor(principal.roleCode)) {
      case ScopeKind.GLOBAL:
        return {};
      case ScopeKind.OWN_STUDENT:
        return { student: { OR: [{ portalUserId: principal.userId }, { contacts: { some: { portalUserId: principal.userId, portalStatus: 'ACTIVE' } } }] } };
      default:
        return { id: IMPOSSIBLE_ID };
    }
  }

  async assertContractAccessible(principal: Principal, contractId: string): Promise<void> {
    const kind = this.contractScopeKindFor(principal.roleCode);
    if (kind === ScopeKind.GLOBAL) return;
    if (kind === ScopeKind.NONE) throw notFound();

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { student: { select: { portalUserId: true, contacts: { select: { portalUserId: true, portalStatus: true } } } } },
    });
    const isSelf = contract?.student.portalUserId === principal.userId;
    const isLinkedParent = contract?.student.contacts.some((c) => c.portalUserId === principal.userId && c.portalStatus === 'ACTIVE') ?? false;
    if (!isSelf && !isLinkedParent) throw notFound();
  }

  /// Payment carries no `studentId`/`ownerId` of its own — scope is resolved through its
  /// parent Contract's Student, one hop further than `assertContractAccessible`. Used for
  /// standalone `GET/POST /payments/:id/...` routes; a `GET /contracts/:id/payments` list
  /// only needs `assertContractAccessible` on the parent (contract-level access already
  /// fully gates every payment under it — no separate list filter needed).
  async assertPaymentAccessible(principal: Principal, paymentId: string): Promise<void> {
    const kind = this.contractScopeKindFor(principal.roleCode);
    if (kind === ScopeKind.GLOBAL) return;
    if (kind === ScopeKind.NONE) throw notFound();

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { contract: { select: { student: { select: { portalUserId: true, contacts: { select: { portalUserId: true, portalStatus: true } } } } } } },
    });
    const isSelf = payment?.contract.student.portalUserId === principal.userId;
    const isLinkedParent = payment?.contract.student.contacts.some((c) => c.portalUserId === principal.userId && c.portalStatus === 'ACTIVE') ?? false;
    if (!isSelf && !isLinkedParent) throw notFound();
  }

  /// Task reuses `ROLE_SCOPE` (the same Student/Case scope map, `scopeKindFor` above) —
  /// deliberately NOT a fourth scope map, since 06-operations/01_TASK.md's own wording is
  /// "task phải thuộc đúng Student/Case scope," not a Task-specific rule. STUDENT_PARENT
  /// gets zero `tasks:*` permission grant at all in this phase (Task Engine is internal
  /// staff tooling — a task's free-text `blocker`/`output` fields are the same kind of
  /// internal-commentary content SRS §13 already restricts from Student/Parent as
  /// "Internal notes"), so `OWN_STUDENT` never actually reaches this method in practice —
  /// see docs/ASSUMPTIONS.md ASM-16.
  ///
  /// A CASE_MEMBER-scoped caller additionally always sees tasks they personally own, even
  /// if (for a case-less task, `caseId` null, or a case they're not a member of) case
  /// membership alone wouldn't cover it — "My Tasks" must work for a task's owner
  /// regardless of the case-membership half of their scope.
  taskListFilter(principal: Principal): Prisma.TaskWhereInput {
    switch (this.scopeKindFor(principal.roleCode)) {
      case ScopeKind.GLOBAL:
        return {};
      case ScopeKind.CASE_MEMBER:
        return { OR: [{ case: { members: { some: { userId: principal.userId } } } }, { ownerId: principal.userId }] };
      case ScopeKind.OWN_STUDENT:
      case ScopeKind.NONE:
      default:
        return { id: IMPOSSIBLE_ID };
    }
  }

  async assertTaskAccessible(principal: Principal, taskId: string): Promise<void> {
    const kind = this.scopeKindFor(principal.roleCode);
    if (kind === ScopeKind.GLOBAL) return;
    if (kind === ScopeKind.NONE || kind === ScopeKind.OWN_STUDENT) throw notFound();

    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { ownerId: true, caseId: true } });
    if (!task) throw notFound();
    if (task.ownerId === principal.userId) return;
    if (!task.caseId) throw notFound();

    const membership = await this.prisma.caseMember.findFirst({ where: { userId: principal.userId, caseId: task.caseId } });
    if (!membership) throw notFound();
  }
}

// A value no real UUID primary key will ever equal — cheaper and simpler than special-
// casing "return zero rows" in every caller of a *ListFilter method.
const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000';

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found.' });
}
