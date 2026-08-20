import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { ApplicationChecklistService } from './application-checklist.service';
import { ApplicationsService } from './applications.service';
import { ApplicationQueryDto } from './dto/application-query.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Controller('cases/:caseId/applications')
export class CaseApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Get()
  @RequirePermission('applications', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Query() query: ApplicationQueryDto) {
    return this.service.listForCase(requirePrincipal(principal), caseId, query);
  }

  @Post()
  @RequirePermission('applications', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateApplicationDto) {
    return this.service.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Get(':id')
  @RequirePermission('applications', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('applications', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }

  @Post(':id/submit')
  @RequirePermission('applications', 'edit')
  @Audit('EDIT')
  async submit(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitApplicationDto) {
    return this.service.submit(requirePrincipal(principal), id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('applications', 'edit')
  @Audit('EDIT')
  async updateStatus(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationStatusDto) {
    return this.service.updateStatus(requirePrincipal(principal), id, dto);
  }
}

@Controller('applications/:applicationId/checklist')
export class ApplicationChecklistItemsController {
  constructor(private readonly service: ApplicationChecklistService) {}

  @Get()
  @RequirePermission('applications', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.service.listForApplication(requirePrincipal(principal), applicationId);
  }

  @Post()
  @RequirePermission('applications', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('applicationId', ParseUUIDPipe) applicationId: string, @Body() dto: CreateChecklistItemDto) {
    return this.service.create(requirePrincipal(principal), applicationId, dto);
  }
}

@Controller('checklist-items')
export class ChecklistItemsController {
  constructor(private readonly service: ApplicationChecklistService) {}

  @Patch(':id')
  @RequirePermission('applications', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChecklistItemDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }
}
