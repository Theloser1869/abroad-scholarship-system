import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateNoteDto } from '../../../common/dto/create-note.dto';
import { CommentsService } from '../../notifications/comments/comments.service';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { CreateWritingArtifactDto } from './dto/create-writing-artifact.dto';
import { CreateWritingVersionDto } from './dto/create-writing-version.dto';
import { ReviewWritingVersionDto } from './dto/review-writing-version.dto';
import { UpdateWritingStatusDto } from './dto/update-writing-status.dto';
import { WritingArtifactsService } from './writing-artifacts.service';

@Controller('cases/:caseId/writing-artifacts')
export class CaseWritingArtifactsController {
  constructor(private readonly artifacts: WritingArtifactsService) {}

  @Get()
  @RequirePermission('writing', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.artifacts.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('writing', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateWritingArtifactDto) {
    return this.artifacts.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('writing-artifacts')
export class WritingArtifactsController {
  constructor(private readonly artifacts: WritingArtifactsService) {}

  @Get(':id')
  @RequirePermission('writing', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.artifacts.getById(requirePrincipal(principal), id);
  }

  @Patch(':id/status')
  @RequirePermission('writing', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWritingStatusDto) {
    return this.artifacts.updateStatus(requirePrincipal(principal), id, dto.status);
  }

  @Post(':id/versions')
  @RequirePermission('writing', 'edit')
  @Audit('CREATE')
  async createVersion(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateWritingVersionDto) {
    return this.artifacts.createVersion(requirePrincipal(principal), id, dto);
  }
}

/// Flat `/writing-versions/:id` actions — review verdict + Comment-entity-backed feedback
/// (03_WRITING.md "Comments should attach to version/section"; reuses `Comment`, not a
/// duplicate `ReviewComment` entity).
@Controller('writing-versions')
export class WritingVersionsController {
  constructor(
    private readonly artifacts: WritingArtifactsService,
    private readonly comments: CommentsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Post(':id/review')
  @RequirePermission('writing', 'edit')
  @Audit('EDIT')
  async review(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewWritingVersionDto) {
    return this.artifacts.reviewVersion(requirePrincipal(principal), id, dto);
  }

  @Get(':id/comments')
  @RequirePermission('writing', 'view')
  async listComments(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    await this.artifacts.getVersionForComment(actor, id);
    const all = await this.comments.listForEntity('WritingVersion', id);
    return all.filter((c) => this.fieldPolicy.canViewComment(actor.roleCode, c));
  }

  @Post(':id/comments')
  @RequirePermission('writing', 'edit')
  @Audit('EDIT')
  async addComment(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto) {
    const actor = requirePrincipal(principal);
    await this.artifacts.getVersionForComment(actor, id);
    return this.comments.create('WritingVersion', id, actor.userId, dto.body, dto.visibility ?? 'internal');
  }
}
