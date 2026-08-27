import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Case, CaseMember, CaseStage, CaseStatus, Prisma } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopeKind, ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { TaskGenerationService } from '../tasks/task-generation.service';
import { AddCaseMemberDto } from './dto/add-case-member.dto';
import { CaseQueryDto } from './dto/case-query.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseStageDto } from './dto/update-case-stage.dto';

const SORTABLE_FIELDS = ['createdAt', 'stage', 'status', 'openedAt'] as const;

/// Display-safe summaries — never a full `include: { student: true }`/`{ owner: true }`
/// (the latter would leak `passwordHash` and other sensitive User columns). Phase F03
/// (frontend CRM) fix: `list()`/`getById()` previously returned bare `studentId`/`ownerId`
/// with no way to show a case's student/owner name without either an N+1 fetch per row or
/// pulling the entire Student/User table client-side — both explicitly disallowed by the
/// frontend phase's own instructions. Additive only — no schema/behavior change.
const OWNER_SUMMARY_SELECT = { select: { id: true, username: true, fullName: true } } as const;
const STUDENT_SUMMARY_SELECT = { select: { id: true, studentCode: true, fullName: true } } as const;

export type CaseWithRelations = Case & {
  student: { id: string; studentCode: string; fullName: string };
  owner: { id: string; username: string; fullName: string };
};

export type CaseMemberWithUser = CaseMember & { user: { id: string; username: string; fullName: string } };

/// 04-core-crm/02_STUDENT_CASE.md: "assignment, collaborators, stage transitions, case
/// timeline, closure checks." Every mutation here goes through the same scope check the
/// Phase 03 read paths already use (`ScopePolicyService.assertCaseAccessible`) — cross-
/// case isolation applies to writes exactly as it does to reads, per this phase's
/// explicit "Cross-case isolation is mandatory."
///
/// SRS section 9 status machine — CLOSED is reachable only through the unified
/// `ClosureService.close()` (Client Acceptance Remediation DEC-06/07/08, GAP-007), matching
/// how Lead's CONVERTED is reachable only through `LeadsService.convert()`. This map's own
/// `updateStatus()` below explicitly excludes CLOSED from its allowed target set.
const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ['ACTIVE', 'ON_HOLD'],
  ACTIVE: ['ON_HOLD', 'COMPLETED'],
  ON_HOLD: ['ACTIVE'],
  COMPLETED: ['ARCHIVED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: [],
};

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly idGenerator: IdGeneratorService,
    private readonly taskGeneration: TaskGenerationService,
  ) {}

  async list(principal: Principal, query: CaseQueryDto): Promise<PaginatedResult<CaseWithRelations>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.CaseWhereInput = {
      ...this.scope.caseListFilter(principal),
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.contractId ? { contractId: query.contractId } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        orderBy: { [field]: direction },
        skip: (page - 1) * limit,
        take: limit,
        include: { student: STUDENT_SUMMARY_SELECT, owner: OWNER_SUMMARY_SELECT },
      }),
      this.prisma.case.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(principal: Principal, id: string): Promise<CaseWithRelations> {
    await this.scope.assertCaseAccessible(principal, id);
    const record = await this.prisma.case.findUnique({
      where: { id },
      include: { student: STUDENT_SUMMARY_SELECT, owner: OWNER_SUMMARY_SELECT },
    });
    if (!record || record.archivedAt) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${id} not found.` });
    }
    return record;
  }

  /// A standalone "open a new Case for an existing Student" path, distinct from
  /// `LeadsService.convert()` (which is the primary Lead→Student→Case chain). Blocks a
  /// second concurrent Case on the same Student — "Không tạo duplicate Case cho cùng một
  /// lifecycle nếu business rule không yêu cầu": at most one non-closed/archived Case per
  /// Student at a time is the enforced invariant.
  async createForStudent(principal: Principal, studentId: string, dto: CreateCaseDto): Promise<Case> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.archivedAt) {
      throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: `Student ${studentId} not found.` });
    }

    const existingActive = await this.prisma.case.findFirst({
      where: { studentId, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
    });
    if (existingActive) {
      throw new ConflictException({
        code: 'DUPLICATE_ACTIVE_CASE',
        message: `Student ${studentId} already has an active case (${existingActive.caseCode}).`,
        existingCaseId: existingActive.id,
      });
    }

    const ownerId = dto.ownerId ?? principal.userId;
    const caseCode = await this.idGenerator.nextYearlyCode('CASE');
    const created = await this.prisma.case.create({
      data: { caseCode, studentId, ownerId, stage: dto.stage ?? CaseStage.CONTRACT_SIGNING, department: dto.department },
    });
    await this.prisma.caseMember.create({ data: { caseId: created.id, userId: ownerId, role: 'OWNER' } });
    await this.taskGeneration.generateForEvent({
      triggerEvent: 'CASE_CREATED',
      sourceEntityType: 'Case',
      sourceEntityId: created.id,
      ownerId,
      caseId: created.id,
    });
    return created;
  }

  async updateStage(principal: Principal, id: string, dto: UpdateCaseStageDto): Promise<Case> {
    await this.assertManageable(principal, id);
    const updated = await this.prisma.case.update({ where: { id }, data: { stage: dto.stage, department: dto.department } });
    if (dto.stage) {
      await this.taskGeneration.generateForEvent({
        triggerEvent: 'CASE_STAGE_CHANGED',
        stageValue: dto.stage,
        sourceEntityType: 'Case',
        sourceEntityId: id,
        ownerId: updated.ownerId,
        caseId: id,
      });
    }
    return updated;
  }

  async updateStatus(principal: Principal, id: string, newStatus: Exclude<CaseStatus, 'CLOSED'>): Promise<Case> {
    const record = await this.assertManageable(principal, id);
    const allowed = CASE_TRANSITIONS[record.status];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot move Case from ${record.status} to ${newStatus}.`,
        allowedTransitions: allowed,
      });
    }
    return this.prisma.case.update({ where: { id }, data: { status: newStatus } });
  }

  async addMember(principal: Principal, id: string, dto: AddCaseMemberDto): Promise<CaseMember> {
    await this.assertManageable(principal, id);
    return this.prisma.caseMember.upsert({
      where: { caseId_userId: { caseId: id, userId: dto.userId } },
      update: { role: dto.role, removedAt: null },
      create: { caseId: id, userId: dto.userId, role: dto.role },
    });
  }

  async removeMember(principal: Principal, id: string, userId: string): Promise<void> {
    await this.assertManageable(principal, id);
    const membership = await this.prisma.caseMember.findUnique({ where: { caseId_userId: { caseId: id, userId } } });
    if (!membership || membership.removedAt) {
      throw new NotFoundException({ code: 'CASE_MEMBER_NOT_FOUND', message: `User ${userId} is not an active member of case ${id}.` });
    }
    await this.prisma.caseMember.update({ where: { caseId_userId: { caseId: id, userId } }, data: { removedAt: new Date() } });
  }

  /// Phase 13 fix (UAT finding: `addMember(role: OWNER)` alone left `Case.ownerId` stale
  /// and could produce multiple co-existing OWNER `CaseMember` rows with no single
  /// authoritative answer to "who owns this case now" — a real Manager-workflow gap, not
  /// just a naming one). The only path that both demotes every current OWNER to
  /// COLLABORATOR and updates `Case.ownerId` in the same transaction — a true transfer,
  /// not an additive grant.
  async reassignOwner(principal: Principal, id: string, newOwnerUserId: string): Promise<Case> {
    await this.assertManageable(principal, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.caseMember.updateMany({
        where: { caseId: id, role: 'OWNER', removedAt: null, userId: { not: newOwnerUserId } },
        data: { role: 'COLLABORATOR' },
      });
      await tx.caseMember.upsert({
        where: { caseId_userId: { caseId: id, userId: newOwnerUserId } },
        update: { role: 'OWNER', removedAt: null },
        create: { caseId: id, userId: newOwnerUserId, role: 'OWNER' },
      });
      return tx.case.update({ where: { id }, data: { ownerId: newOwnerUserId } });
    });
  }

  async listMembers(principal: Principal, id: string): Promise<CaseMemberWithUser[]> {
    await this.scope.assertCaseAccessible(principal, id);
    return this.prisma.caseMember.findMany({
      where: { caseId: id, removedAt: null },
      orderBy: { addedAt: 'asc' },
      include: { user: OWNER_SUMMARY_SELECT },
    });
  }

  /// Record-scope (read access) plus a stricter "may I manage membership/stage/status"
  /// check: a GLOBAL-scope role may always manage; a CASE_MEMBER-scope role (Consultant,
  /// Document Specialist) must hold the OWNER CaseMember role on THIS case specifically —
  /// being a mere COLLABORATOR is enough to view but not to reassign/close.
  private async assertManageable(principal: Principal, id: string): Promise<Case> {
    const record = await this.getById(principal, id);
    const kind = this.scope.scopeKindFor(principal.roleCode);
    if (kind === ScopeKind.GLOBAL) return record;

    const membership = await this.prisma.caseMember.findUnique({
      where: { caseId_userId: { caseId: id, userId: principal.userId } },
    });
    if (!membership || membership.removedAt || membership.role !== 'OWNER') {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'Only the case owner (or a GLOBAL-scope role) may manage this case.' });
    }
    return record;
  }
}
