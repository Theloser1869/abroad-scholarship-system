import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { CreateResearchProjectDto } from './dto/create-research-project.dto';
import { CreateSchoolMasterDto } from './dto/create-school-master.dto';
import { CreateTestRecordDto } from './dto/create-test-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { UpdateResearchProjectDto } from './dto/update-research-project.dto';
import { UpdateSchoolMasterDto } from './dto/update-school-master.dto';
import { UpdateTestRecordDto } from './dto/update-test-record.dto';
import { AcademicRecordsService } from './academic-records.service';
import { ActivitiesService } from './activities.service';
import { CompetitionsService } from './competitions.service';
import { ResearchProjectsService } from './research-projects.service';
import { SchoolMastersService } from './school-masters.service';
import { TestRecordsService } from './test-records.service';

/// 07-profile/02_PROFILE_EVIDENCE.md — five structurally similar Case-scoped domains,
/// kept in one file given how small each controller is (mirrors the two-controllers-per-
/// file precedent already used for `assessments.controller.ts`). All five share the
/// `profile_evidence` permission resource (view/create/edit) — see docs/security/
/// RBAC_MATRIX.md for why they're grouped rather than five separate resources.

@Controller('cases/:caseId/academic-records')
export class CaseAcademicRecordsController {
  constructor(private readonly service: AcademicRecordsService) {}

  @Get()
  @RequirePermission('profile_evidence', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.service.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('profile_evidence', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateAcademicRecordDto) {
    return this.service.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('academic-records')
export class AcademicRecordsController {
  constructor(private readonly service: AcademicRecordsService) {}

  @Get(':id')
  @RequirePermission('profile_evidence', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicRecordDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }

  @Post(':id/verify')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async verify(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(requirePrincipal(principal), id);
  }
}

/// DEC-05(b) (2026-08-27) — a curated school list `AcademicRecord.school` can optionally
/// link against; its own `school_master` permission resource (view/create/edit), separate
/// from `profile_evidence`, since this is master-data curation, not case-scoped work.
@Controller('school-masters')
export class SchoolMastersController {
  constructor(private readonly service: SchoolMastersService) {}

  @Get()
  @RequirePermission('school_master', 'view')
  async list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Post()
  @RequirePermission('school_master', 'create')
  @Audit('CREATE')
  async create(@Body() dto: CreateSchoolMasterDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('school_master', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSchoolMasterDto) {
    return this.service.update(id, dto);
  }
}

@Controller('cases/:caseId/test-records')
export class CaseTestRecordsController {
  constructor(private readonly service: TestRecordsService) {}

  @Get()
  @RequirePermission('profile_evidence', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.service.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('profile_evidence', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateTestRecordDto) {
    return this.service.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('test-records')
export class TestRecordsController {
  constructor(private readonly service: TestRecordsService) {}

  @Get(':id')
  @RequirePermission('profile_evidence', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTestRecordDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }

  @Post(':id/verify')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async verify(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(requirePrincipal(principal), id);
  }
}

@Controller('cases/:caseId/competitions')
export class CaseCompetitionsController {
  constructor(private readonly service: CompetitionsService) {}

  @Get()
  @RequirePermission('profile_evidence', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.service.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('profile_evidence', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateCompetitionDto) {
    return this.service.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly service: CompetitionsService) {}

  @Get(':id')
  @RequirePermission('profile_evidence', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompetitionDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }
}

@Controller('cases/:caseId/research-projects')
export class CaseResearchProjectsController {
  constructor(private readonly service: ResearchProjectsService) {}

  @Get()
  @RequirePermission('profile_evidence', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.service.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('profile_evidence', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateResearchProjectDto) {
    return this.service.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('research-projects')
export class ResearchProjectsController {
  constructor(private readonly service: ResearchProjectsService) {}

  @Get(':id')
  @RequirePermission('profile_evidence', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResearchProjectDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }
}

@Controller('cases/:caseId/activities')
export class CaseActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @RequirePermission('profile_evidence', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.service.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('profile_evidence', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateActivityDto) {
    return this.service.create(requirePrincipal(principal), caseId, dto);
  }
}

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get(':id')
  @RequirePermission('profile_evidence', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateActivityDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }

  @Post(':id/verify')
  @RequirePermission('profile_evidence', 'edit')
  @Audit('EDIT')
  async verify(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(requirePrincipal(principal), id);
  }
}
