import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Case, CaseStatus, LiquidationConfirmation } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PaymentsService } from '../../commercial/payments/payments.service';
import { ScopeKind, ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CommentsService } from '../../notifications/comments/comments.service';
import { VisaStatusService } from '../../visa/visa-status/visa-status.service';
import { TasksService } from '../tasks/tasks.service';
import { ConfirmHandoverDto } from './dto/confirm-handover.dto';
import { ConfirmLiquidationDto } from './dto/confirm-liquidation.dto';
import { ExecuteClosureDto } from './dto/execute-closure.dto';
import { RequestClosureDto } from './dto/request-closure.dto';

export type ClosureChecklistItemStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
export type ClosureChecklistItemKey = 'DEBT' | 'OPEN_TASKS' | 'VISA' | 'ENROLLMENT' | 'PRE_DEPARTURE' | 'DOCUMENT_HANDOVER';

export interface ClosureChecklistItem {
  key: ClosureChecklistItemKey;
  status: ClosureChecklistItemStatus;
  detail?: string;
}

export interface ClosureStatus {
  caseId: string;
  /// So the frontend Closure page (reachable directly by ADMIN_FINANCE, which holds no
  /// `cases:view` grant at all) can render a header without a second `GET /cases/:id` call.
  caseCode: string;
  caseStatus: CaseStatus;
  checklist: ClosureChecklistItem[];
  readyToClose: boolean;
  handover: { status: 'PENDING' | 'COMPLETED'; handedOverAt: Date | null; recipientName: string | null; notes: string | null };
  liquidation: { status: 'PENDING' | 'LIQUIDATED'; companyConfirmedAt: Date | null; studentParentConfirmedAt: Date | null } | null;
}

/// Reuses the exact error codes the old `CasesService.close()`/`ContractsService.
/// updateStatus()` preconditions already used (`OUTSTANDING_DEBT_REMAINS`, etc.) — the
/// frontend's existing `CODE_MESSAGES` mapping and this engagement's existing e2e
/// assertions both key off these, and DEC-07 didn't ask for new codes, only a 6th
/// (previously nonexistent) precondition.
const CLOSURE_FAILURE_CODES: Record<ClosureChecklistItemKey, string> = {
  DEBT: 'OUTSTANDING_DEBT_REMAINS',
  OPEN_TASKS: 'OPEN_TASKS_REMAIN',
  VISA: 'VISA_IN_PROGRESS',
  ENROLLMENT: 'ENROLLMENT_NOT_CONFIRMED',
  PRE_DEPARTURE: 'PRE_DEPARTURE_CHECKLIST_INCOMPLETE',
  DOCUMENT_HANDOVER: 'DOCUMENT_HANDOVER_INCOMPLETE',
};

/// SRS section 9 status machine — same source-of-truth set `CasesService` uses for its own
/// generic `CLOSABLE_FROM` (kept in sync deliberately; Case's status enum itself did not
/// change for this remediation — see docs/requirements/CLOSURE_LIQUIDATION_DESIGN.md).
const CLOSABLE_FROM: CaseStatus[] = ['OPEN', 'ACTIVE', 'ON_HOLD', 'COMPLETED'];

/// Client Acceptance Remediation DEC-06/07/08 (GAP-007, REQ-CASE-014) — the single, unified
/// Closure/Liquidation workflow replacing the old `ContractsService.updateStatus`
/// (COMPLETED/LIQUIDATED) and `CasesService.close()` paths. HCTH (ADMIN_FINANCE) is the
/// standard executing actor; EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER may exercise an audited
/// exception (`overrideReason` required on every mutating action, never a weaker checklist —
/// see the plan's "Requirements grounded directly in the client's own text"); CONSULTANT may
/// only request (advisory, see Implementation Assumption #1).
@Injectable()
export class ClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly payments: PaymentsService,
    private readonly visaStatus: VisaStatusService,
    private readonly tasks: TasksService,
    private readonly comments: CommentsService,
  ) {}

  /// `allowCaseOwner: true` — CONSULTANT holds `case-closure:view` (granted so it can watch
  /// its own case's checklist progress toward requesting closure), so viewing must accept
  /// the same case-owner check `requestClosure` uses, not just GLOBAL/ADMIN_FINANCE.
  async getChecklist(principal: Principal, caseId: string): Promise<ClosureStatus> {
    const record = await this.assertClosureAccessible(principal, caseId, { allowCaseOwner: true });
    return this.buildStatus(record);
  }

  /// For callers (currently only `PortalService`) that have already done their own,
  /// different authorization check (`assertStudentAccessible` for a Student/Parent, not
  /// this module's staff-oriented `assertClosureAccessible`) — same trust boundary already
  /// used by `confirmLiquidationStudentParent` below, not a second auth concept.
  async getStatusForCase(caseId: string): Promise<ClosureStatus> {
    const record = await this.getCaseOrThrow(caseId);
    return this.buildStatus(record);
  }

  /// DEC-06 — advisory only (Implementation Assumption #1): visible to HCTH via the Case
  /// timeline, never a precondition `close()` checks.
  async requestClosure(principal: Principal, caseId: string, dto: RequestClosureDto): Promise<void> {
    await this.assertClosureAccessible(principal, caseId, { allowCaseOwner: true });
    await this.comments.create('Case', caseId, principal.userId, `[Đề nghị đóng hồ sơ] ${dto.reason}`, 'internal');
  }

  /// DEC-07's "Tài liệu bàn giao" item — deliberately never auto-inferred as
  /// NOT_APPLICABLE; must be explicitly confirmed by HCTH (or an audited ED/DM override).
  async confirmHandover(principal: Principal, caseId: string, dto: ConfirmHandoverDto): Promise<void> {
    const record = await this.assertClosureAccessible(principal, caseId);
    this.assertOverrideReasonIfNeeded(principal, dto.overrideReason);
    if (!CLOSABLE_FROM.includes(record.status)) {
      throw new ConflictException({ code: 'INVALID_STATUS_TRANSITION', message: `Cannot record handover for a case in status ${record.status}.` });
    }
    await this.prisma.closureHandoverRecord.upsert({
      where: { caseId },
      create: { caseId, status: 'COMPLETED', handedOverAt: new Date(), handedOverById: principal.userId, recipientName: dto.recipientName, notes: dto.notes },
      update: { status: 'COMPLETED', handedOverAt: new Date(), handedOverById: principal.userId, recipientName: dto.recipientName, notes: dto.notes },
    });
  }

  /// DEC-06 — the unified "Hoàn tất" + "Đóng hồ sơ" action (Implementation Assumption #2):
  /// one transaction moves Case -> CLOSED and, if the linked Contract is still ACTIVE,
  /// Contract -> COMPLETED together, eliminating the two-mechanism sync gap GAP-007 found.
  /// Every DEC-07 precondition must be PASS (Visa may be NOT_APPLICABLE) — no exception,
  /// including for an ED/DM override (see the plan's grounded-requirements section).
  async close(principal: Principal, caseId: string, dto: ExecuteClosureDto): Promise<Case> {
    const record = await this.assertClosureAccessible(principal, caseId);
    this.assertOverrideReasonIfNeeded(principal, dto.overrideReason);
    if (!CLOSABLE_FROM.includes(record.status)) {
      throw new ConflictException({ code: 'INVALID_STATUS_TRANSITION', message: `Cannot close a Case in status ${record.status}.` });
    }

    const status = await this.buildStatus(record);
    const failing = status.checklist.find((item) => item.status === 'FAIL');
    if (failing) {
      throw new ConflictException({
        code: CLOSURE_FAILURE_CODES[failing.key],
        message: failing.detail ?? `Closure precondition failed: ${failing.key}.`,
        item: failing.key,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.case.update({
        where: { id: caseId },
        data: { status: 'CLOSED', closureReason: dto.closureReason, closedAt: new Date() },
      });
      if (record.contractId) {
        const contract = await tx.contract.findUnique({ where: { id: record.contractId } });
        if (contract && contract.status === 'ACTIVE') {
          await tx.contract.update({ where: { id: contract.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        }
      }
      return updated;
    });
  }

  /// DEC-08 — company side of the two-party liquidation confirmation.
  async confirmLiquidationCompany(principal: Principal, caseId: string, dto: ConfirmLiquidationDto): Promise<LiquidationConfirmation> {
    const record = await this.assertClosureAccessible(principal, caseId);
    this.assertOverrideReasonIfNeeded(principal, dto.overrideReason);
    return this.confirmLiquidationSide(record, 'companyConfirmedAt', 'companyConfirmedById', principal.userId);
  }

  /// DEC-08 — student/parent side, called from `PortalService` only. The acting principal
  /// has already been resolved and scope-checked by `PortalService`'s existing
  /// `resolveCase`/`assertStudentAccessible` (defense in depth, same pattern every other
  /// cross-domain portal call uses) — no second authorization concept invented here.
  async confirmLiquidationStudentParent(caseId: string, principal: Principal): Promise<LiquidationConfirmation> {
    const record = await this.getCaseOrThrow(caseId);
    return this.confirmLiquidationSide(record, 'studentParentConfirmedAt', 'studentParentConfirmedById', principal.userId);
  }

  private async confirmLiquidationSide(
    record: Case,
    atField: 'companyConfirmedAt' | 'studentParentConfirmedAt',
    byField: 'companyConfirmedById' | 'studentParentConfirmedById',
    userId: string,
  ): Promise<LiquidationConfirmation> {
    if (record.status !== 'CLOSED') {
      throw new ConflictException({ code: 'CASE_NOT_CLOSED', message: 'Liquidation can only be confirmed after the case is closed.' });
    }
    const existing = await this.prisma.liquidationConfirmation.findUnique({ where: { caseId: record.id } });
    if (existing?.status === 'LIQUIDATED') {
      throw new ConflictException({ code: 'ALREADY_LIQUIDATED', message: 'This case has already been liquidated; confirmations are immutable.' });
    }
    const now = new Date();
    const saved = await this.prisma.liquidationConfirmation.upsert({
      where: { caseId: record.id },
      create: { caseId: record.id, [atField]: now, [byField]: userId },
      update: { [atField]: now, [byField]: userId },
    });
    return this.finalizeLiquidationIfBothConfirmed(record, saved);
  }

  private async finalizeLiquidationIfBothConfirmed(record: Case, confirmation: LiquidationConfirmation): Promise<LiquidationConfirmation> {
    if (!confirmation.companyConfirmedAt || !confirmation.studentParentConfirmedAt) return confirmation;
    return this.prisma.$transaction(async (tx) => {
      const finalized = await tx.liquidationConfirmation.update({
        where: { caseId: record.id },
        data: { status: 'LIQUIDATED', liquidatedAt: new Date() },
      });
      if (record.contractId) {
        const contract = await tx.contract.findUnique({ where: { id: record.contractId } });
        if (contract && contract.status === 'COMPLETED') {
          await tx.contract.update({
            where: { id: contract.id },
            data: {
              status: 'LIQUIDATED',
              liquidatedAt: new Date(),
              closureReason: contract.closureReason ?? 'Thanh lý theo xác nhận hai bên qua Closure workflow hợp nhất (DEC-08).',
            },
          });
        }
      }
      return finalized;
    });
  }

  private async buildStatus(record: Case): Promise<ClosureStatus> {
    const [debt, openTaskCount, visa, enrollmentUnconfirmed, preDepartureIncomplete, handover, liquidation] = await Promise.all([
      this.payments.hasOutstandingDebtForCase(record.id),
      this.tasks.countOpenForCase(record.id),
      this.visaStatus.getClosureStatus(record.id),
      this.visaStatus.hasUnconfirmedRequiredEnrollment(record.id),
      this.visaStatus.hasIncompletePreDepartureChecklist(record.id),
      this.prisma.closureHandoverRecord.findUnique({ where: { caseId: record.id } }),
      this.prisma.liquidationConfirmation.findUnique({ where: { caseId: record.id } }),
    ]);

    const checklist: ClosureChecklistItem[] = [
      {
        key: 'DEBT',
        status: debt ? 'FAIL' : 'PASS',
        detail: debt ? 'This case has unresolved payments (pending, partially paid, or overdue) — settle them before closing.' : undefined,
      },
      {
        key: 'OPEN_TASKS',
        status: openTaskCount > 0 ? 'FAIL' : 'PASS',
        detail: openTaskCount > 0 ? `${openTaskCount} task(s) on this case are not Done/Cancelled — resolve them before closing.` : undefined,
      },
      { key: 'VISA', status: visa, detail: visa === 'FAIL' ? 'This case has a visa that is not yet Granted, Refused, or Withdrawn — resolve it before closing.' : undefined },
      {
        key: 'ENROLLMENT',
        status: enrollmentUnconfirmed ? 'FAIL' : 'PASS',
        detail: enrollmentUnconfirmed ? 'This case has an application in progress but no confirmed enrollment — confirm or withdraw it before closing.' : undefined,
      },
      {
        key: 'PRE_DEPARTURE',
        status: preDepartureIncomplete ? 'FAIL' : 'PASS',
        detail: preDepartureIncomplete ? 'This case has required pre-departure checklist items that are not yet Done or Waived — complete them before closing.' : undefined,
      },
      {
        key: 'DOCUMENT_HANDOVER',
        status: handover?.status === 'COMPLETED' ? 'PASS' : 'FAIL',
        detail: handover?.status === 'COMPLETED' ? undefined : 'Document handover has not been confirmed yet — record it before closing.',
      },
    ];

    const readyToClose =
      CLOSABLE_FROM.includes(record.status) && checklist.every((item) => item.status === 'PASS' || item.status === 'NOT_APPLICABLE');

    return {
      caseId: record.id,
      caseCode: record.caseCode,
      caseStatus: record.status,
      checklist,
      readyToClose,
      handover: {
        status: handover?.status ?? 'PENDING',
        handedOverAt: handover?.handedOverAt ?? null,
        recipientName: handover?.recipientName ?? null,
        notes: handover?.notes ?? null,
      },
      liquidation: liquidation
        ? { status: liquidation.status, companyConfirmedAt: liquidation.companyConfirmedAt, studentParentConfirmedAt: liquidation.studentParentConfirmedAt }
        : null,
    };
  }

  private async getCaseOrThrow(id: string): Promise<Case> {
    const record = await this.prisma.case.findUnique({ where: { id } });
    if (!record || record.archivedAt) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${id} not found.` });
    }
    return record;
  }

  /// Deliberately NOT `ScopePolicyService.assertCaseAccessible` (which stays NONE for
  /// ADMIN_FINANCE) — see the plan's Implementation Assumption #3 for why Closure is a
  /// narrow, dedicated authorization surface rather than broadened general Case access.
  private async assertClosureAccessible(principal: Principal, caseId: string, opts: { allowCaseOwner?: boolean } = {}): Promise<Case> {
    const record = await this.getCaseOrThrow(caseId);
    if (this.scope.scopeKindFor(principal.roleCode) === ScopeKind.GLOBAL || principal.roleCode === 'ADMIN_FINANCE') {
      return record;
    }
    if (opts.allowCaseOwner) {
      const membership = await this.prisma.caseMember.findUnique({ where: { caseId_userId: { caseId, userId: principal.userId } } });
      if (membership && !membership.removedAt && membership.role === 'OWNER') return record;
    }
    throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: "You do not have access to this case's closure workflow." });
  }

  /// DEC-06 exception rule, applied uniformly to every HCTH-owned mutating action: "phải có
  /// authorized role, phải có reason, phải audit, không được là bypass âm thầm."
  private assertOverrideReasonIfNeeded(principal: Principal, overrideReason?: string): void {
    if (principal.roleCode !== 'ADMIN_FINANCE' && !overrideReason?.trim()) {
      throw new ConflictException({
        code: 'OVERRIDE_REASON_REQUIRED',
        message: 'Executing this action as Director/Manager requires an override reason.',
      });
    }
  }
}
