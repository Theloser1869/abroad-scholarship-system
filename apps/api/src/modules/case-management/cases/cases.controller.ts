import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateNoteDto } from '../../../common/dto/create-note.dto';
import { CommentsService } from '../../notifications/comments/comments.service';
import { TimelineService } from '../../reporting/timeline/timeline.service';
import { AddCaseMemberDto } from './dto/add-case-member.dto';
import { CaseQueryDto } from './dto/case-query.dto';
import { ReassignCaseOwnerDto } from './dto/reassign-case-owner.dto';
import { UpdateCaseStageDto } from './dto/update-case-stage.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';
import { CasesService } from './cases.service';

@Controller('cases')
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly comments: CommentsService,
    private readonly timeline: TimelineService,
  ) {}

  @Get()
  @RequirePermission('cases', 'view')
  async list(@CurrentUser() principal: Principal | null, @Query() query: CaseQueryDto) {
    return this.cases.list(requirePrincipal(principal), query);
  }

  @Get(':id')
  @RequirePermission('cases', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.cases.getById(requirePrincipal(principal), id);
  }

  @Patch(':id/stage')
  @RequirePermission('cases', 'edit')
  @Audit('EDIT')
  async updateStage(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCaseStageDto) {
    return this.cases.updateStage(requirePrincipal(principal), id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('cases', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCaseStatusDto) {
    return this.cases.updateStatus(requirePrincipal(principal), id, dto.status);
  }

  @Get(':id/members')
  @RequirePermission('cases', 'view')
  async listMembers(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.cases.listMembers(requirePrincipal(principal), id);
  }

  @Post(':id/members')
  @RequirePermission('cases', 'assign')
  @Audit('ASSIGN')
  async addMember(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddCaseMemberDto) {
    return this.cases.addMember(requirePrincipal(principal), id, dto);
  }

  @Delete(':id/members/:userId')
  @RequirePermission('cases', 'assign')
  @Audit('ASSIGN')
  async removeMember(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.cases.removeMember(requirePrincipal(principal), id, userId);
    return { removed: true };
  }

  @Post(':id/reassign-owner')
  @RequirePermission('cases', 'assign')
  @Audit('ASSIGN')
  async reassignOwner(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReassignCaseOwnerDto) {
    return this.cases.reassignOwner(requirePrincipal(principal), id, dto.userId);
  }

  @Post(':id/notes')
  @RequirePermission('cases', 'edit')
  @Audit('EDIT')
  async addNote(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto) {
    const actor = requirePrincipal(principal);
    await this.cases.getById(actor, id); // scope check before writing
    return this.comments.create('Case', id, actor.userId, dto.body, dto.visibility ?? 'internal');
  }

  @Get(':id/timeline')
  @RequirePermission('cases', 'view')
  async getTimeline(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    await this.cases.getById(actor, id); // scope check before reading
    const visibleVisibilities = actor.roleCode === 'STUDENT_PARENT' ? (['shared'] as const) : (['internal', 'shared'] as const);
    return this.timeline.forEntity('Cases', 'Case', id, [...visibleVisibilities]);
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
