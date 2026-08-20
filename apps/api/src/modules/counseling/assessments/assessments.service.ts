import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Assessment, AssessmentCriterion } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { ApproveAssessmentDto } from './dto/approve-assessment.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { RejectAssessmentDto } from './dto/reject-assessment.dto';
import { UpsertCriterionDto } from './dto/upsert-criterion.dto';

const OPEN_STATUSES = ['DRAFT', 'REVIEW'] as const;

/// 07-profile/01_ASSESSMENT_ROADMAP.md. Assessment reuses `ScopePolicyService.
/// assertCaseAccessible` directly (every row carries its own `caseId`) rather than a new
/// scope map — same reasoning as Task's ASM-16.
@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<Assessment[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.assessment.findMany({ where: { caseId }, orderBy: { version: 'desc' }, include: { criteria: true } });
  }

  async getById(principal: Principal, id: string): Promise<Assessment & { criteria: AssessmentCriterion[] }> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id }, include: { criteria: true } });
    if (!assessment) throw new NotFoundException({ code: 'ASSESSMENT_NOT_FOUND', message: `Assessment ${id} not found.` });
    await this.scope.assertCaseAccessible(principal, assessment.caseId);
    return assessment;
  }

  /// Always the NEXT version for the case — never overwrites an APPROVED row. If the
  /// current latest version is APPROVED, it is marked SUPERSEDED (existing enum value,
  /// first real use) so "current version" queries stay unambiguous while the old row
  /// remains intact and still referenceable by any Roadmap that already points at it
  /// (`docs/ASSUMPTIONS.md`).
  async create(principal: Principal, caseId: string, dto: CreateAssessmentDto): Promise<Assessment> {
    await this.scope.assertCaseAccessible(principal, caseId);

    const latest = await this.prisma.assessment.findFirst({ where: { caseId }, orderBy: { version: 'desc' } });
    if (latest && (OPEN_STATUSES as readonly string[]).includes(latest.status)) {
      throw new ConflictException({
        code: 'OPEN_ASSESSMENT_EXISTS',
        message: `An assessment version (${latest.version}, ${latest.status}) is still open for this case — resolve it before starting a new one.`,
        existingAssessmentId: latest.id,
      });
    }
    if (latest?.status === 'APPROVED' && !dto.changeReason) {
      throw new ConflictException({ code: 'CHANGE_REASON_REQUIRED', message: 'A change reason is required when re-assessing after a prior approved version.' });
    }

    const nextVersion = (latest?.version ?? 0) + 1;
    const results = await this.prisma.$transaction([
      ...(latest?.status === 'APPROVED' ? [this.prisma.assessment.update({ where: { id: latest.id }, data: { status: 'SUPERSEDED' as const } })] : []),
      this.prisma.assessment.create({ data: { caseId, version: nextVersion, changeReason: dto.changeReason } }),
    ]);
    // The create is always the LAST element — a fixed `[, created]` destructure silently
    // returned `undefined` whenever there was no preceding supersede-update (i.e. every
    // case's very first assessment), since the array then has only one element.
    return results[results.length - 1] as Assessment;
  }

  async submit(principal: Principal, id: string): Promise<Assessment> {
    const assessment = await this.requireStatus(principal, id, ['DRAFT']);
    return this.prisma.assessment.update({ where: { id: assessment.id }, data: { status: 'REVIEW' } });
  }

  async approve(principal: Principal, id: string, dto: ApproveAssessmentDto): Promise<Assessment> {
    const assessment = await this.requireStatus(principal, id, ['REVIEW']);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.approval.create({ data: { entityType: 'Assessment', entityId: id, approverId: principal.userId, decision: 'APPROVED', reason: dto.reason, decidedAt: new Date() } }),
      this.prisma.assessment.update({ where: { id: assessment.id }, data: { status: 'APPROVED', approvedById: principal.userId, approvedAt: new Date() } }),
    ]);
    return updated;
  }

  async reject(principal: Principal, id: string, dto: RejectAssessmentDto): Promise<Assessment> {
    const assessment = await this.requireStatus(principal, id, ['REVIEW']);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.approval.create({ data: { entityType: 'Assessment', entityId: id, approverId: principal.userId, decision: 'REJECTED', reason: dto.reason, decidedAt: new Date() } }),
      this.prisma.assessment.update({ where: { id: assessment.id }, data: { status: 'DRAFT' } }),
    ]);
    return updated;
  }

  /// Criteria are only editable while the assessment itself is DRAFT — matches "không
  /// overwrite một assessment đã approved," extended to REVIEW too (a pending decision
  /// shouldn't have its underlying facts change out from under the reviewer).
  async upsertCriterion(principal: Principal, assessmentId: string, dto: UpsertCriterionDto): Promise<AssessmentCriterion> {
    const assessment = await this.requireStatus(principal, assessmentId, ['DRAFT']);
    const gap = dto.currentScore !== undefined && dto.targetScore !== undefined ? dto.targetScore - dto.currentScore : undefined;
    return this.prisma.assessmentCriterion.upsert({
      where: { assessmentId_area: { assessmentId: assessment.id, area: dto.area } },
      update: {
        currentScore: dto.currentScore,
        targetScore: dto.targetScore,
        gap,
        priority: dto.priority,
        recommendation: dto.recommendation,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
      create: {
        assessmentId: assessment.id,
        area: dto.area,
        currentScore: dto.currentScore,
        targetScore: dto.targetScore,
        gap,
        priority: dto.priority,
        recommendation: dto.recommendation,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
  }

  private async requireStatus(principal: Principal, id: string, allowed: string[]): Promise<Assessment> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException({ code: 'ASSESSMENT_NOT_FOUND', message: `Assessment ${id} not found.` });
    await this.scope.assertCaseAccessible(principal, assessment.caseId);
    if (!allowed.includes(assessment.status)) {
      throw new ConflictException({
        code: 'INVALID_ASSESSMENT_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the assessment is ${assessment.status}.`,
      });
    }
    return assessment;
  }
}
