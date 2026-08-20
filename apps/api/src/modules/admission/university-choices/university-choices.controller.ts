import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { CreateUniversityChoiceDto } from './dto/create-university-choice.dto';
import { ReviewUniversityChoiceDto } from './dto/review-university-choice.dto';
import { UpdateUniversityChoiceDto } from './dto/update-university-choice.dto';
import { UniversityChoicesService } from './university-choices.service';

@Controller('students/:studentId/university-choices')
export class StudentUniversityChoicesController {
  constructor(private readonly service: UniversityChoicesService) {}

  @Get()
  @RequirePermission('university_choices', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.listForStudent(requirePrincipal(principal), studentId);
  }

  @Post()
  @RequirePermission('university_choices', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: CreateUniversityChoiceDto) {
    return this.service.create(requirePrincipal(principal), studentId, dto);
  }
}

@Controller('university-choices')
export class UniversityChoicesController {
  constructor(private readonly service: UniversityChoicesService) {}

  @Get(':id')
  @RequirePermission('university_choices', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('university_choices', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUniversityChoiceDto) {
    return this.service.update(requirePrincipal(principal), id, dto);
  }

  @Post(':id/review')
  @RequirePermission('university_choices', 'edit')
  @Audit('EDIT')
  async review(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewUniversityChoiceDto) {
    return this.service.review(requirePrincipal(principal), id, dto);
  }
}
