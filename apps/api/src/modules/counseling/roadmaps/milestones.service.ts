import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MilestoneStatus, RoadmapMilestone } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopeKind, ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CreateTaskDto } from '../../case-management/tasks/dto/create-task.dto';
import { TasksService, TaskWithComputed } from '../../case-management/tasks/tasks.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { AddMilestoneDependencyDto } from './dto/add-milestone-dependency.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { UpdateMilestoneStatusDto } from './dto/update-milestone-status.dto';

const TERMINAL_STATUSES: MilestoneStatus[] = ['DONE', 'CANCELLED'];

/// Same FSM shape as `TaskStatus` (MilestoneStatus is the identical enum) — mirrors
/// `TasksService.TASK_TRANSITIONS`, not shared code, since Milestone and Task are
/// different entities with independently-evolvable transition rules even though they
/// happen to coincide today.
const MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

/// 07-profile/01_ASSESSMENT_ROADMAP.md milestone rules. Task linkage delegates entirely to
/// `TasksService` (Phase 06) — "Không duplicate Task entity hoặc workflow." Milestone
/// dependency (`RoadmapMilestoneDependency`) is its own, separate graph from
/// `TaskDependency` — a planning-level concern, not task-execution ordering.
@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly tasks: TasksService,
    private readonly documents: DocumentsService,
  ) {}

  async listForRoadmap(principal: Principal, roadmapId: string): Promise<RoadmapMilestone[]> {
    const roadmap = await this.requireRoadmap(principal, roadmapId);
    return this.prisma.roadmapMilestone.findMany({ where: { roadmapId: roadmap.id }, orderBy: { createdAt: 'asc' } });
  }

  async getById(principal: Principal, id: string): Promise<RoadmapMilestone> {
    const milestone = await this.findOrThrow(id);
    await this.assertRoadmapCaseAccessible(principal, milestone.roadmapId);
    return milestone;
  }

  async create(principal: Principal, roadmapId: string, dto: CreateMilestoneDto): Promise<RoadmapMilestone> {
    const roadmap = await this.requireRoadmap(principal, roadmapId);
    if (dto.ownerId) await this.assertValidOwner(roadmap.caseId, dto.ownerId);

    return this.prisma.roadmapMilestone.create({
      data: {
        roadmapId: roadmap.id,
        stage: dto.stage,
        objective: dto.objective,
        metric: dto.metric,
        target: dto.target,
        ownerId: dto.ownerId,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateMilestoneDto): Promise<RoadmapMilestone> {
    const milestone = await this.findOrThrow(id);
    const roadmap = await this.assertRoadmapCaseAccessible(principal, milestone.roadmapId);
    if (TERMINAL_STATUSES.includes(milestone.status)) {
      throw new ConflictException({ code: 'MILESTONE_TERMINAL_STATE', message: `Milestone is ${milestone.status} — its definition can no longer be edited.` });
    }
    if (dto.ownerId) await this.assertValidOwner(roadmap.caseId, dto.ownerId);

    return this.prisma.roadmapMilestone.update({
      where: { id },
      data: {
        stage: dto.stage,
        objective: dto.objective,
        metric: dto.metric,
        target: dto.target,
        ownerId: dto.ownerId,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
  }

  /// "Milestone không được Completed nếu còn prerequisite bắt buộc chưa hoàn thành" — DONE
  /// requires every milestone this one depends on AND every Task linked to it
  /// (`Task.milestoneId`) to already be DONE or CANCELLED.
  async updateStatus(principal: Principal, id: string, dto: UpdateMilestoneStatusDto): Promise<RoadmapMilestone> {
    const milestone = await this.findOrThrow(id);
    await this.assertRoadmapCaseAccessible(principal, milestone.roadmapId);

    const allowed = MILESTONE_TRANSITIONS[milestone.status];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException({
        code: 'INVALID_MILESTONE_STATUS_TRANSITION',
        message: `Cannot move Milestone from ${milestone.status} to ${dto.status}.`,
        allowedTransitions: allowed,
      });
    }

    if (dto.status === 'DONE') {
      const [deps, tasks] = await Promise.all([
        this.prisma.roadmapMilestoneDependency.findMany({ where: { milestoneId: id }, select: { dependsOnMilestone: { select: { id: true, status: true } } } }),
        this.prisma.task.findMany({ where: { milestoneId: id }, select: { id: true, status: true } }),
      ]);
      const unmetMilestones = deps.filter((d) => !TERMINAL_STATUSES.includes(d.dependsOnMilestone.status)).map((d) => d.dependsOnMilestone.id);
      const unmetTasks = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED').map((t) => t.id);
      if (unmetMilestones.length > 0 || unmetTasks.length > 0) {
        throw new ConflictException({
          code: 'PREREQUISITE_NOT_DONE',
          message: 'All prerequisite milestones and linked tasks must be Done or Cancelled before this milestone can be marked Done.',
          unmetMilestoneIds: unmetMilestones,
          unmetTaskIds: unmetTasks,
        });
      }
    }

    return this.prisma.roadmapMilestone.update({ where: { id }, data: { status: dto.status } });
  }

  async addDependency(principal: Principal, id: string, dto: AddMilestoneDependencyDto): Promise<void> {
    const milestone = await this.findOrThrow(id);
    await this.assertRoadmapCaseAccessible(principal, milestone.roadmapId);
    if (dto.dependsOnMilestoneId === id) {
      throw new ConflictException({ code: 'SELF_DEPENDENCY', message: 'A milestone cannot depend on itself.' });
    }
    const target = await this.findOrThrow(dto.dependsOnMilestoneId);
    if (target.roadmapId !== milestone.roadmapId) {
      throw new ConflictException({ code: 'CROSS_ROADMAP_DEPENDENCY', message: 'A milestone can only depend on another milestone in the same roadmap.' });
    }

    if (await this.wouldCreateCycle(id, dto.dependsOnMilestoneId)) {
      throw new ConflictException({ code: 'CIRCULAR_DEPENDENCY', message: 'Adding this dependency would create a circular dependency chain.' });
    }

    try {
      await this.prisma.roadmapMilestoneDependency.create({ data: { milestoneId: id, dependsOnMilestoneId: dto.dependsOnMilestoneId } });
    } catch (err) {
      const isUniqueViolation = err instanceof Object && 'code' in err && (err as { code?: string }).code === 'P2002';
      if (isUniqueViolation) throw new ConflictException({ code: 'DUPLICATE_DEPENDENCY', message: 'This dependency already exists.' });
      throw err;
    }
  }

  async removeDependency(principal: Principal, id: string, dependsOnMilestoneId: string): Promise<void> {
    const milestone = await this.findOrThrow(id);
    await this.assertRoadmapCaseAccessible(principal, milestone.roadmapId);
    const existing = await this.prisma.roadmapMilestoneDependency.findUnique({ where: { milestoneId_dependsOnMilestoneId: { milestoneId: id, dependsOnMilestoneId } } });
    if (!existing) throw new NotFoundException({ code: 'DEPENDENCY_NOT_FOUND', message: 'This dependency does not exist.' });
    await this.prisma.roadmapMilestoneDependency.delete({ where: { milestoneId_dependsOnMilestoneId: { milestoneId: id, dependsOnMilestoneId } } });
  }

  async listTasks(principal: Principal, id: string) {
    const milestone = await this.findOrThrow(id);
    await this.assertRoadmapCaseAccessible(principal, milestone.roadmapId);
    return this.prisma.task.findMany({ where: { milestoneId: id }, orderBy: { deadline: 'asc' } });
  }

  /// Delegates entirely to `TasksService.createForCase` — the one and only Task-creation
  /// path in this codebase.
  async createTask(principal: Principal, id: string, dto: CreateTaskDto): Promise<TaskWithComputed> {
    const milestone = await this.findOrThrow(id);
    const roadmap = await this.assertRoadmapCaseAccessible(principal, milestone.roadmapId);
    return this.tasks.createForCase(principal, roadmap.caseId, dto, id);
  }

  /// Phase 11 (Portal) — "Không cho Student tự đánh dấu milestone Completed... nếu Student
  /// chỉ được acknowledge/submit evidence: implement đúng capability đó." Deliberately
  /// narrower than `update()` above: only ever writes `evidenceDocumentId`, never
  /// `status`/`objective`/`target`/`ownerId`/`deadline` — a student attaching evidence
  /// never advances the milestone's own workflow state.
  async submitEvidence(caseId: string, milestoneId: string, documentId: string): Promise<RoadmapMilestone> {
    const milestone = await this.findOrThrow(milestoneId);
    const roadmap = await this.prisma.roadmap.findUniqueOrThrow({ where: { id: milestone.roadmapId } });
    if (roadmap.caseId !== caseId) {
      throw new NotFoundException({ code: 'MILESTONE_NOT_FOUND', message: `Milestone ${milestoneId} not found.` });
    }
    const updated = await this.prisma.roadmapMilestone.update({ where: { id: milestoneId }, data: { evidenceDocumentId: documentId } });
    await this.documents.grantCaseAccess(documentId, caseId);
    return updated;
  }

  private async findOrThrow(id: string): Promise<RoadmapMilestone> {
    const milestone = await this.prisma.roadmapMilestone.findUnique({ where: { id } });
    if (!milestone) throw new NotFoundException({ code: 'MILESTONE_NOT_FOUND', message: `Milestone ${id} not found.` });
    return milestone;
  }

  private async requireRoadmap(principal: Principal, roadmapId: string) {
    const roadmap = await this.prisma.roadmap.findUnique({ where: { id: roadmapId } });
    if (!roadmap) throw new NotFoundException({ code: 'ROADMAP_NOT_FOUND', message: `Roadmap ${roadmapId} not found.` });
    await this.scope.assertCaseAccessible(principal, roadmap.caseId);
    return roadmap;
  }

  private async assertRoadmapCaseAccessible(principal: Principal, roadmapId: string) {
    return this.requireRoadmap(principal, roadmapId);
  }

  /// "Owner phải thuộc scope hợp lệ" — a milestone owner must either be a member of the
  /// roadmap's Case, or hold a GLOBAL-scope role (oversight roles may assign work without
  /// first being added as a formal case member).
  private async assertValidOwner(caseId: string, ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, include: { role: true } });
    if (!owner || owner.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'OWNER_NOT_FOUND', message: `User ${ownerId} not found or not active.` });
    }
    if (this.scope.scopeKindFor(owner.role.code) === ScopeKind.GLOBAL) return;
    const membership = await this.prisma.caseMember.findUnique({ where: { caseId_userId: { caseId, userId: ownerId } } });
    if (!membership || membership.removedAt) {
      throw new ConflictException({ code: 'INVALID_MILESTONE_OWNER', message: `User ${ownerId} is not a member of this roadmap's case.` });
    }
  }

  /// Would adding `milestoneId depends on candidateId` create a cycle? Same graph-walk
  /// shape as `TasksService.wouldCreateCycle`, over `RoadmapMilestoneDependency` instead.
  private async wouldCreateCycle(milestoneId: string, candidateId: string): Promise<boolean> {
    const visited = new Set<string>();
    let frontier = [candidateId];
    while (frontier.length > 0) {
      const rows = await this.prisma.roadmapMilestoneDependency.findMany({ where: { milestoneId: { in: frontier } }, select: { dependsOnMilestoneId: true } });
      const next: string[] = [];
      for (const row of rows) {
        if (row.dependsOnMilestoneId === milestoneId) return true;
        if (!visited.has(row.dependsOnMilestoneId)) {
          visited.add(row.dependsOnMilestoneId);
          next.push(row.dependsOnMilestoneId);
        }
      }
      frontier = next;
    }
    return false;
  }
}
