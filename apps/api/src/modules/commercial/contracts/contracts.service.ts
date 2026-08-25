import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, ContractAmendment, ContractStatus, Prisma } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { EXPORT_ROW_CAP, enforceExportRowCap } from '../../../common/export/export-row-cap';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../../common/security/token.util';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { TaskGenerationService } from '../../case-management/tasks/task-generation.service';
import { NotificationsService } from '../../notifications/notifications/notifications.service';
import { ApproveContractDto } from './dto/approve-contract.dto';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateAmendmentDto } from './dto/create-amendment.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { RejectContractDto } from './dto/reject-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const SORTABLE_FIELDS = ['createdAt', 'value', 'status'] as const;

/// Display-safe student summary — same `select`-scoped pattern as `cases.service.ts`'s
/// `STUDENT_SUMMARY_SELECT` (docs/DECISIONS.md DEC-09), never a bare `include: { student:
/// true } }` (would leak `budget`/`budgetCurrency` regardless of the caller's own field
/// policy). Added for DEC-10 — see docs/DECISIONS.md: a Contract list/detail page cannot
/// render which student a contract belongs to without either this or a forbidden N+1/
/// full-table-scan workaround.
const STUDENT_SUMMARY_SELECT = { select: { id: true, studentCode: true, fullName: true } } as const;

export type ContractWithStudent = Contract & { student: { id: string; studentCode: string; fullName: string } };

/// SRS section 9 Contract status machine. Each of DRAFT/REVIEW/APPROVED/SENT/SIGNED has
/// its own dedicated method with its own preconditions (submit/approve/reject/send/sign)
/// — `updateStatus` only covers the remaining simple forward moves after signing, the
/// same split already used for Lead (CONVERTED) and Case (CLOSED) in Phase 04.
const POST_SIGN_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: [],
  REVIEW: [],
  APPROVED: [],
  SENT: [],
  SIGNED: ['ACTIVE'],
  ACTIVE: ['COMPLETED'],
  COMPLETED: ['LIQUIDATED'],
  LIQUIDATED: ['ARCHIVED'],
  ARCHIVED: [],
};

export interface SendResult {
  contract: Contract;
  reviewToken: string;
  reviewExpiresAt: Date;
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
    private readonly scope: ScopePolicyService,
    private readonly config: ConfigService,
    private readonly taskGeneration: TaskGenerationService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(principal: Principal, query: ContractQueryDto): Promise<PaginatedResult<ContractWithStudent>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.ContractWhereInput = {
      ...this.scope.contractListFilter(principal),
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        orderBy: { [field]: direction },
        skip: (page - 1) * limit,
        take: limit,
        include: { student: STUDENT_SUMMARY_SELECT },
      }),
      this.prisma.contract.count({ where }),
    ]);
    return new PaginatedResult(data as ContractWithStudent[], new PageMeta(page, limit, totalItems));
  }

  async getById(principal: Principal, id: string): Promise<ContractWithStudent> {
    await this.scope.assertContractAccessible(principal, id);
    const contract = await this.prisma.contract.findUnique({ where: { id }, include: { student: STUDENT_SUMMARY_SELECT } });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${id} not found.` });
    return contract as ContractWithStudent;
  }

  /// "Không tạo Student hoặc Case mới chỉ vì tạo Contract" — `dto.studentId` must already
  /// exist; no Student or Case is created here. Case linkage happens at `sign()`, not
  /// creation — see docs/ASSUMPTIONS.md ASM-15.
  async create(dto: CreateContractDto): Promise<Contract> {
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student || student.archivedAt) {
      throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: `Student ${dto.studentId} not found.` });
    }

    const contractCode = await this.idGenerator.nextYearlyCode('HD');
    return this.prisma.contract.create({
      data: {
        contractCode,
        studentId: dto.studentId,
        templateId: dto.templateId,
        servicePackage: dto.servicePackage,
        value: dto.value,
        currency: dto.currency.toUpperCase(),
        mergeFieldValues: (dto.mergeFieldValues ?? undefined) as never,
      },
    });
  }

  /// Hard Rule #4 / 05-commercial "Signed/legal document cannot be overwritten": editable
  /// only while DRAFT. Once submitted, terms are locked pending a review decision — a
  /// rejection sends the contract back to DRAFT (editable again); a signed contract's
  /// terms change only through `createAmendment`, never this method.
  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    const contract = await this.requireStatus(id, ['DRAFT']);
    return this.prisma.contract.update({
      where: { id },
      data: {
        templateId: dto.templateId,
        servicePackage: dto.servicePackage,
        value: dto.value,
        currency: dto.currency?.toUpperCase(),
        mergeFieldValues: (dto.mergeFieldValues ?? contract.mergeFieldValues) as never,
      },
    });
  }

  async submit(id: string): Promise<Contract> {
    await this.requireStatus(id, ['DRAFT']);
    const threshold = Number(this.config.get<string>('CONTRACT_APPROVAL_THRESHOLD_AMOUNT') ?? '5000');
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { status: 'REVIEW', submittedAt: new Date(), approvalThreshold: threshold },
    });
    await this.notifyApprovers(updated);
    return updated;
  }

  /// 06-operations/02_NOTIFICATION.md "approval request." Recipients = every ACTIVE user
  /// holding `contracts:approve` (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER per
  /// docs/security/RBAC_MATRIX.md) — resolved from the actual permission grant, not a
  /// hard-coded role list, so it stays correct if the grant table ever changes. Payload
  /// deliberately excludes `value`/`currency` (Contract's financial fields,
  /// `FieldPolicyService.redactContract`'s own field set) — an approver already holds
  /// `contracts:view` and can open the contract for the real numbers; the notification
  /// itself is not a place to leak financial data (SRS 6.20 "Không đưa dữ liệu nhạy cảm
  /// trực tiếp vào notification body").
  private async notifyApprovers(contract: Contract): Promise<void> {
    const approvers = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', role: { rolePermissions: { some: { permission: { resource: 'contracts', action: 'approve' } } } } },
    });
    for (const approver of approvers) {
      await this.notifications.notifyBothChannels(
        approver.id,
        'CONTRACT_APPROVAL_REQUEST',
        { contractId: contract.id, contractCode: contract.contractCode, studentId: contract.studentId },
        `contract-approval-request:${contract.id}:${approver.id}`,
      );
    }
  }

  /// SRS 6.16 "Approval theo monetary threshold; mức vượt ngưỡng phải chuyển GĐĐH" — a
  /// contract at/above its snapshotted `approvalThreshold` may only be approved by
  /// EXECUTIVE_DIRECTOR; below threshold, DEPARTMENT_MANAGER may approve too (both already
  /// hold `contracts:approve` — this narrows WHICH of the grantees may act on THIS
  /// specific contract, the same "role-permission is necessary but not sufficient" pattern
  /// `CasesService.assertManageable` uses for OWNER-vs-COLLABORATOR).
  async approve(principal: Principal, id: string, dto: ApproveContractDto): Promise<Contract> {
    const contract = await this.requireStatus(id, ['REVIEW']);
    this.assertApproverAllowed(principal, contract);

    await this.prisma.approval.create({
      data: { entityType: 'Contract', entityId: id, approverId: principal.userId, decision: 'APPROVED', reason: dto.reason, decidedAt: new Date() },
    });
    return this.prisma.contract.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: principal.userId, approvedAt: new Date() },
    });
  }

  async reject(principal: Principal, id: string, dto: RejectContractDto): Promise<Contract> {
    const contract = await this.requireStatus(id, ['REVIEW']);
    this.assertApproverAllowed(principal, contract);

    await this.prisma.approval.create({
      data: { entityType: 'Contract', entityId: id, approverId: principal.userId, decision: 'REJECTED', reason: dto.reason, decidedAt: new Date() },
    });
    return this.prisma.contract.update({ where: { id }, data: { status: 'DRAFT' } });
  }

  /// SRS 6.16 "Gửi client review bằng secure link có expiry" — generates a fresh,
  /// single-purpose opaque token (raw value returned ONCE, only its hash stored — same
  /// pattern as password-reset/refresh tokens, docs/security/AUTH_MODEL.md).
  async send(id: string): Promise<SendResult> {
    await this.requireStatus(id, ['APPROVED']);
    const ttlHours = Number(this.config.get<string>('CONTRACT_REVIEW_LINK_TTL_HOURS') ?? '72');
    const reviewToken = generateOpaqueToken();
    const reviewExpiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const [, contract] = await this.prisma.$transaction([
      this.prisma.contractReviewLink.create({
        data: { contractId: id, tokenHash: hashOpaqueToken(reviewToken), expiresAt: reviewExpiresAt },
      }),
      this.prisma.contract.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } }),
    ]);
    return { contract, reviewToken, reviewExpiresAt };
  }

  /// SRS 6.2 "Khi hợp đồng được ký, hệ thống tạo Student ID, Case và liên kết Contract" —
  /// Student already exists by this phase's design (docs/ASSUMPTIONS.md ASM-12); this is
  /// where the Case linkage that SRS describes actually completes. Requires the Student to
  /// already have exactly one active (non-closed/archived) Case — "Không tạo Student hoặc
  /// Case mới chỉ vì tạo Contract" forbids creating one here if none exists.
  async sign(id: string, dto: SignContractDto): Promise<Contract> {
    const contract = await this.requireStatus(id, ['SENT']);

    const activeCase = await this.prisma.case.findFirst({
      where: { studentId: contract.studentId, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
    });
    if (!activeCase) {
      throw new ConflictException({
        code: 'NO_ACTIVE_CASE_FOR_STUDENT',
        message: `Student ${contract.studentId} has no active Case to link this Contract to.`,
      });
    }
    if (activeCase.contractId && activeCase.contractId !== id) {
      throw new ConflictException({ code: 'CASE_ALREADY_LINKED', message: `Case ${activeCase.id} is already linked to a different Contract.` });
    }

    const [signed] = await this.prisma.$transaction([
      this.prisma.contract.update({
        where: { id },
        data: { status: 'SIGNED', signedAt: new Date(), signedDocumentId: dto.signedDocumentId },
      }),
      this.prisma.case.update({ where: { id: activeCase.id }, data: { contractId: id } }),
    ]);
    return signed;
  }

  async updateStatus(
    id: string,
    newStatus: Exclude<ContractStatus, 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SENT' | 'SIGNED'>,
    reason?: string,
  ): Promise<Contract> {
    const contract = await this.requireStatus(id, Object.keys(POST_SIGN_TRANSITIONS) as ContractStatus[]);
    const allowed = POST_SIGN_TRANSITIONS[contract.status];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot move Contract from ${contract.status} to ${newStatus}.`,
        allowedTransitions: allowed,
      });
    }
    const timestampField = { ACTIVE: 'activatedAt', COMPLETED: 'completedAt', LIQUIDATED: 'liquidatedAt', ARCHIVED: 'archivedAt' }[newStatus];

    /// Client Acceptance Remediation GAP-002 (CRITICAL, REQ-CONTRACT-002/CONFLICT-001) —
    /// 11_Quan_ly_hop_dong places PAYMENT as its own stage between SIGNED and ACTIVE; the
    /// customer sheet names no exact threshold (full payment vs. a deposit), so this checks
    /// for at least one payment actually RECEIVED (PARTIALLY_PAID or PAID — see
    /// docs/ASSUMPTIONS.md ASM-88 for the exact threshold decision and
    /// docs/requirements/CLIENT_REQUIREMENT_CONFLICTS.md CONFLICT-001 for why this is
    /// flagged for client confirmation rather than silently assumed final). The payment
    /// check and the status update run in one interactive transaction, and the update
    /// itself is a compare-and-swap (`updateMany` gated on the status this call already
    /// observed) so two concurrent activation attempts — or a payment being refunded
    /// between the check and the commit — can't both succeed.
    /// Client Acceptance Remediation GAP-007 (HIGH, REQ-CASE-014) — 11_Quan_ly_hop_dong
    /// row9 "Hoàn tất | Kiểm tra nghĩa vụ | Dịch vụ hoàn thành, công nợ, tài liệu bàn giao".
    /// ACTIVE -> COMPLETED now requires no unresolved Payment (PENDING/PARTIALLY_PAID/
    /// OVERDUE) on this contract — reuses the exact code (`OUTSTANDING_DEBT_REMAINS`)
    /// Case.close() already uses for the analogous concept, so the frontend's existing
    /// error mapping covers both without a new entry.
    ///
    /// COMPLETED -> LIQUIDATED now requires a non-empty `reason` (freshly supplied or
    /// already on the record) — 11_Quan_ly_hop_dong row10 "Thanh lý | Tạo biên bản thanh
    /// lý | Ngày thanh lý, xác nhận hai bên"; `liquidatedAt` is the date, `closureReason`
    /// is the liquidation-record text.
    const updated = await this.prisma.$transaction(async (tx) => {
      if (newStatus === 'ACTIVE') {
        const receivedCount = await tx.payment.count({ where: { contractId: id, status: { in: ['PARTIALLY_PAID', 'PAID'] } } });
        if (receivedCount === 0) {
          throw new ConflictException({
            code: 'PAYMENT_REQUIRED_FOR_ACTIVATION',
            message: 'This contract has no payment recorded yet — record at least one payment before activating the contract.',
          });
        }
      }
      if (newStatus === 'COMPLETED') {
        const unresolvedCount = await tx.payment.count({ where: { contractId: id, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } } });
        if (unresolvedCount > 0) {
          throw new ConflictException({
            code: 'OUTSTANDING_DEBT_REMAINS',
            message: `${unresolvedCount} payment(s) on this contract are not yet Paid/Refunded/Waived — settle them before completing the contract.`,
            unresolvedCount,
          });
        }
      }
      const closureReason = reason ?? contract.closureReason;
      if (newStatus === 'LIQUIDATED') {
        if (!closureReason || closureReason.trim().length === 0) {
          throw new ConflictException({
            code: 'CLOSURE_REASON_REQUIRED',
            message: 'Liquidating a contract requires a liquidation-record reason.',
          });
        }
      }
      const result = await tx.contract.updateMany({
        where: { id, status: contract.status },
        data: { status: newStatus, [timestampField]: new Date(), ...(newStatus === 'LIQUIDATED' ? { closureReason } : {}) },
      });
      if (result.count === 0) {
        throw new ConflictException({
          code: 'INVALID_STATUS_TRANSITION',
          message: `Contract status changed concurrently — it is no longer ${contract.status}. Reload and retry.`,
        });
      }
      return tx.contract.findUniqueOrThrow({ where: { id } });
    });

    // 06-operations/01_TASK.md "Auto-generated tasks on: ..., contract activation, ...".
    // Only the linked Case (set at `sign()`, see docs/ASSUMPTIONS.md ASM-15) has an owner
    // to assign a generated task to — skip generation if none exists rather than picking
    // an arbitrary fallback owner.
    if (newStatus === 'ACTIVE') {
      const linkedCase = await this.prisma.case.findUnique({ where: { contractId: id } });
      if (linkedCase) {
        await this.taskGeneration.generateForEvent({
          triggerEvent: 'CONTRACT_ACTIVATED',
          sourceEntityType: 'Contract',
          sourceEntityId: id,
          ownerId: linkedCase.ownerId,
          caseId: linkedCase.id,
        });
      }
    }

    return updated;
  }

  /// 05-commercial rule #12 "Amendment phải giữ lịch sử version trước/sau". Only
  /// reachable once the contract has been signed at least once (`signedAt` set) — before
  /// that, `update()` covers editing directly. Rejects a no-op amendment (nothing in the
  /// diff actually differs from the current values).
  async createAmendment(principal: Principal, id: string, dto: CreateAmendmentDto): Promise<ContractAmendment> {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${id} not found.` });
    if (!contract.signedAt) {
      throw new ConflictException({
        code: 'CONTRACT_NOT_YET_SIGNED',
        message: 'Amendments only apply to a contract that has been signed at least once — edit the DRAFT directly before signing.',
      });
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    if (dto.value !== undefined && Number(contract.value) !== dto.value) {
      before.value = contract.value;
      after.value = dto.value;
    }
    if (dto.currency !== undefined && contract.currency !== dto.currency.toUpperCase()) {
      before.currency = contract.currency;
      after.currency = dto.currency.toUpperCase();
    }
    if (dto.servicePackage !== undefined && contract.servicePackage !== dto.servicePackage) {
      before.servicePackage = contract.servicePackage;
      after.servicePackage = dto.servicePackage;
    }
    if (dto.mergeFieldValues !== undefined) {
      before.mergeFieldValues = contract.mergeFieldValues;
      after.mergeFieldValues = dto.mergeFieldValues;
    }
    if (Object.keys(after).length === 0) {
      throw new ConflictException({ code: 'NO_MATERIAL_CHANGE', message: 'Amendment must change at least one contract term.' });
    }

    const amendmentCode = await this.idGenerator.nextYearlyCode('AM');
    const newVersion = contract.version + 1;

    const [amendment] = await this.prisma.$transaction([
      this.prisma.contractAmendment.create({
        data: {
          amendmentCode,
          contractId: id,
          previousVersion: contract.version,
          newVersion,
          before: before as never,
          after: after as never,
          reason: dto.reason,
          approvedById: principal.userId,
          effectiveDate: new Date(dto.effectiveDate),
        },
      }),
      this.prisma.contract.update({
        where: { id },
        data: {
          version: newVersion,
          value: dto.value ?? contract.value,
          currency: dto.currency?.toUpperCase() ?? contract.currency,
          servicePackage: dto.servicePackage ?? contract.servicePackage,
          mergeFieldValues: (dto.mergeFieldValues ?? contract.mergeFieldValues) as never,
        },
      }),
    ]);
    return amendment;
  }

  async listAmendments(principal: Principal, id: string): Promise<ContractAmendment[]> {
    await this.scope.assertContractAccessible(principal, id);
    return this.prisma.contractAmendment.findMany({ where: { contractId: id }, orderBy: { createdAt: 'desc' } });
  }

  async export(principal: Principal): Promise<{ rows: Contract[]; rowCount: number }> {
    const where = this.scope.contractListFilter(principal);
    const rows = await this.prisma.contract.findMany({ where, orderBy: { createdAt: 'desc' }, take: EXPORT_ROW_CAP + 1 });
    enforceExportRowCap(rows, 'contracts in your scope');
    return { rows, rowCount: rows.length };
  }

  private async requireStatus(id: string, allowed: ContractStatus[]): Promise<Contract> {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${id} not found.` });
    if (!allowed.includes(contract.status)) {
      throw new ConflictException({
        code: 'INVALID_CONTRACT_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the contract is ${contract.status}.`,
      });
    }
    return contract;
  }

  private assertApproverAllowed(principal: Principal, contract: Contract): void {
    const threshold = contract.approvalThreshold !== null ? Number(contract.approvalThreshold) : Infinity;
    const overThreshold = Number(contract.value) >= threshold;
    if (overThreshold && principal.roleCode !== 'EXECUTIVE_DIRECTOR') {
      throw new ForbiddenException({
        code: 'APPROVAL_THRESHOLD_EXCEEDED',
        message: `Contracts at or above ${threshold} require EXECUTIVE_DIRECTOR approval.`,
        threshold,
      });
    }
  }
}
