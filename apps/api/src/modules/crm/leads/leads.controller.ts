import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateNoteDto } from '../../../common/dto/create-note.dto';
import { Idempotent } from '../../../common/idempotency/idempotency.interceptor';
import { CommentsService } from '../../notifications/comments/comments.service';
import { TimelineService } from '../../reporting/timeline/timeline.service';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { LeadsService } from './leads.service';

/// 04-core-crm/01_LEAD.md reference implementation. Follows the same conventions as
/// `students`/`cases` (docs/api/API_CONVENTIONS.md, docs/security/RBAC_MATRIX.md) — scope
/// via ScopePolicyService.leadScopeKindFor (OWN_LEAD for SALES_MARKETING), permission via
/// `@RequirePermission`, sensitive mutations audited.
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly comments: CommentsService,
    private readonly timeline: TimelineService,
  ) {}

  @Get()
  @RequirePermission('leads', 'view')
  async list(@CurrentUser() principal: Principal | null, @Query() query: LeadQueryDto) {
    return this.leads.list(requirePrincipal(principal), query);
  }

  @Get(':id')
  @RequirePermission('leads', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.getById(requirePrincipal(principal), id);
  }

  @Post()
  @RequirePermission('leads', 'create')
  @Audit('CREATE')
  @Idempotent()
  async create(@CurrentUser() principal: Principal | null, @Body() dto: CreateLeadDto) {
    const actor = requirePrincipal(principal);
    return this.leads.create(dto, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('leads', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(requirePrincipal(principal), id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('leads', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.leads.updateStatus(requirePrincipal(principal), id, dto.status);
  }

  @Patch(':id/assign')
  @RequirePermission('leads', 'assign')
  @Audit('EDIT')
  async assign(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignLeadDto) {
    return this.leads.assignOwner(requirePrincipal(principal), id, dto);
  }

  @Post(':id/convert')
  @RequirePermission('leads', 'convert')
  @Audit('CREATE')
  @Idempotent()
  async convert(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertLeadDto) {
    return this.leads.convert(requirePrincipal(principal), id, dto);
  }

  @Post(':id/notes')
  @RequirePermission('leads', 'edit')
  @Audit('EDIT')
  async addNote(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto) {
    const actor = requirePrincipal(principal);
    await this.leads.getById(actor, id); // scope check before writing
    return this.comments.create('Lead', id, actor.userId, dto.body, dto.visibility ?? 'internal');
  }

  @Get(':id/timeline')
  @RequirePermission('leads', 'view')
  async getTimeline(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    await this.leads.getById(actor, id); // scope check before reading
    // Leads have no STUDENT_PARENT-visible surface — every internal note is visible to
    // every internal role that can already see the lead at all.
    return this.timeline.forEntity('Leads', 'Lead', id, ['internal', 'shared']);
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
