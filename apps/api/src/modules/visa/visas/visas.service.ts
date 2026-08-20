import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Visa, VisaStatus } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TaskGenerationService } from '../../case-management/tasks/task-generation.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { NotificationsService } from '../../notifications/notifications/notifications.service';
import { CreateVisaDto } from './dto/create-visa.dto';
import { RecordInterviewDto } from './dto/record-interview.dto';
import { RecordVisaResultDto } from './dto/record-visa-result.dto';
import { ScheduleAppointmentDto } from './dto/schedule-appointment.dto';
import { SubmitVisaDto } from './dto/submit-visa.dto';
import { UpdateVisaDto } from './dto/update-visa.dto';
import { UpdateVisaStatusDto } from './dto/update-visa-status.dto';
import { VisaQueryDto } from './dto/visa-query.dto';

const SORTABLE_FIELDS = ['createdAt', 'status', 'submittedAt'] as const;
const TERMINAL_STATUSES: VisaStatus[] = ['GRANTED', 'REFUSED', 'WITHDRAWN'];

/// 09-visa/01_VISA.md. Workflow: Not Started→Preparing→Ready→Submitted→{Appointment,
/// interview,result}→{Granted,Refused}→Withdrawn (any open state), server-side FSM.
/// SUBMITTED/APPOINTMENT/INTERVIEW/GRANTED/REFUSED are each reachable only via their own
/// dedicated, data-carrying action — never a bare client-supplied status — mirroring
/// Application/Offer's Phase 08 precedent exactly.
const GENERIC_TRANSITIONS: Record<VisaStatus, VisaStatus[]> = {
  NOT_STARTED: ['PREPARING', 'WITHDRAWN'],
  PREPARING: ['READY', 'NOT_STARTED', 'WITHDRAWN'],
  READY: ['PREPARING', 'WITHDRAWN'],
  SUBMITTED: ['WITHDRAWN'],
  APPOINTMENT: ['WITHDRAWN'],
  INTERVIEW: ['WITHDRAWN'],
  GRANTED: [],
  REFUSED: [],
  WITHDRAWN: [],
};

@Injectable()
export class VisasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
    private readonly taskGeneration: TaskGenerationService,
    private readonly notifications: NotificationsService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async listForCase(principal: Principal, caseId: string, query: VisaQueryDto): Promise<PaginatedResult<Visa>> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where = { caseId, ...(query.status ? { status: query.status } : {}) };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.visa.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.visa.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(principal: Principal, id: string): Promise<Visa> {
    const visa = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, visa.caseId);
    return visa;
  }

  /// "Không tạo một Visa record chung cho nhiều case" — caseId always required. At most
  /// one non-terminal Visa per Case (`assertNoActiveDuplicate`) — a Refused/Withdrawn
  /// visa's row is never overwritten by a new attempt; a new attempt is a new row.
  /// Instantiates every active `VisaChecklistTemplate` matching (countryCode, visaType)
  /// into real `VisaChecklistItem` rows, once, at creation.
  async create(principal: Principal, caseId: string, dto: CreateVisaDto): Promise<Visa> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const caseRecord = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${caseId} not found.` });

    if (dto.offerId) {
      const offer = await this.prisma.offer.findUnique({ where: { id: dto.offerId }, include: { application: true } });
      if (!offer || offer.application.caseId !== caseId) {
        throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: `Offer ${dto.offerId} not found for this case.` });
      }
    }

    await this.assertNoActiveDuplicate(caseId);

    const countryCode = dto.countryCode.toUpperCase();
    const visaCode = await this.idGenerator.nextYearlyCode('VISA');
    const visa = await this.prisma.visa.create({
      data: { visaCode, studentId: caseRecord.studentId, caseId, offerId: dto.offerId, countryCode, visaType: dto.visaType },
    });

    const templates = await this.prisma.visaChecklistTemplate.findMany({ where: { countryCode, visaType: dto.visaType, active: true } });
    for (const template of templates) {
      await this.prisma.visaChecklistItem.create({
        data: { entityType: 'Visa', entityId: visa.id, title: template.title, required: template.required },
      });
    }

    return visa;
  }

  async update(principal: Principal, id: string, dto: UpdateVisaDto): Promise<Visa> {
    const visa = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, visa.caseId);
    if (TERMINAL_STATUSES.includes(visa.status)) {
      throw new ConflictException({ code: 'VISA_CLOSED', message: `This visa is ${visa.status} and can no longer be edited.` });
    }
    if (dto.offerId) {
      const offer = await this.prisma.offer.findUnique({ where: { id: dto.offerId }, include: { application: true } });
      if (!offer || offer.application.caseId !== visa.caseId) {
        throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: `Offer ${dto.offerId} not found for this case.` });
      }
    }
    return this.prisma.visa.update({
      where: { id },
      data: {
        countryCode: dto.countryCode ? dto.countryCode.toUpperCase() : undefined,
        visaType: dto.visaType,
        offerId: dto.offerId,
        internalNotes: dto.internalNotes,
      },
    });
  }

  /// READY requires every required checklist item DONE/WAIVED — "Ready chỉ khi hồ sơ bắt
  /// buộc hoàn thành." Every other target here is a plain FSM transition.
  async updateStatus(principal: Principal, id: string, dto: UpdateVisaStatusDto): Promise<Visa> {
    const visa = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, visa.caseId);
    if (dto.status === 'READY') await this.assertChecklistComplete(id);
    const allowed = GENERIC_TRANSITIONS[visa.status];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException({
        code: 'INVALID_VISA_STATUS_TRANSITION',
        message: `Cannot move Visa from ${visa.status} to ${dto.status}.`,
        allowedTransitions: allowed,
      });
    }
    return this.prisma.visa.update({ where: { id }, data: { status: dto.status } });
  }

  /// READY -> SUBMITTED, re-verifying the same mandatory-checklist gate (the caller may
  /// have skipped straight from PREPARING via a stale client, or an item may have been
  /// un-completed since READY was reached) — "Submitted phải có submission evidence/
  /// reference."
  async submit(principal: Principal, id: string, dto: SubmitVisaDto): Promise<Visa> {
    const visa = await this.requireStatus(principal, id, ['READY']);
    await this.assertChecklistComplete(id);

    const updated = await this.prisma.visa.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submissionReference: dto.submissionReference, evidenceDocumentId: dto.evidenceDocumentId },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, visa.caseId, { viewOnlyForRoles: ['CONSULTANT'] });
    await this.notifyCase(visa.caseId, 'VISA_SUBMITTED', { visaId: id, visaCode: updated.visaCode });
    return updated;
  }

  /// SUBMITTED -> APPOINTMENT, "Appointment phải có appointment information phù hợp."
  async scheduleAppointment(principal: Principal, id: string, dto: ScheduleAppointmentDto): Promise<Visa> {
    const visa = await this.requireStatus(principal, id, ['SUBMITTED']);
    const updated = await this.prisma.visa.update({
      where: { id },
      data: { status: 'APPOINTMENT', appointmentAt: new Date(dto.appointmentAt), appointmentLocation: dto.appointmentLocation, appointmentReference: dto.appointmentReference },
    });
    await this.notifyCase(visa.caseId, 'VISA_APPOINTMENT_SCHEDULED', { visaId: id, visaCode: updated.visaCode, appointmentAt: updated.appointmentAt });
    return updated;
  }

  /// APPOINTMENT -> INTERVIEW. Not every visa type requires an interview step — the result
  /// action below is also reachable directly from SUBMITTED/APPOINTMENT.
  async recordInterview(principal: Principal, id: string, dto: RecordInterviewDto): Promise<Visa> {
    await this.requireStatus(principal, id, ['APPOINTMENT']);
    return this.prisma.visa.update({
      where: { id },
      data: { status: 'INTERVIEW', interviewAt: new Date(dto.interviewAt), interviewNotes: dto.interviewNotes },
    });
  }

  /// {SUBMITTED, APPOINTMENT, INTERVIEW} -> {GRANTED, REFUSED} — "Granted/Refused phải có
  /// result evidence và result date." Fires the Phase 06-deferred VISA_GRANTED task trigger
  /// only on an actual grant, never on refusal.
  async recordResult(principal: Principal, id: string, dto: RecordVisaResultDto): Promise<Visa> {
    const visa = await this.requireStatus(principal, id, ['SUBMITTED', 'APPOINTMENT', 'INTERVIEW']);
    const updated = await this.prisma.visa.update({
      where: { id },
      data: {
        status: dto.result,
        resultDate: dto.resultDate ? new Date(dto.resultDate) : new Date(),
        resultEvidenceDocumentId: dto.resultEvidenceDocumentId,
        reason: dto.reason,
      },
    });
    if (dto.resultEvidenceDocumentId) await this.documents.grantCaseAccess(dto.resultEvidenceDocumentId, visa.caseId, { viewOnlyForRoles: ['CONSULTANT'] });

    if (dto.result === 'GRANTED') {
      await this.taskGeneration.generateForEvent({
        triggerEvent: 'VISA_GRANTED',
        sourceEntityType: 'Visa',
        sourceEntityId: id,
        ownerId: (await this.prisma.case.findUniqueOrThrow({ where: { id: visa.caseId } })).ownerId,
        caseId: visa.caseId,
      });
    }
    await this.notifyCase(visa.caseId, 'VISA_RESULT', { visaId: id, visaCode: updated.visaCode, result: dto.result });
    return updated;
  }

  private async assertNoActiveDuplicate(caseId: string): Promise<void> {
    const existing = await this.prisma.visa.findFirst({ where: { caseId, status: { notIn: TERMINAL_STATUSES } } });
    if (existing) {
      throw new ConflictException({
        code: 'ACTIVE_VISA_EXISTS',
        message: `This case already has an active visa (${existing.visaCode}, ${existing.status}).`,
        existingVisaId: existing.id,
      });
    }
  }

  private async assertChecklistComplete(visaId: string): Promise<void> {
    const incompleteRequired = await this.prisma.visaChecklistItem.count({
      where: { entityType: 'Visa', entityId: visaId, required: true, status: { notIn: ['DONE', 'WAIVED'] } },
    });
    if (incompleteRequired > 0) {
      throw new ConflictException({
        code: 'CHECKLIST_INCOMPLETE',
        message: `${incompleteRequired} required checklist item(s) are not yet DONE or WAIVED.`,
      });
    }
  }

  private async notifyCase(caseId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const members = await this.prisma.caseMember.findMany({ where: { caseId, removedAt: null } });
    for (const member of members) {
      await this.notifications.notifyBothChannels(member.userId, event, payload, `${event.toLowerCase()}:${payload.visaId}:${member.userId}`);
    }
  }

  private async requireStatus(principal: Principal, id: string, allowed: VisaStatus[]): Promise<Visa> {
    const visa = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, visa.caseId);
    if (!allowed.includes(visa.status)) {
      throw new ConflictException({
        code: 'INVALID_VISA_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the visa is ${visa.status}.`,
      });
    }
    return visa;
  }

  private async findOrThrow(id: string): Promise<Visa> {
    const visa = await this.prisma.visa.findUnique({ where: { id } });
    if (!visa) throw new NotFoundException({ code: 'VISA_NOT_FOUND', message: `Visa ${id} not found.` });
    return visa;
  }
}
