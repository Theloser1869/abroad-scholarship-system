import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { ApproveAssessmentDto } from './dto/approve-assessment.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { RejectAssessmentDto } from './dto/reject-assessment.dto';
import { UpsertCriterionDto } from './dto/upsert-criterion.dto';
import { AssessmentsService } from './assessments.service';

/// 07-profile/01_ASSESSMENT_ROADMAP.md — flat `/assessments/:id` actions. Listing/creation
/// is nested under Case (`CaseAssessmentsController`), same split as Contract/Payment.
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get(':id')
  @RequirePermission('assessments', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.getById(requirePrincipal(principal), id);
  }

  @Post(':id/submit')
  @RequirePermission('assessments', 'edit')
  @Audit('EDIT')
  async submit(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.submit(requirePrincipal(principal), id);
  }

  @Post(':id/approve')
  @RequirePermission('assessments', 'approve')
  @Audit('APPROVE')
  async approve(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveAssessmentDto) {
    return this.assessments.approve(requirePrincipal(principal), id, dto);
  }

  @Post(':id/reject')
  @RequirePermission('assessments', 'approve')
  @Audit('APPROVE')
  async reject(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectAssessmentDto) {
    return this.assessments.reject(requirePrincipal(principal), id, dto);
  }

  @Post(':id/criteria')
  @RequirePermission('assessments', 'edit')
  @Audit('EDIT')
  async upsertCriterion(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertCriterionDto) {
    return this.assessments.upsertCriterion(requirePrincipal(principal), id, dto);
  }
}

@Controller('cases/:caseId/assessments')
export class CaseAssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get()
  @RequirePermission('assessments', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.assessments.listForCase(requirePrincipal(principal), caseId);
  }

  @Post()
  @RequirePermission('assessments', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateAssessmentDto) {
    return this.assessments.create(requirePrincipal(principal), caseId, dto);
  }
}
