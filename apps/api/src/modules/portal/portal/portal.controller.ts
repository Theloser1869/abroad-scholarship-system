import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { ApplicationQueryDto } from '../../admission/applications/dto/application-query.dto';
import { ContractQueryDto } from '../../commercial/contracts/dto/contract-query.dto';
import { PaymentQueryDto } from '../../commercial/payments/dto/payment-query.dto';
import { TaskQueryDto } from '../../case-management/tasks/dto/task-query.dto';
import { NotificationQueryDto } from '../../notifications/notifications/dto/notification-query.dto';
import { VisaQueryDto } from '../../visa/visas/dto/visa-query.dto';
import { PortalAccessService } from '../portal-access/portal-access.service';
import { PortalSubmitEvidenceDto } from './dto/portal-submit-evidence.dto';
import { PortalSubmitTaskOutputDto } from './dto/portal-submit-task-output.dto';
import { PortalUpdateTaskStatusDto } from './dto/portal-update-task-status.dto';
import { PortalService } from './portal.service';

/// 11-portal/01_STUDENT_PARENT_PORTAL.md section 19's own example route list, followed
/// verbatim in shape. Class-level `@RequirePermission('portal', 'access')` — a single new
/// permission, granted ONLY to STUDENT_PARENT (see `docs/security/RBAC_MATRIX.md`) — gates
/// the entire controller: without it, `AuthGuard` lets ANY authenticated role through a
/// route with no `@RequirePermission` at all, which would have let staff roles reach this
/// surface too (harmless in that the record-scope check below would still apply their own
/// legitimate Case-membership scope, but "Kiểm tra role: Student/Parent... ensure staff
/// roles không bị ảnh hưởng" calls for a clean, explicit deny instead of an accidental
/// allow). Beyond that one gate, the REAL authorization is the record-scope check inside
/// `PortalService`/`ScopePolicyService` (`assertStudentAccessible`, revocation-aware) —
/// which student(s) a STUDENT_PARENT caller may see is resolved per-request, never
/// client-supplied. See `docs/ASSUMPTIONS.md` ASM-49.
@Controller('portal')
@RequirePermission('portal', 'access')
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly access: PortalAccessService,
  ) {}

  @Get('me')
  async me(@CurrentUser() principal: Principal | null) {
    return this.access.myAccessibleStudents(requirePrincipal(principal));
  }

  @Get('students/:id')
  @Audit('VIEW')
  async profile(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.getProfile(requirePrincipal(principal), id);
  }

  @Get('students/:id/roadmap')
  async roadmap(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.getRoadmap(requirePrincipal(principal), id);
  }

  @Post('students/:id/roadmap/milestones/:milestoneId/evidence')
  @Audit('EDIT')
  async submitMilestoneEvidence(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: PortalSubmitEvidenceDto,
  ) {
    return this.portal.submitMilestoneEvidence(requirePrincipal(principal), id, milestoneId, dto);
  }

  @Get('students/:id/tasks')
  async tasks(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Query() query: TaskQueryDto) {
    return this.portal.listTasks(requirePrincipal(principal), id, query);
  }

  @Get('students/:id/tasks/:taskId')
  @Audit('VIEW')
  async task(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.portal.getTask(requirePrincipal(principal), id, taskId);
  }

  @Patch('students/:id/tasks/:taskId/output')
  @Audit('EDIT')
  async submitTaskOutput(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: PortalSubmitTaskOutputDto,
  ) {
    return this.portal.submitTaskOutput(requirePrincipal(principal), id, taskId, dto);
  }

  @Post('students/:id/tasks/:taskId/status')
  @Audit('EDIT')
  async updateTaskStatus(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: PortalUpdateTaskStatusDto,
  ) {
    return this.portal.updateTaskStatus(requirePrincipal(principal), id, taskId, dto);
  }

  @Get('students/:id/documents')
  async documents(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.listDocuments(requirePrincipal(principal), id);
  }

  @Get('students/:id/documents/:documentId/download')
  @Audit('DOWNLOAD')
  async downloadDocument(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
  ) {
    // `:id` here is the studentId (this controller's own convention throughout), so
    // `AuditInterceptor.extractObjectId`'s `req.params.id` check would otherwise record
    // the wrong id for a security-sensitive DOWNLOAD action — set the real one explicitly.
    req.auditMetadata = { documentId };
    return this.portal.downloadDocument(requirePrincipal(principal), id, documentId);
  }

  @Get('students/:id/applications')
  async applications(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Query() query: ApplicationQueryDto) {
    return this.portal.listApplications(requirePrincipal(principal), id, query);
  }

  @Get('students/:id/applications/:applicationId')
  @Audit('VIEW')
  async application(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.portal.getApplication(requirePrincipal(principal), id, applicationId);
  }

  @Post('students/:id/applications/checklist/:checklistItemId/evidence')
  @Audit('EDIT')
  async submitChecklistEvidence(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('checklistItemId', ParseUUIDPipe) checklistItemId: string,
    @Body() dto: PortalSubmitEvidenceDto,
  ) {
    return this.portal.submitChecklistEvidence(requirePrincipal(principal), id, checklistItemId, dto);
  }

  @Get('students/:id/scholarships')
  async scholarships(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.listScholarships(requirePrincipal(principal), id);
  }

  @Get('students/:id/scholarships/:scholarshipApplicationId')
  @Audit('VIEW')
  async scholarship(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('scholarshipApplicationId', ParseUUIDPipe) scholarshipApplicationId: string,
  ) {
    return this.portal.getScholarship(requirePrincipal(principal), id, scholarshipApplicationId);
  }

  @Get('students/:id/visa')
  async visas(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Query() query: VisaQueryDto) {
    return this.portal.listVisas(requirePrincipal(principal), id, query);
  }

  @Get('students/:id/visa/:visaId')
  @Audit('VIEW')
  async visa(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Param('visaId', ParseUUIDPipe) visaId: string) {
    return this.portal.getVisa(requirePrincipal(principal), id, visaId);
  }

  @Get('students/:id/pre-departure')
  async preDeparture(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.getPreDeparture(requirePrincipal(principal), id);
  }

  @Get('students/:id/enrollment')
  async enrollment(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.getEnrollments(requirePrincipal(principal), id);
  }

  @Get('students/:id/contracts')
  async contracts(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Query() query: ContractQueryDto) {
    return this.portal.listContracts(requirePrincipal(principal), id, query);
  }

  @Get('students/:id/contracts/:contractId/payments')
  async payments(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Query() query: PaymentQueryDto,
  ) {
    return this.portal.getContractPayments(requirePrincipal(principal), id, contractId, query);
  }

  @Get('students/:id/notifications')
  async notifications(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Query() query: NotificationQueryDto) {
    return this.portal.listNotifications(requirePrincipal(principal), id, query);
  }
}
