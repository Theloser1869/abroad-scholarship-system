import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Roadmap, RoadmapStatus } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { TaskGenerationService } from '../../case-management/tasks/task-generation.service';
import { ApproveRoadmapDto } from './dto/approve-roadmap.dto';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { RejectRoadmapDto } from './dto/reject-roadmap.dto';

/// SRS 6.5 workflow — Draft→Review→Approved→Active→Completed→Archived, each transition
/// its own precondition, never a bare status PATCH. Reuses `assertCaseAccessible`
/// directly, same as Assessment/Task (docs/ASSUMPTIONS.md ASM-16 reasoning).
const POST_APPROVAL_TRANSITIONS: Record<RoadmapStatus, RoadmapStatus[]> = {
  DRAFT: [],
  REVIEW: [],
  APPROVED: ['ACTIVE'],
  ACTIVE: ['COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

@Injectable()
export class RoadmapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly taskGeneration: TaskGenerationService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<Roadmap[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.roadmap.findMany({ where: { caseId }, orderBy: { version: 'desc' }, include: { milestones: true } });
  }

  async getById(principal: Principal, id: string) {
    const roadmap = await this.prisma.roadmap.findUnique({ where: { id }, include: { milestones: true } });
    if (!roadmap) throw new NotFoundException({ code: 'ROADMAP_NOT_FOUND', message: `Roadmap ${id} not found.` });
    await this.scope.assertCaseAccessible(principal, roadmap.caseId);
    return roadmap;
  }

  async create(principal: Principal, caseId: string, dto: CreateRoadmapDto): Promise<Roadmap> {
    await this.scope.assertCaseAccessible(principal, caseId);

    if (dto.assessmentId) {
      const assessment = await this.prisma.assessment.findUnique({ where: { id: dto.assessmentId } });
      if (!assessment || assessment.caseId !== caseId) {
        throw new NotFoundException({ code: 'ASSESSMENT_NOT_FOUND', message: `Assessment ${dto.assessmentId} not found for this case.` });
      }
    }

    const latest = await this.prisma.roadmap.findFirst({ where: { caseId }, orderBy: { version: 'desc' } });
    const nextVersion = (latest?.version ?? 0) + 1;
    return this.prisma.roadmap.create({
      data: { caseId, version: nextVersion, assessmentId: dto.assessmentId, horizonYears: dto.horizonYears },
    });
  }

  async submit(principal: Principal, id: string): Promise<Roadmap> {
    const roadmap = await this.requireStatus(principal, id, ['DRAFT']);
    return this.prisma.roadmap.update({ where: { id: roadmap.id }, data: { status: 'REVIEW' } });
  }

  /// "Roadmap không được Active nếu chưa Approved" — Active is only reachable from
  /// APPROVED via `updateStatus` below, never directly from here. Approval itself requires
  /// a baseline: SRS 6.5 "Roadmap chỉ được approve khi assessment baseline tồn tại," and
  /// that baseline must actually be APPROVED, not merely referenced (a DRAFT/REVIEW
  /// assessment is not a settled baseline yet).
  async approve(principal: Principal, id: string, dto: ApproveRoadmapDto): Promise<Roadmap> {
    const roadmap = await this.requireStatus(principal, id, ['REVIEW']);
    if (!roadmap.assessmentId) {
      throw new ConflictException({ code: 'ASSESSMENT_BASELINE_REQUIRED', message: 'Roadmap has no assessment baseline set.' });
    }
    const assessment = await this.prisma.assessment.findUnique({ where: { id: roadmap.assessmentId } });
    if (assessment?.status !== 'APPROVED') {
      throw new ConflictException({ code: 'ASSESSMENT_BASELINE_NOT_APPROVED', message: 'The referenced assessment baseline must be APPROVED before this roadmap can be approved.' });
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.approval.create({ data: { entityType: 'Roadmap', entityId: id, approverId: principal.userId, decision: 'APPROVED', reason: dto.reason, decidedAt: new Date() } }),
      this.prisma.roadmap.update({ where: { id: roadmap.id }, data: { status: 'APPROVED', approvedById: principal.userId, approvedAt: new Date() } }),
    ]);

    // 07-profile/01_ASSESSMENT_ROADMAP.md "Nếu Roadmap tạo task tự động: phải dùng
    // TaskGenerationService hiện tại và phải đảm bảo idempotency" — idempotent via
    // Task's own (templateId, sourceEntityType, sourceEntityId) unique constraint, same
    // mechanism Case/Contract triggers already use (Phase 06).
    await this.taskGeneration.generateForEvent({
      triggerEvent: 'ROADMAP_APPROVED',
      sourceEntityType: 'Roadmap',
      sourceEntityId: id,
      ownerId: (await this.prisma.case.findUniqueOrThrow({ where: { id: updated.caseId } })).ownerId,
      caseId: updated.caseId,
    });

    return updated;
  }

  async reject(principal: Principal, id: string, dto: RejectRoadmapDto): Promise<Roadmap> {
    const roadmap = await this.requireStatus(principal, id, ['REVIEW']);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.approval.create({ data: { entityType: 'Roadmap', entityId: id, approverId: principal.userId, decision: 'REJECTED', reason: dto.reason, decidedAt: new Date() } }),
      this.prisma.roadmap.update({ where: { id: roadmap.id }, data: { status: 'DRAFT' } }),
    ]);
    return updated;
  }

  async updateStatus(principal: Principal, id: string, newStatus: Exclude<RoadmapStatus, 'DRAFT' | 'REVIEW' | 'APPROVED'>): Promise<Roadmap> {
    const roadmap = await this.requireStatus(principal, id, Object.keys(POST_APPROVAL_TRANSITIONS));
    const allowed = POST_APPROVAL_TRANSITIONS[roadmap.status];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException({
        code: 'INVALID_ROADMAP_STATUS_TRANSITION',
        message: `Cannot move Roadmap from ${roadmap.status} to ${newStatus}.`,
        allowedTransitions: allowed,
      });
    }
    return this.prisma.roadmap.update({ where: { id: roadmap.id }, data: { status: newStatus } });
  }

  private async requireStatus(principal: Principal, id: string, allowed: string[]): Promise<Roadmap> {
    const roadmap = await this.prisma.roadmap.findUnique({ where: { id } });
    if (!roadmap) throw new NotFoundException({ code: 'ROADMAP_NOT_FOUND', message: `Roadmap ${id} not found.` });
    await this.scope.assertCaseAccessible(principal, roadmap.caseId);
    if (!allowed.includes(roadmap.status)) {
      throw new ConflictException({
        code: 'INVALID_ROADMAP_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the roadmap is ${roadmap.status}.`,
      });
    }
    return roadmap;
  }
}
