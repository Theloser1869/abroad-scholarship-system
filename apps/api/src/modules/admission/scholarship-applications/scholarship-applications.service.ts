import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ScholarshipApplication, ScholarshipApplicationStatus } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { TaskGenerationService } from '../../case-management/tasks/task-generation.service';
import { NotificationsService } from '../../notifications/notifications/notifications.service';
import { AwardScholarshipDto } from './dto/award-scholarship.dto';
import { ConfirmEligibilityDto } from './dto/confirm-eligibility.dto';
import { CreateScholarshipApplicationDto } from './dto/create-scholarship-application.dto';
import { UpdateScholarshipApplicationDto } from './dto/update-scholarship-application.dto';
import { UpdateScholarshipApplicationStatusDto } from './dto/update-scholarship-application-status.dto';

/// 08-admission/03_OFFER_SCHOLARSHIP.md. Kept fully separate from `ScholarshipMaster`
/// (that master's own service, ../master-data) — this is the per-student transaction.
/// AWARDED/REJECTED are reachable only via their own dedicated actions (`award`/`reject`),
/// never the generic `updateStatus`, mirroring Application's OFFER-only-via-dedicated-
/// action precedent — a real award carries required extra data that a bare status flip
/// can't express safely.
const GENERIC_TRANSITIONS: Record<ScholarshipApplicationStatus, ScholarshipApplicationStatus[]> = {
  PLANNING: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['INTERVIEW', 'WITHDRAWN'],
  INTERVIEW: ['WITHDRAWN'],
  AWARDED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

@Injectable()
export class ScholarshipApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
    private readonly taskGeneration: TaskGenerationService,
    private readonly notifications: NotificationsService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<ScholarshipApplication[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.scholarshipApplication.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<ScholarshipApplication> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return record;
  }

  async create(principal: Principal, caseId: string, dto: CreateScholarshipApplicationDto): Promise<ScholarshipApplication> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const caseRecord = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${caseId} not found.` });

    const master = await this.prisma.scholarshipMaster.findUnique({ where: { id: dto.scholarshipMasterId } });
    if (!master) throw new NotFoundException({ code: 'SCHOLARSHIP_MASTER_NOT_FOUND', message: `ScholarshipMaster ${dto.scholarshipMasterId} not found.` });

    if (dto.applicationId) {
      const application = await this.prisma.application.findUnique({ where: { id: dto.applicationId } });
      if (!application || application.caseId !== caseId) {
        throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: `Application ${dto.applicationId} not found for this case.` });
      }
    }

    const scholarshipApplicationCode = await this.idGenerator.nextYearlyCode('SCH');
    return this.prisma.scholarshipApplication.create({
      data: {
        scholarshipApplicationCode,
        studentId: caseRecord.studentId,
        caseId,
        scholarshipMasterId: dto.scholarshipMasterId,
        applicationId: dto.applicationId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        essayArtifactId: dto.essayArtifactId,
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateScholarshipApplicationDto): Promise<ScholarshipApplication> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    if (record.status === 'AWARDED' || record.status === 'REJECTED' || record.status === 'WITHDRAWN') {
      throw new ConflictException({ code: 'SCHOLARSHIP_APPLICATION_CLOSED', message: `This scholarship application is ${record.status} and can no longer be edited.` });
    }
    return this.prisma.scholarshipApplication.update({
      where: { id },
      data: {
        applicationId: dto.applicationId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        essayArtifactId: dto.essayArtifactId,
        interviewAt: dto.interviewAt ? new Date(dto.interviewAt) : undefined,
        internalNotes: dto.internalNotes,
        conditions: dto.conditions,
      },
    });
  }

  /// "Kiểm tra eligibility trước các bước yêu cầu" — SUBMITTED is blocked until eligibility
  /// has been explicitly confirmed.
  async confirmEligibility(principal: Principal, id: string, dto: ConfirmEligibilityDto): Promise<ScholarshipApplication> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return this.prisma.scholarshipApplication.update({
      where: { id },
      data: { eligibilityConfirmed: true, eligibilityNotes: dto.eligibilityNotes },
    });
  }

  async updateStatus(principal: Principal, id: string, dto: UpdateScholarshipApplicationStatusDto): Promise<ScholarshipApplication> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    if (dto.status === 'SUBMITTED' && !record.eligibilityConfirmed) {
      throw new ConflictException({ code: 'ELIGIBILITY_NOT_CONFIRMED', message: 'Eligibility must be confirmed before submitting.' });
    }
    const allowed = GENERIC_TRANSITIONS[record.status];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException({
        code: 'INVALID_SCHOLARSHIP_APPLICATION_STATUS_TRANSITION',
        message: `Cannot move ScholarshipApplication from ${record.status} to ${dto.status}.`,
        allowedTransitions: allowed,
      });
    }
    return this.prisma.scholarshipApplication.update({ where: { id }, data: { status: dto.status } });
  }

  /// SCHOLARSHIP RESULT — award fields recorded together; fires the Task Engine /
  /// Notification integrations Phase 06 anticipated for "scholarship" (docs/ASSUMPTIONS.md
  /// ASM-16).
  async award(principal: Principal, id: string, dto: AwardScholarshipDto): Promise<ScholarshipApplication> {
    const record = await this.requireStatus(principal, id, ['UNDER_REVIEW', 'INTERVIEW']);
    const updated = await this.prisma.scholarshipApplication.update({
      where: { id },
      data: {
        status: 'AWARDED',
        decidedAt: new Date(),
        awardAmount: dto.awardAmount,
        awardCurrency: dto.awardCurrency,
        awardCoverageType: dto.awardCoverageType,
        awardPeriod: dto.awardPeriod,
        awardAcceptanceDeadline: dto.awardAcceptanceDeadline ? new Date(dto.awardAcceptanceDeadline) : undefined,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, record.caseId);

    await this.taskGeneration.generateForEvent({
      triggerEvent: 'SCHOLARSHIP_AWARDED',
      sourceEntityType: 'ScholarshipApplication',
      sourceEntityId: id,
      ownerId: (await this.prisma.case.findUniqueOrThrow({ where: { id: record.caseId } })).ownerId,
      caseId: record.caseId,
    });

    const members = await this.prisma.caseMember.findMany({ where: { caseId: record.caseId, removedAt: null } });
    for (const member of members) {
      await this.notifications.notifyBothChannels(
        member.userId,
        'SCHOLARSHIP_AWARDED',
        { scholarshipApplicationId: id, scholarshipApplicationCode: updated.scholarshipApplicationCode },
        `scholarship-awarded:${id}:${member.userId}`,
      );
    }

    return updated;
  }

  async reject(principal: Principal, id: string): Promise<ScholarshipApplication> {
    await this.requireStatus(principal, id, ['UNDER_REVIEW', 'INTERVIEW']);
    return this.prisma.scholarshipApplication.update({ where: { id }, data: { status: 'REJECTED', decidedAt: new Date() } });
  }

  private async requireStatus(principal: Principal, id: string, allowed: ScholarshipApplicationStatus[]): Promise<ScholarshipApplication> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    if (!allowed.includes(record.status)) {
      throw new ConflictException({
        code: 'INVALID_SCHOLARSHIP_APPLICATION_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the scholarship application is ${record.status}.`,
      });
    }
    return record;
  }

  private async findOrThrow(id: string): Promise<ScholarshipApplication> {
    const record = await this.prisma.scholarshipApplication.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 'SCHOLARSHIP_APPLICATION_NOT_FOUND', message: `ScholarshipApplication ${id} not found.` });
    return record;
  }
}
