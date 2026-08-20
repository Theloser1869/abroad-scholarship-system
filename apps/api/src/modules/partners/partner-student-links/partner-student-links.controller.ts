import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { CreatePartnerStudentLinkDto } from './dto/create-partner-student-link.dto';
import { PartnerStudentLinkQueryDto } from './dto/partner-student-link-query.dto';
import { UpdatePartnerStudentLinkDto } from './dto/update-partner-student-link.dto';
import { PartnerStudentLinksService } from './partner-student-links.service';

@Controller('partners/:partnerId/student-links')
export class PartnerStudentLinksNestedController {
  constructor(private readonly service: PartnerStudentLinksService) {}

  @Get()
  @RequirePermission('partner_student_links', 'view')
  async list(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Query() query: PartnerStudentLinkQueryDto) {
    return this.service.listForPartner(partnerId, query);
  }

  @Post()
  @RequirePermission('partner_student_links', 'create')
  @Audit('CREATE')
  async create(
    @CurrentUser() principal: Principal | null,
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
    @Body() dto: CreatePartnerStudentLinkDto,
  ) {
    const actor = requirePrincipal(principal);
    return this.service.create(partnerId, actor, dto);
  }
}

@Controller('students/:studentId/partner-links')
export class StudentPartnerLinksController {
  constructor(private readonly service: PartnerStudentLinksService) {}

  @Get()
  @RequirePermission('partner_student_links', 'view')
  async list(@Param('studentId', ParseUUIDPipe) studentId: string, @Query() query: PartnerStudentLinkQueryDto) {
    return this.service.listForStudent(studentId, query);
  }
}

@Controller('partner-student-links')
export class PartnerStudentLinksController {
  constructor(private readonly service: PartnerStudentLinksService) {}

  @Get(':id')
  @RequirePermission('partner_student_links', 'view')
  @Audit('VIEW')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  @RequirePermission('partner_student_links', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerStudentLinkDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/archive')
  @RequirePermission('partner_student_links', 'edit')
  @Audit('ARCHIVE')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }
}
