import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Principal } from '../../../common/context/principal';
import { PaginatedResult } from '../../../common/dto/list-query.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ApplicationChecklistService } from '../../admission/applications/application-checklist.service';
import { ApplicationQueryDto } from '../../admission/applications/dto/application-query.dto';
import { ApplicationsService } from '../../admission/applications/applications.service';
import { OffersService } from '../../admission/offers/offers.service';
import { ScholarshipApplicationsService } from '../../admission/scholarship-applications/scholarship-applications.service';
import { ClosureService } from '../../case-management/closure/closure.service';
import { ContractQueryDto } from '../../commercial/contracts/dto/contract-query.dto';
import { ContractsService } from '../../commercial/contracts/contracts.service';
import { PaymentQueryDto } from '../../commercial/payments/dto/payment-query.dto';
import { PaymentsService } from '../../commercial/payments/payments.service';
import { TaskQueryDto } from '../../case-management/tasks/dto/task-query.dto';
import { TasksService } from '../../case-management/tasks/tasks.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { NotificationQueryDto } from '../../notifications/notifications/dto/notification-query.dto';
import { NotificationsService } from '../../notifications/notifications/notifications.service';
import { MilestonesService } from '../../counseling/roadmaps/milestones.service';
import { RoadmapsService } from '../../counseling/roadmaps/roadmaps.service';
import { EnrollmentsService } from '../../visa/enrollments/enrollments.service';
import { PreDepartureService } from '../../visa/pre-departure/pre-departure.service';
import { VisaQueryDto } from '../../visa/visas/dto/visa-query.dto';
import { VisasService } from '../../visa/visas/visas.service';
import { PortalSubmitEvidenceDto } from './dto/portal-submit-evidence.dto';
import { PortalSubmitTaskOutputDto } from './dto/portal-submit-task-output.dto';
import { PortalUpdateTaskStatusDto } from './dto/portal-update-task-status.dto';

/// 11-portal/01_STUDENT_PARENT_PORTAL.md. "Portal chỉ là một lớp truy cập an toàn vào dữ
/// liệu hiện có" — every method here resolves `principal -> allowed Student -> Case`
/// (server-side, via the now-revocation-aware `ScopePolicyService`, never trusting the
/// client's `:studentId`) and then delegates straight into the EXISTING Phase 05-10 domain
/// services, which already do their own `assertCaseAccessible`/redaction — no business
/// logic is duplicated here, and no parallel entity (StudentPortalProfile/ParentApplication/
/// PortalTask/PortalDocument) exists.
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly fieldPolicy: FieldPolicyService,
    private readonly roadmaps: RoadmapsService,
    private readonly milestones: MilestonesService,
    private readonly tasks: TasksService,
    private readonly documents: DocumentsService,
    private readonly applications: ApplicationsService,
    private readonly checklist: ApplicationChecklistService,
    private readonly offers: OffersService,
    private readonly scholarshipApplications: ScholarshipApplicationsService,
    private readonly visas: VisasService,
    private readonly preDeparture: PreDepartureService,
    private readonly enrollments: EnrollmentsService,
    private readonly contracts: ContractsService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly closure: ClosureService,
  ) {}

  /// Resolves + verifies `studentId` (never trusted from the client without this) then
  /// finds that Student's most recent Case — every Case-scoped domain service below is
  /// then called with that resolved `caseId`, which itself re-verifies scope independently
  /// (defense in depth, not a single point of trust).
  private async resolveCase(principal: Principal, studentId: string): Promise<{ caseId: string }> {
    await this.scope.assertStudentAccessible(principal, studentId);
    const latestCase = await this.prisma.case.findFirst({ where: { studentId }, orderBy: { openedAt: 'desc' } });
    if (!latestCase) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'This student has no case yet.' });
    return { caseId: latestCase.id };
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  /// READ-ONLY — 11-portal section 4 explicitly forbids self-service edits of
  /// ownership/case/internal status/staff assignment/contract legal state/application
  /// internal state/visa internal result/commission/audit data; no field on `Student` maps
  /// to any of those (they live on Case/Contract/Application/Visa, each already denied its
  /// own way below), so no Portal "edit profile" action exists at all this phase — a
  /// student's own profile fields (name/contact/target country/major/intake) remain
  /// staff-maintained via the existing `PATCH /students/:id`, which STUDENT_PARENT has no
  /// grant on. See `docs/ASSUMPTIONS.md` ASM-48.
  async getProfile(principal: Principal, studentId: string) {
    await this.scope.assertStudentAccessible(principal, studentId);
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    return this.fieldPolicy.redactStudent(student, principal.roleCode);
  }

  // ---------------------------------------------------------------------------
  // Closure / Liquidation (Client Acceptance Remediation DEC-06/07/08)
  // ---------------------------------------------------------------------------

  /// Read-only — student/parent-safe summary only. `handover.notes` may carry internal
  /// staff commentary (per 11-portal's "no internal notes/audit data" rule, same as
  /// `internalNotes` on Visa/LOR/ScholarshipApplication), so it is stripped here; every
  /// other field is already safe (checklist keys/status, handover status/date, liquidation
  /// confirmation status/dates — no actor names/ids, no financial figures).
  async getClosure(principal: Principal, studentId: string) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const status = await this.closure.getStatusForCase(caseId);
    return { ...status, handover: { ...status.handover, notes: null } };
  }

  /// DEC-08 — student/parent side of the two-party liquidation confirmation.
  /// `resolveCase` above already re-verifies this principal is the Student themselves or an
  /// ACTIVE linked Parent (`assertStudentAccessible`, revocation-aware) before this is
  /// ever reached — the same defense-in-depth every other portal mutation relies on.
  async confirmLiquidation(principal: Principal, studentId: string) {
    const { caseId } = await this.resolveCase(principal, studentId);
    return this.closure.confirmLiquidationStudentParent(caseId, principal);
  }

  // ---------------------------------------------------------------------------
  // Roadmap
  // ---------------------------------------------------------------------------

  async getRoadmap(principal: Principal, studentId: string) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const roadmaps = await this.roadmaps.listForCase(principal, caseId);
    const current = [...roadmaps].sort((a, b) => b.version - a.version)[0] ?? null;
    if (!current) return null;
    const milestoneRows = await this.milestones.listForRoadmap(principal, current.id);
    // "Nếu progress được tính từ Task/Milestone hiện tại: sử dụng source-of-truth hiện
    // tại" — a plain derived percentage over live milestone status, computed identically
    // every call, never a stored/duplicated score.
    const total = milestoneRows.length;
    const completed = milestoneRows.filter((m) => m.status === 'DONE').length;
    return { ...current, milestones: milestoneRows, progress: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  /// "Không cho Student tự đánh dấu milestone Completed... chỉ được acknowledge/submit
  /// evidence."
  async submitMilestoneEvidence(principal: Principal, studentId: string, milestoneId: string, dto: PortalSubmitEvidenceDto) {
    const { caseId } = await this.resolveCase(principal, studentId);
    await this.assertDocumentUploadedBySelf(principal, dto.documentId);
    return this.milestones.submitEvidence(caseId, milestoneId, dto.documentId);
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  async listTasks(principal: Principal, studentId: string, query: TaskQueryDto) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const result = await this.tasks.listForStudentPortal(caseId, query);
    return { ...result, data: result.data.map((t) => this.fieldPolicy.redactTaskForPortal(t)) };
  }

  async getTask(principal: Principal, studentId: string, taskId: string) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const task = await this.tasks.getForStudentPortal(caseId, taskId);
    return this.fieldPolicy.redactTaskForPortal(task);
  }

  async submitTaskOutput(principal: Principal, studentId: string, taskId: string, dto: PortalSubmitTaskOutputDto) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const task = await this.tasks.getForStudentPortal(caseId, taskId);
    const updated = await this.tasks.portalSubmitOutput(task, dto.output);
    return this.fieldPolicy.redactTaskForPortal(updated);
  }

  /// "Task status transition vẫn server-enforced" — reuses the exact staff FSM
  /// (`TasksService.portalUpdateStatus` = the same `applyStatusTransition` `updateStatus`
  /// itself calls), only reachable here for a task explicitly `visibleToStudent`.
  async updateTaskStatus(principal: Principal, studentId: string, taskId: string, dto: PortalUpdateTaskStatusDto) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const task = await this.tasks.getForStudentPortal(caseId, taskId);
    const updated = await this.tasks.portalUpdateStatus(task, { status: dto.status });
    return this.fieldPolicy.redactTaskForPortal(updated);
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  /// "Không cho Portal enumerate arbitrary document IDs" — lists exactly the caller's own
  /// `DocumentAccess` grants (see `DocumentsService.listAccessibleTo`), never a scan by
  /// owner entity. `studentId` is still verified first so an out-of-scope/revoked caller
  /// 404s before ever reaching the grant query, matching every other Portal method.
  async listDocuments(principal: Principal, studentId: string) {
    await this.scope.assertStudentAccessible(principal, studentId);
    return this.documents.listAccessibleTo(principal);
  }

  async downloadDocument(principal: Principal, studentId: string, documentId: string) {
    await this.scope.assertStudentAccessible(principal, studentId);
    return this.documents.requestDownload(principal, documentId);
  }

  private async assertDocumentUploadedBySelf(principal: Principal, documentId: string): Promise<void> {
    // The generic `getById` already enforces the grant-based access check (the uploader is
    // always auto-granted); this only additionally confirms the caller is actually who
    // uploaded it, so a student can't attach someone else's already-shared Document to
    // their own milestone/checklist item as if it were their own submission.
    const document = await this.documents.getById(principal, documentId);
    if (document.uploadedById !== principal.userId) {
      throw new ConflictException({ code: 'DOCUMENT_NOT_OWNED', message: 'You may only submit a document you uploaded yourself.' });
    }
  }

  // ---------------------------------------------------------------------------
  // Applications / Offers
  // ---------------------------------------------------------------------------

  async listApplications(principal: Principal, studentId: string, query: ApplicationQueryDto) {
    const { caseId } = await this.resolveCase(principal, studentId);
    return this.applications.listForCase(principal, caseId, query);
  }

  /// Detail views deliberately do NOT additionally require the record's case to be the
  /// student's single MOST RECENT case (unlike the list/action methods below, which need
  /// to resolve exactly one case to query/mutate against) — `applications.getById` already
  /// independently enforces `assertCaseAccessible` against whichever case the application
  /// actually belongs to, correctly covering a student with more than one Case over time
  /// (e.g. re-engaging after a gap). Restricting a detail view to "must be the latest case"
  /// as well would incorrectly 404 a still-legitimate older record.
  async getApplication(principal: Principal, studentId: string, applicationId: string) {
    await this.scope.assertStudentAccessible(principal, studentId);
    const application = await this.applications.getById(principal, applicationId);
    // Both the URL's studentId and the applicationId are independently verified above/via
    // `getById`, but a multi-child parent could otherwise pass one child's studentId in the
    // URL while an applicationId belonging to a DIFFERENT (also legitimately linked) child —
    // never a cross-family leak, but "chọn đúng Student context" means the URL's studentId
    // must actually govern which student's data comes back, not be a decorative no-op.
    if (application.studentId !== studentId) {
      throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: `Application ${applicationId} not found.` });
    }
    const [checklistItems, currentOffer] = await Promise.all([
      this.checklist.listForApplication(principal, applicationId),
      this.offers.getCurrent(principal, applicationId),
    ]);
    return { ...application, checklist: checklistItems, currentOffer };
  }

  /// "Không cho Student tự chuyển Application sang Submitted/Offer/Reject" — Portal never
  /// exposes `submit()`/`transitionToOffer` at all, only this narrow evidence action. Scoped
  /// to the student's latest case (same reasoning as the roadmap/task evidence actions
  /// above — a mutation always targets the current, active engagement).
  async submitChecklistEvidence(principal: Principal, studentId: string, checklistItemId: string, dto: PortalSubmitEvidenceDto) {
    const { caseId } = await this.resolveCase(principal, studentId);
    await this.assertDocumentUploadedBySelf(principal, dto.documentId);
    return this.checklist.submitEvidence(caseId, checklistItemId, dto.documentId);
  }

  // ---------------------------------------------------------------------------
  // Scholarships
  // ---------------------------------------------------------------------------

  async listScholarships(principal: Principal, studentId: string) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const rows = await this.scholarshipApplications.listForCase(principal, caseId);
    return rows.map((r) => this.fieldPolicy.redactScholarshipApplication(r, principal.roleCode));
  }

  async getScholarship(principal: Principal, studentId: string, id: string) {
    await this.scope.assertStudentAccessible(principal, studentId);
    const row = await this.scholarshipApplications.getById(principal, id);
    if (row.studentId !== studentId) {
      throw new NotFoundException({ code: 'SCHOLARSHIP_APPLICATION_NOT_FOUND', message: `Scholarship application ${id} not found.` });
    }
    return this.fieldPolicy.redactScholarshipApplication(row, principal.roleCode);
  }

  // ---------------------------------------------------------------------------
  // Visa
  // ---------------------------------------------------------------------------

  async listVisas(principal: Principal, studentId: string, query: VisaQueryDto): Promise<PaginatedResult<unknown>> {
    const { caseId } = await this.resolveCase(principal, studentId);
    const result = await this.visas.listForCase(principal, caseId, query);
    return { ...result, data: result.data.map((v) => this.fieldPolicy.redactVisa(v, principal.roleCode)) };
  }

  async getVisa(principal: Principal, studentId: string, visaId: string) {
    await this.scope.assertStudentAccessible(principal, studentId);
    const visa = await this.visas.getById(principal, visaId);
    if (visa.studentId !== studentId) {
      throw new NotFoundException({ code: 'VISA_NOT_FOUND', message: `Visa ${visaId} not found.` });
    }
    return this.fieldPolicy.redactVisa(visa, principal.roleCode);
  }

  // ---------------------------------------------------------------------------
  // Pre-departure / Enrollment
  // ---------------------------------------------------------------------------

  async getPreDeparture(principal: Principal, studentId: string) {
    const { caseId } = await this.resolveCase(principal, studentId);
    return this.preDeparture.listForCase(principal, caseId);
  }

  async getEnrollments(principal: Principal, studentId: string) {
    const { caseId } = await this.resolveCase(principal, studentId);
    const rows = await this.enrollments.listForCase(principal, caseId);
    return rows.map((r) => this.fieldPolicy.redactEnrollment(r, principal.roleCode));
  }

  // ---------------------------------------------------------------------------
  // Contract / Payment
  // ---------------------------------------------------------------------------

  /// Fields exposed are whatever `ContractsService`/`PaymentsService` already return for an
  /// OWN_STUDENT-scoped caller — commission/internal-approval fields don't exist on
  /// `Contract`/`Payment` at all (they live entirely on the separate, Phase-10-isolated
  /// `CommissionTransaction`, which Portal never touches — "Không trộn... partner
  /// commission"). Outstanding balance is `PaymentsService.outstandingAmount`, the same
  /// source of truth every other caller uses — never recomputed here.
  async listContracts(principal: Principal, studentId: string, query: ContractQueryDto) {
    await this.scope.assertStudentAccessible(principal, studentId);
    return this.contracts.list(principal, { ...query, studentId });
  }

  async getContractPayments(principal: Principal, studentId: string, contractId: string, query: PaymentQueryDto) {
    await this.scope.assertStudentAccessible(principal, studentId);
    const contract = await this.contracts.getById(principal, contractId);
    if (contract.studentId !== studentId) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${contractId} not found.` });
    }
    return this.payments.listForContract(principal, contractId, query);
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  /// Notifications are recipient-scoped, not student-scoped (`Notification.recipientId`,
  /// not `studentId` — see `docs/security/RBAC_MATRIX.md` section 2's note that this is
  /// already fully self-service with zero permission gate). `:studentId` is still verified
  /// first, purely for URL-path consistency with every other Portal route and to 404 an
  /// out-of-scope/revoked caller the same way — the underlying inbox is always the CALLING
  /// principal's own, regardless of which student context the URL names.
  async listNotifications(principal: Principal, studentId: string, query: NotificationQueryDto) {
    await this.scope.assertStudentAccessible(principal, studentId);
    return this.notifications.listInbox(principal, query);
  }
}
