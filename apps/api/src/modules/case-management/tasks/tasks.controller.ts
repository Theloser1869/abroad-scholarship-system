import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AddTaskDependencyDto } from './dto/add-task-dependency.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

/// 06-operations/01_TASK.md reference implementation — flat `/tasks/:id` actions ("My
/// Tasks"/"Team Tasks"/"Overdue"/"Blocked"/"Calendar" are all `GET /tasks` query-filter
/// variants, not separate endpoints — see `TaskQueryDto`). Schedule creation is nested
/// under Case — see `CaseTasksController`. Every mutating route re-checks
/// scope/manageability inside `TasksService` before writing (`assertTaskAccessible` for
/// reads, the owner-or-case-owner-or-GLOBAL `requireManageable` for writes).
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('tasks', 'view')
  async list(@CurrentUser() principal: Principal | null, @Query() query: TaskQueryDto) {
    return this.tasks.list(requirePrincipal(principal), query);
  }

  @Get(':id')
  @RequirePermission('tasks', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('tasks', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(requirePrincipal(principal), id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('tasks', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.tasks.updateStatus(requirePrincipal(principal), id, dto);
  }

  @Patch(':id/assign')
  @RequirePermission('tasks', 'assign')
  @Audit('ASSIGN')
  async assign(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTaskDto) {
    return this.tasks.assign(requirePrincipal(principal), id, dto);
  }

  @Get(':id/dependencies')
  @RequirePermission('tasks', 'view')
  async listDependencies(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.listDependencies(requirePrincipal(principal), id);
  }

  @Post(':id/dependencies')
  @RequirePermission('tasks', 'edit')
  @Audit('EDIT')
  async addDependency(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddTaskDependencyDto) {
    await this.tasks.addDependency(requirePrincipal(principal), id, dto);
    return { added: true };
  }

  /// 06-operations/02_NOTIFICATION.md "Default reminder: 30/14/7/3/1 days, Overdue daily."
  /// No scheduler exists in this repo yet (Redis/BullMQ is `12-platform` scope — see
  /// docs/ASSUMPTIONS.md ASM-18) — a manually-triggerable entrypoint in the meantime, same
  /// narrow single-role-check pattern already used for `AuthController`'s
  /// `sessions:revoke-any` (not a RolePermission-driven grant — see
  /// docs/security/RBAC_MATRIX.md section 2's note on that exception).
  @Post('reminders/run')
  @Audit('EDIT')
  async runReminders(@CurrentUser() principal: Principal | null) {
    const actor = requirePrincipal(principal);
    if (actor.roleCode !== 'SYSTEM_ADMIN' && actor.roleCode !== 'EXECUTIVE_DIRECTOR') {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'Only SYSTEM_ADMIN or EXECUTIVE_DIRECTOR may trigger the reminder sweep.' });
    }
    const [deadlineReminders, overdueReminders] = await Promise.all([this.tasks.generateDeadlineReminders(), this.tasks.generateOverdueReminders()]);
    return { deadlineReminders, overdueReminders };
  }

  @Delete(':id/dependencies/:dependsOnTaskId')
  @RequirePermission('tasks', 'edit')
  @Audit('EDIT')
  async removeDependency(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dependsOnTaskId', ParseUUIDPipe) dependsOnTaskId: string,
  ) {
    await this.tasks.removeDependency(requirePrincipal(principal), id, dependsOnTaskId);
    return { removed: true };
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
