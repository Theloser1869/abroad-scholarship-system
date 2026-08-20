import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { ApproveRoadmapDto } from './dto/approve-roadmap.dto';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { RejectRoadmapDto } from './dto/reject-roadmap.dto';
import { UpdateRoadmapStatusDto } from './dto/update-roadmap-status.dto';
import { RoadmapsService } from './roadmaps.service';

@Controller('roadmaps')
export class RoadmapsController {
  constructor(private readonly roadmaps: RoadmapsService) {}

  @Get(':id')
  @RequirePermission('roadmaps', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.roadmaps.getById(requirePrincipal(principal), id);
  }

  @Post(':id/submit')
  @RequirePermission('roadmaps', 'edit')
  @Audit('EDIT')
  async submit(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.roadmaps.submit(requirePrincipal(principal), id);
  }

  @Post(':id/approve')
  @RequirePermission('roadmaps', 'approve')
  @Audit('APPROVE')
  async approve(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveRoadmapDto) {
    return this.roadmaps.approve(requirePrincipal(principal), id, dto);
  }

  @Post(':id/reject')
  @RequirePermission('roadmaps', 'approve')
  @Audit('APPROVE')
  async reject(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectRoadmapDto) {
    return this.roadmaps.reject(requirePrincipal(principal), id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('roadmaps', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoadmapStatusDto) {
    return this.roadmaps.updateStatus(requirePrincipal(principal), id, dto.status);
  }
}

@Controller('cases/:caseId/roadmaps')
export class CaseRoadmapsController {
  constructor(private readonly roadmaps: RoadmapsService) {}

  @Get()
  @RequirePermission('roadmaps', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.roadmaps.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('roadmaps', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateRoadmapDto) {
    return this.roadmaps.create(requirePrincipal(principal), caseId, dto);
  }
}
