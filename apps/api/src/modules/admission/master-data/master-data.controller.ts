import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateScholarshipMasterDto } from './dto/create-scholarship-master.dto';
import { CreateUniversityDto } from './dto/create-university.dto';
import { ProgramQueryDto } from './dto/program-query.dto';
import { ScholarshipMasterQueryDto } from './dto/scholarship-master-query.dto';
import { UniversityQueryDto } from './dto/university-query.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { UpdateScholarshipMasterDto } from './dto/update-scholarship-master.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';
import { ProgramsService } from './programs.service';
import { ScholarshipMastersService } from './scholarship-masters.service';
import { UniversitiesService } from './universities.service';

/// 08-admission/01_MASTER_DATA.md — three structurally similar GLOBAL master-data
/// catalogs, kept in one file (mirrors the multi-controller-per-file precedent already
/// used for `profile-evidence.controller.ts`). All three share the `admission_master`
/// permission resource (view/create/edit/verify) — see docs/security/RBAC_MATRIX.md for
/// why they're grouped, and why `create`/`edit`/`verify` are narrower than `view`
/// (CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/STUDENT_PARENT browse the catalog but
/// cannot curate it — "Consultant có thể sử dụng Program nhưng không nhất thiết được chỉnh
/// tuition").
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly service: UniversitiesService) {}

  @Get()
  @RequirePermission('admission_master', 'view')
  async list(@Query() query: UniversityQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermission('admission_master', 'view')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermission('admission_master', 'create')
  @Audit('CREATE')
  async create(@Body() dto: CreateUniversityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('admission_master', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUniversityDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/verify')
  @RequirePermission('admission_master', 'verify')
  @Audit('EDIT')
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(id);
  }
}

@Controller('programs')
export class ProgramsController {
  constructor(private readonly service: ProgramsService) {}

  @Get()
  @RequirePermission('admission_master', 'view')
  async list(@Query() query: ProgramQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermission('admission_master', 'view')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermission('admission_master', 'create')
  @Audit('CREATE')
  async create(@Body() dto: CreateProgramDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('admission_master', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgramDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/verify')
  @RequirePermission('admission_master', 'verify')
  @Audit('EDIT')
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(id);
  }
}

@Controller('scholarship-masters')
export class ScholarshipMastersController {
  constructor(private readonly service: ScholarshipMastersService) {}

  @Get()
  @RequirePermission('admission_master', 'view')
  async list(@Query() query: ScholarshipMasterQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermission('admission_master', 'view')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermission('admission_master', 'create')
  @Audit('CREATE')
  async create(@Body() dto: CreateScholarshipMasterDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('admission_master', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScholarshipMasterDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/verify')
  @RequirePermission('admission_master', 'verify')
  @Audit('EDIT')
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(id);
  }
}
