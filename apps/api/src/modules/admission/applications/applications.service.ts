import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Application, ApplicationStatus, Prisma } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TaskGenerationService } from '../../case-management/tasks/task-generation.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { NotificationsService } from '../../notifications/notifications/notifications.service';
import { ApplicationQueryDto } from './dto/application-query.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

const SORTABLE_FIELDS = ['createdAt', 'deadline', 'status'] as const;
const TERMINAL_STATUSES: ApplicationStatus[] = ['REJECT', 'WITHDRAWN'];

/// 08-admission/02_APPLICATION.md. Workflow: Planning→Preparing→Ready for Review→
/// Submitted→{Offer,Waitlist,Reject}→Withdrawn (any open state), server-side FSM, never a
/// bare client-supplied status. SUBMITTED is reachable only via `submit()` (checklist
/// precondition); OFFER is reachable only via `OffersService.create` calling
/// `transitionToOffer` — "Không được chuyển Offer nếu chưa có offer record tương ứng."
const GENERIC_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PLANNING: ['PREPARING', 'WITHDRAWN'],
  PREPARING: ['READY_FOR_REVIEW', 'PLANNING', 'WITHDRAWN'],
  READY_FOR_REVIEW: ['PREPARING', 'WITHDRAWN'],
  SUBMITTED: ['WAITLIST', 'REJECT', 'WITHDRAWN'],
  WAITLIST: ['REJECT', 'WITHDRAWN'],
  OFFER: ['WITHDRAWN'],
  REJECT: [],
  WITHDRAWN: [],
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
    private readonly taskGeneration: TaskGenerationService,
    private readonly notifications: NotificationsService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async listForCase(principal: Principal, caseId: string, query: ApplicationQueryDto): Promise<PaginatedResult<Application>> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.ApplicationWhereInput = { caseId, ...(query.status ? { status: query.status } : {}) };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.application.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.application.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(principal: Principal, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { checklist: true, offers: true, scholarshipApplications: true },
    });
    if (!application) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: `Application ${id} not found.` });
    await this.scope.assertCaseAccessible(principal, application.caseId);
    return application;
  }

  /// "Prevent duplicate active applications for the same student/program unless business
  /// rule explicitly allows it" — checked at the service layer, not a DB unique
  /// constraint, so a genuine reapplication (after REJECT/WITHDRAWN) is a new row, never
  /// silently blocked forever. See docs/DECISIONS.md DEC-05.
  async create(principal: Principal, caseId: string, dto: CreateApplicationDto): Promise<Application> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const caseRecord = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${caseId} not found.` });

    const program = await this.prisma.program.findUnique({ where: { id: dto.programId } });
    if (!program) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: `Program ${dto.programId} not found.` });

    await this.assertNoActiveDuplicate(caseRecord.studentId, dto.programId, dto.intendedIntake);

    const applicationCode = await this.idGenerator.nextYearlyCode('APP');
    return this.prisma.application.create({
      data: {
        applicationCode,
        studentId: caseRecord.studentId,
        caseId,
        programId: dto.programId,
        intendedIntake: dto.intendedIntake,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateApplicationDto): Promise<Application> {
    const application = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    if (application.status === 'WITHDRAWN') {
      throw new ConflictException({ code: 'APPLICATION_WITHDRAWN', message: 'A withdrawn application cannot be edited.' });
    }
    return this.prisma.application.update({
      where: { id },
      data: { intendedIntake: dto.intendedIntake, deadline: dto.deadline ? new Date(dto.deadline) : undefined },
    });
  }

  /// READY_FOR_REVIEW → SUBMITTED, precondition-checked: every `required` checklist item
  /// must be DONE or WAIVED first ("Không được Submit một application thiếu mandatory
  /// requirements", 08-admission/02_APPLICATION.md). Records the submission evidence
  /// together, atomically, and fires the Task Engine / Notification integrations Phase 06
  /// anticipated for this exact moment (`docs/ASSUMPTIONS.md` ASM-16).
  async submit(principal: Principal, id: string, dto: SubmitApplicationDto): Promise<Application> {
    const application = await this.requireStatus(principal, id, ['READY_FOR_REVIEW']);

    const incompleteRequired = await this.prisma.applicationChecklist.count({
      where: { applicationId: id, required: true, status: { notIn: ['DONE', 'WAIVED'] } },
    });
    if (incompleteRequired > 0) {
      throw new ConflictException({
        code: 'CHECKLIST_INCOMPLETE',
        message: `${incompleteRequired} required checklist item(s) are not yet DONE or WAIVED.`,
      });
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submissionChannel: dto.submissionChannel,
        submissionReference: dto.submissionReference,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, application.caseId);

    await this.taskGeneration.generateForEvent({
      triggerEvent: 'APPLICATION_SUBMITTED',
      sourceEntityType: 'Application',
      sourceEntityId: id,
      ownerId: (await this.prisma.case.findUniqueOrThrow({ where: { id: application.caseId } })).ownerId,
      caseId: application.caseId,
    });

    const members = await this.prisma.caseMember.findMany({ where: { caseId: application.caseId, removedAt: null } });
    for (const member of members) {
      await this.notifications.notifyBothChannels(
        member.userId,
        'APPLICATION_SUBMITTED',
        { applicationId: id, applicationCode: updated.applicationCode, programId: application.programId },
        `application-submitted:${id}:${member.userId}`,
      );
    }

    return updated;
  }

  async updateStatus(principal: Principal, id: string, dto: UpdateApplicationStatusDto): Promise<Application> {
    const application = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    const allowed = GENERIC_TRANSITIONS[application.status];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException({
        code: 'INVALID_APPLICATION_STATUS_TRANSITION',
        message: `Cannot move Application from ${application.status} to ${dto.status}.`,
        allowedTransitions: allowed,
      });
    }
    return this.prisma.application.update({ where: { id }, data: { status: dto.status } });
  }

  /// Called only by `OffersService.create` — "Không được chuyển Offer nếu chưa có offer
  /// record tương ứng" means this is the ONLY path that can move an Application to OFFER,
  /// never the generic `updateStatus` above.
  async transitionToOffer(applicationId: string): Promise<Application> {
    const application = await this.findOrThrow(applicationId);
    if (application.status === 'OFFER') return application;
    if (application.status !== 'SUBMITTED' && application.status !== 'WAITLIST') {
      throw new ConflictException({
        code: 'INVALID_APPLICATION_STATUS_TRANSITION',
        message: `An Offer can only be recorded for an Application that is SUBMITTED or WAITLIST, not ${application.status}.`,
      });
    }
    return this.prisma.application.update({ where: { id: applicationId }, data: { status: 'OFFER' } });
  }

  private async assertNoActiveDuplicate(studentId: string, programId: string, intendedIntake: string | undefined): Promise<void> {
    const existing = await this.prisma.application.findFirst({
      where: {
        studentId,
        programId,
        intendedIntake: intendedIntake ?? null,
        status: { notIn: TERMINAL_STATUSES },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ACTIVE_APPLICATION_EXISTS',
        message: `This student already has an active application (${existing.applicationCode}, ${existing.status}) for this program${intendedIntake ? ` and intake ${intendedIntake}` : ''}.`,
        existingApplicationId: existing.id,
      });
    }
  }

  private async requireStatus(principal: Principal, id: string, allowed: ApplicationStatus[]): Promise<Application> {
    const application = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    if (!allowed.includes(application.status)) {
      throw new ConflictException({
        code: 'INVALID_APPLICATION_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the application is ${application.status}.`,
      });
    }
    return application;
  }

  private async findOrThrow(id: string): Promise<Application> {
    const application = await this.prisma.application.findUnique({ where: { id } });
    if (!application) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: `Application ${id} not found.` });
    return application;
  }
}
