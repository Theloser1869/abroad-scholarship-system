import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task, TaskStatus } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopeKind, ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { NotificationsService } from '../../notifications/notifications/notifications.service';
import { AddTaskDependencyDto } from './dto/add-task-dependency.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

const SORTABLE_FIELDS = ['deadline', 'createdAt', 'priority', 'status'] as const;

const TERMINAL_STATUSES: TaskStatus[] = ['DONE', 'CANCELLED'];

/// 06-operations/01_TASK.md status FSM. Every transition is server-validated — "Task
/// status phải được enforce server-side. Không cho phép client tự ý chuyển trạng thái
/// bất hợp lệ." Mirrors the same dedicated-method-per-transition-set pattern already used
/// for Lead/Case/Contract, collapsed into one table here (Task's transitions are simple
/// enough that a single generic `updateStatus` covers all of them, unlike Contract's
/// multi-precondition FSM).
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

export interface TaskWithComputed extends Task {
  isOverdue: boolean;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
    private readonly scope: ScopePolicyService,
    private readonly notifications: NotificationsService,
  ) {}

  /// The one place "overdue" is decided — every read path (list filter, computed field)
  /// funnels through this, per 06-operations/01_TASK.md "Không tạo nhiều implementation
  /// khác nhau cho overdue nếu có thể dùng một domain function/service chung." Unlike
  /// `PaymentStatus.OVERDUE`, `TaskStatus` has no stored OVERDUE value (schema.prisma's
  /// own comment on `TaskStatus`: "derived/system flag, not a value staff sets directly")
  /// — this stays purely computed, never written back to `status`. Comparing two UTC
  /// instants (`Date` in Postgres/Prisma is stored as `timestamptz`) is timezone-safe by
  /// construction — no separate timezone column/config needed.
  isOverdue(task: Pick<Task, 'status' | 'deadline'>): boolean {
    return !TERMINAL_STATUSES.includes(task.status) && task.deadline < new Date();
  }

  withComputed(task: Task): TaskWithComputed {
    return { ...task, isOverdue: this.isOverdue(task) };
  }

  async listForCase(principal: Principal, caseId: string, query: TaskQueryDto): Promise<PaginatedResult<TaskWithComputed>> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.queryTasks(principal, { ...this.filterFor(query), caseId }, query);
  }

  async list(principal: Principal, query: TaskQueryDto): Promise<PaginatedResult<TaskWithComputed>> {
    const where: Prisma.TaskWhereInput = { ...this.scope.taskListFilter(principal), ...this.filterFor(query) };
    if (query.mine) {
      where.ownerId = principal.userId;
    } else if (query.ownerId) {
      where.ownerId = query.ownerId;
    }
    return this.queryTasks(principal, where, query);
  }

  async getById(principal: Principal, id: string): Promise<TaskWithComputed> {
    await this.scope.assertTaskAccessible(principal, id);
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: `Task ${id} not found.` });
    return this.withComputed(task);
  }

  /// Phase 11 (Portal) — `assertTaskAccessible` (above) deliberately 404s every OWN_STUDENT
  /// caller outright (Task Engine was built as internal staff tooling in Phase 06, see
  /// `docs/ASSUMPTIONS.md` ASM-16), so it cannot be reused here. The caller
  /// (`PortalTasksService`) has already verified the principal may access `caseId` itself
  /// (`ScopePolicyService.assertCaseAccessible`); this only additionally requires the task
  /// both belong to that case AND be explicitly marked `visibleToStudent` — "Student không
  /// tự động được thấy tất cả internal staff tasks."
  async listForStudentPortal(caseId: string, query: TaskQueryDto): Promise<PaginatedResult<TaskWithComputed>> {
    const where: Prisma.TaskWhereInput = { caseId, visibleToStudent: true, ...this.filterFor(query) };
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'deadline', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, totalItems] = await this.prisma.$transaction([
      this.prisma.task.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.task.count({ where }),
    ]);
    return new PaginatedResult(rows.map((r) => this.withComputed(r)), new PageMeta(page, limit, totalItems));
  }

  async getForStudentPortal(caseId: string, id: string): Promise<TaskWithComputed> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.caseId !== caseId || !task.visibleToStudent) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: `Task ${id} not found.` });
    }
    return this.withComputed(task);
  }

  /// Portal-permitted output submission — the only Task field a student may ever write
  /// directly (not routed through `applyStatusTransition`). Status changes go through
  /// `portalUpdateStatus` instead, which reuses the exact same FSM as staff.
  async portalSubmitOutput(task: Task, output: string): Promise<TaskWithComputed> {
    const updated = await this.prisma.task.update({ where: { id: task.id }, data: { output } });
    return this.withComputed(updated);
  }

  /// "Nếu task được tạo từ Case: phải giữ đúng caseId/studentId; owner phải hợp lệ; scope
  /// phải được enforce" — caseId comes from the route, never the body; `ownerId` defaults
  /// to the caller but must be a real, active user when supplied explicitly. `milestoneId`
  /// (Phase 07) lets `RoadmapsService`/`MilestonesService` tag a milestone's execution work
  /// onto an ordinary Task, without a second, milestone-specific task implementation
  /// (07-profile/01_ASSESSMENT_ROADMAP.md "Không tạo Task implementation mới").
  async createForCase(principal: Principal, caseId: string, dto: CreateTaskDto, milestoneId?: string): Promise<TaskWithComputed> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const ownerId = dto.ownerId ?? principal.userId;
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'OWNER_NOT_FOUND', message: `User ${ownerId} not found or not active.` });
    }

    const taskCode = await this.idGenerator.nextYearlyCode('TASK');
    const task = await this.prisma.task.create({
      data: {
        taskCode,
        caseId,
        module: dto.module,
        taskType: dto.taskType,
        title: dto.title,
        ownerId,
        priority: dto.priority,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        deadline: new Date(dto.deadline),
        milestoneId,
      },
    });
    await this.notifyAssignment(task);
    return this.withComputed(task);
  }

  /// Only field edits — never `status` (see `updateStatus`) or `ownerId` (see `assign`).
  /// A terminal task's definition is frozen, same "high-consequence state is immutable"
  /// spirit already applied to Contract post-signing (proportionally lighter here — no
  /// amendment-equivalent exists for Task, since re-opening is just a status transition
  /// back to NOT_STARTED/IN_PROGRESS, not a legal-document concern).
  async update(principal: Principal, id: string, dto: UpdateTaskDto): Promise<TaskWithComputed> {
    const existing = await this.requireManageable(principal, id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new ConflictException({ code: 'TASK_TERMINAL_STATE', message: `Task is ${existing.status} — its definition can no longer be edited.` });
    }
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        module: dto.module,
        taskType: dto.taskType,
        title: dto.title,
        priority: dto.priority,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
    return this.withComputed(task);
  }

  async assign(principal: Principal, id: string, dto: AssignTaskDto): Promise<TaskWithComputed> {
    await this.requireManageable(principal, id);
    const owner = await this.prisma.user.findUnique({ where: { id: dto.ownerId } });
    if (!owner || owner.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'OWNER_NOT_FOUND', message: `User ${dto.ownerId} not found or not active.` });
    }
    const task = await this.prisma.task.update({ where: { id }, data: { ownerId: dto.ownerId } });
    await this.notifyAssignment(task);
    return this.withComputed(task);
  }

  /// "Blocked task phải thể hiện blocker hợp lý" — a transition INTO BLOCKED requires a
  /// non-empty `blocker`, either freshly supplied or already on the record. "Completion
  /// phải kiểm tra prerequisite" — a transition INTO DONE requires every task this one
  /// `dependsOn` to already be DONE or CANCELLED (see docs/ASSUMPTIONS.md ASM-17 for why
  /// CANCELLED also satisfies a prerequisite, not just DONE).
  async updateStatus(principal: Principal, id: string, dto: UpdateTaskStatusDto): Promise<TaskWithComputed> {
    const existing = await this.requireManageable(principal, id);
    return this.applyStatusTransition(existing, dto);
  }

  /// Phase 11 (Portal) — the SAME FSM/precondition logic as `updateStatus` above, reused
  /// verbatim (`applyStatusTransition`), but reached through a completely different
  /// authorization gate: a Student/Parent is never the task's `ownerId` nor a Case `OWNER`
  /// member, so `requireManageable` could never pass for them — `PortalTasksService`
  /// checks case-scope + `Task.visibleToStudent` instead, then narrows which target
  /// statuses a student may request at the DTO layer (`PortalUpdateTaskStatusDto`, only
  /// IN_PROGRESS/DONE — never BLOCKED/CANCELLED, which stay staff-only judgment calls).
  /// "task status transition vẫn server-enforced" — this is not a parallel, looser FSM.
  async portalUpdateStatus(task: Task, dto: UpdateTaskStatusDto): Promise<TaskWithComputed> {
    return this.applyStatusTransition(task, dto);
  }

  private async applyStatusTransition(existing: Task, dto: UpdateTaskStatusDto): Promise<TaskWithComputed> {
    const id = existing.id;
    const allowed = TASK_TRANSITIONS[existing.status];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException({
        code: 'INVALID_TASK_STATUS_TRANSITION',
        message: `Cannot move Task from ${existing.status} to ${dto.status}.`,
        allowedTransitions: allowed,
      });
    }

    if (dto.status === 'BLOCKED') {
      const blocker = dto.blocker ?? existing.blocker;
      if (!blocker || blocker.trim().length === 0) {
        throw new ConflictException({ code: 'BLOCKER_REQUIRED', message: 'Moving a task to BLOCKED requires a blocker reason.' });
      }
    }

    if (dto.status === 'DONE') {
      const prerequisites = await this.prisma.taskDependency.findMany({
        where: { taskId: id },
        select: { dependsOnTask: { select: { id: true, status: true } } },
      });
      const unmet = prerequisites.filter((p) => !TERMINAL_STATUSES.includes(p.dependsOnTask.status));
      if (unmet.length > 0) {
        throw new ConflictException({
          code: 'PREREQUISITE_NOT_DONE',
          message: 'All prerequisite tasks must be Done or Cancelled before this task can be marked Done.',
          unmetTaskIds: unmet.map((p) => p.dependsOnTask.id),
        });
      }
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        blocker: dto.blocker ?? existing.blocker,
        output: dto.output ?? existing.output,
        qualityScore: dto.qualityScore ?? existing.qualityScore,
      },
    });

    if (dto.status === 'BLOCKED' && task.caseId) {
      await this.notifyBlocked(task);
    }

    return this.withComputed(task);
  }

  async listDependencies(principal: Principal, id: string): Promise<Task[]> {
    await this.scope.assertTaskAccessible(principal, id);
    const rows = await this.prisma.taskDependency.findMany({ where: { taskId: id }, include: { dependsOnTask: true } });
    return rows.map((r) => r.dependsOnTask);
  }

  /// "không tạo self-dependency", "không tạo circular dependency", "không tạo logic
  /// dependency chỉ ở frontend" — every check below runs server-side, nowhere else.
  async addDependency(principal: Principal, id: string, dto: AddTaskDependencyDto): Promise<void> {
    await this.requireManageable(principal, id);
    if (dto.dependsOnTaskId === id) {
      throw new ConflictException({ code: 'SELF_DEPENDENCY', message: 'A task cannot depend on itself.' });
    }
    await this.scope.assertTaskAccessible(principal, dto.dependsOnTaskId);

    if (await this.wouldCreateCycle(id, dto.dependsOnTaskId)) {
      throw new ConflictException({
        code: 'CIRCULAR_DEPENDENCY',
        message: `Adding this dependency would create a circular dependency chain.`,
      });
    }

    try {
      await this.prisma.taskDependency.create({ data: { taskId: id, dependsOnTaskId: dto.dependsOnTaskId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'DUPLICATE_DEPENDENCY', message: 'This dependency already exists.' });
      }
      throw err;
    }
  }

  async removeDependency(principal: Principal, id: string, dependsOnTaskId: string): Promise<void> {
    await this.requireManageable(principal, id);
    const existing = await this.prisma.taskDependency.findUnique({ where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } } });
    if (!existing) {
      throw new NotFoundException({ code: 'DEPENDENCY_NOT_FOUND', message: 'This dependency does not exist.' });
    }
    await this.prisma.taskDependency.delete({ where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } } });
  }

  /// Would adding `taskId depends on candidateId` create a cycle? True iff `taskId` is
  /// already (transitively) a prerequisite of `candidateId` — i.e. walking FROM
  /// `candidateId` along its own `dependsOn` edges reaches `taskId`.
  private async wouldCreateCycle(taskId: string, candidateId: string): Promise<boolean> {
    const visited = new Set<string>();
    let frontier = [candidateId];
    while (frontier.length > 0) {
      const rows = await this.prisma.taskDependency.findMany({
        where: { taskId: { in: frontier } },
        select: { dependsOnTaskId: true },
      });
      const next: string[] = [];
      for (const row of rows) {
        if (row.dependsOnTaskId === taskId) return true;
        if (!visited.has(row.dependsOnTaskId)) {
          visited.add(row.dependsOnTaskId);
          next.push(row.dependsOnTaskId);
        }
      }
      frontier = next;
    }
    return false;
  }

  /// GLOBAL-scope roles manage any task. CASE_MEMBER-scope roles manage a task if they own
  /// it directly, OR if they're the OWNER CaseMember of its Case (team-lead override) —
  /// same VIEW-(any member)-vs-MANAGE-(owner only) split `CasesService.assertManageable`
  /// already established, applied to Task instead of Case.
  private async requireManageable(principal: Principal, id: string): Promise<Task> {
    await this.scope.assertTaskAccessible(principal, id);
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: `Task ${id} not found.` });

    if (this.scope.scopeKindFor(principal.roleCode) === ScopeKind.GLOBAL) return task;
    if (task.ownerId === principal.userId) return task;
    if (task.caseId) {
      const membership = await this.prisma.caseMember.findUnique({ where: { caseId_userId: { caseId: task.caseId, userId: principal.userId } } });
      if (membership && !membership.removedAt && membership.role === 'OWNER') return task;
    }
    throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'Only the task owner, the case owner, or a GLOBAL-scope role may manage this task.' });
  }

  private filterFor(query: TaskQueryDto): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.module) where.module = query.module;
    if (query.deadlineFrom || query.deadlineTo) {
      where.deadline = {
        ...(query.deadlineFrom ? { gte: new Date(query.deadlineFrom) } : {}),
        ...(query.deadlineTo ? { lte: new Date(query.deadlineTo) } : {}),
      };
    }
    return where;
  }

  private async queryTasks(principal: Principal, where: Prisma.TaskWhereInput, query: TaskQueryDto): Promise<PaginatedResult<TaskWithComputed>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'deadline', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const [rows, totalItems] = await this.prisma.$transaction([
      this.prisma.task.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.task.count({ where }),
    ]);
    let data = rows.map((r) => this.withComputed(r));
    if (query.overdue !== undefined) {
      data = data.filter((t) => t.isOverdue === query.overdue);
    }
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  private async notifyAssignment(task: Task): Promise<void> {
    await this.notifications.notifyBothChannels(
      task.ownerId,
      'TASK_ASSIGNED',
      { taskId: task.id, taskCode: task.taskCode, title: task.title, module: task.module, deadline: task.deadline },
      `task-assigned:${task.id}:${task.ownerId}`,
    );
  }

  /// "status change" (06-operations/02_NOTIFICATION.md) — narrowed to Task's BLOCKED
  /// transition specifically (the one Task status change that genuinely needs someone
  /// else's attention). Recipient is the Case's OWNER — the team lead who needs to know
  /// work stalled — not the task owner itself (no point notifying someone of their own
  /// action). Deduped by a hash of the blocker text, not just the task id, so a
  /// legitimate second block (different reason, e.g. after a first block was resolved and
  /// the task blocked again for a new reason) still notifies — only an exact repeat is
  /// suppressed.
  private async notifyBlocked(task: Task): Promise<void> {
    if (!task.caseId) return;
    const caseRecord = await this.prisma.case.findUnique({ where: { id: task.caseId }, select: { ownerId: true } });
    if (!caseRecord || caseRecord.ownerId === task.ownerId) return;

    const blockerHash = createHash('sha256').update(task.blocker ?? '').digest('hex').slice(0, 16);
    await this.notifications.notifyBothChannels(
      caseRecord.ownerId,
      'TASK_BLOCKED',
      { taskId: task.id, taskCode: task.taskCode, title: task.title, blocker: task.blocker },
      `task-blocked:${task.id}:${blockerHash}`,
    );
  }

  /// 06-operations/02_NOTIFICATION.md "Default reminder: 30/14/7/3/1 days." No
  /// scheduler/queue infra exists in this repo yet (Redis/BullMQ is `12-platform` scope —
  /// see docs/PHASE_MAP.md, docs/ASSUMPTIONS.md ASM-18) — this is the callable domain
  /// logic a future Phase-12 cron would invoke; `POST /tasks/reminders/run` exposes it
  /// manually in the meantime. Deduped per (task, offset) so re-running the sweep the same
  /// day never double-sends for the same milestone.
  async generateDeadlineReminders(): Promise<number> {
    const offsets = [30, 14, 7, 3, 1];
    const horizon = new Date(Date.now() + Math.max(...offsets) * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.task.findMany({
      where: { status: { notIn: TERMINAL_STATUSES }, deadline: { lte: horizon, gte: new Date() } },
    });

    let sent = 0;
    for (const task of candidates) {
      const daysRemaining = Math.ceil((task.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (!offsets.includes(daysRemaining)) continue;
      await this.notifications.notifyBothChannels(
        task.ownerId,
        'TASK_DEADLINE_REMINDER',
        { taskId: task.id, taskCode: task.taskCode, title: task.title, deadline: task.deadline, daysRemaining },
        `task-deadline:${task.id}:${daysRemaining}`,
      );
      sent += 1;
    }
    return sent;
  }

  /// "Overdue daily" — deduped by (task, calendar day), so re-running the sweep multiple
  /// times on the same day never double-sends, but a task still overdue tomorrow gets a
  /// fresh reminder (a new dedupeKey for that day).
  async generateOverdueReminders(): Promise<number> {
    const overdueTasks = await this.prisma.task.findMany({ where: { status: { notIn: TERMINAL_STATUSES }, deadline: { lt: new Date() } } });
    const today = new Date().toISOString().slice(0, 10);

    let sent = 0;
    for (const task of overdueTasks) {
      await this.notifications.notifyBothChannels(
        task.ownerId,
        'TASK_OVERDUE_REMINDER',
        { taskId: task.id, taskCode: task.taskCode, title: task.title, deadline: task.deadline },
        `task-overdue:${task.id}:${today}`,
      );
      sent += 1;
    }
    return sent;
  }
}
