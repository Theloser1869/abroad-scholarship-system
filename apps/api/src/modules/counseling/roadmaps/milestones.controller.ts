import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateTaskDto } from '../../case-management/tasks/dto/create-task.dto';
import { AddMilestoneDependencyDto } from './dto/add-milestone-dependency.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { UpdateMilestoneStatusDto } from './dto/update-milestone-status.dto';
import { MilestonesService } from './milestones.service';

@Controller('roadmaps/:roadmapId/milestones')
export class RoadmapMilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get()
  @RequirePermission('roadmaps', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('roadmapId', ParseUUIDPipe) roadmapId: string) {
    return this.milestones.listForRoadmap(requirePrincipal(principal), roadmapId);
  }

  @Post()
  @RequirePermission('roadmaps', 'edit')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('roadmapId', ParseUUIDPipe) roadmapId: string, @Body() dto: CreateMilestoneDto) {
    return this.milestones.create(requirePrincipal(principal), roadmapId, dto);
  }
}

/// Flat `/milestones/:id` actions — same split as Roadmap/Contract/Task.
@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get(':id')
  @RequirePermission('roadmaps', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.milestones.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('roadmaps', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMilestoneDto) {
    return this.milestones.update(requirePrincipal(principal), id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('roadmaps', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMilestoneStatusDto) {
    return this.milestones.updateStatus(requirePrincipal(principal), id, dto);
  }

  @Post(':id/dependencies')
  @RequirePermission('roadmaps', 'edit')
  @Audit('EDIT')
  async addDependency(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMilestoneDependencyDto) {
    await this.milestones.addDependency(requirePrincipal(principal), id, dto);
    return { added: true };
  }

  @Delete(':id/dependencies/:dependsOnMilestoneId')
  @RequirePermission('roadmaps', 'edit')
  @Audit('EDIT')
  async removeDependency(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dependsOnMilestoneId', ParseUUIDPipe) dependsOnMilestoneId: string,
  ) {
    await this.milestones.removeDependency(requirePrincipal(principal), id, dependsOnMilestoneId);
    return { removed: true };
  }

  @Get(':id/tasks')
  @RequirePermission('roadmaps', 'view')
  async listTasks(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.milestones.listTasks(requirePrincipal(principal), id);
  }

  /// Gated by `roadmaps:edit` only (the decorator supports one permission per route) —
  /// every role holding `roadmaps:edit` in this system's grant table also independently
  /// holds `tasks:create` (both are CONSULTANT's SRS domain), so this is not a de facto
  /// bypass of Task's own authorization today; a future role that decouples the two would
  /// need this route reconsidered.
  @Post(':id/tasks')
  @RequirePermission('roadmaps', 'edit')
  @Audit('CREATE')
  async createTask(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTaskDto) {
    return this.milestones.createTask(requirePrincipal(principal), id, dto);
  }
}
