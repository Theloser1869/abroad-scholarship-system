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
    await this.assertStudentProfileComplete(assessment.caseId);
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

  /// Client Acceptance Remediation GAP-004/GAP-005 (RESOLVED 2026-08-25) — 04_Student_Profile
  /// marks DOB, school, grade, target country/major/intake, and scholarship goal all "Bắt
  /// buộc". None of these can reasonably be required at Student-creation time (staff routinely
  /// opens a bare Student record before counseling has gathered target-country/major) — see
  /// docs/ASSUMPTIONS.md ASM-90 for why this is enforced stage-aware here, at Assessment
  /// approval, rather than as a DB NOT NULL constraint on Student/AcademicRecord. Client
  /// confirmed 2026-08-25 that this stage-aware enforcement is the intended design. GPA is
  /// deliberately excluded from this gate — client decision (2026-08-25, CONFLICT-004): GPA
  /// is Optional, not "Bắt buộc" (sheet17's reading wins over sheet04's). See GAP-027.
  /// Client Acceptance Remediation sheet06 row6 ("Hồ sơ hoàn chỉnh %") — the batched,
  /// non-throwing counterpart to `assertStudentProfileComplete` below, used by
  /// `ReportsService` for the KPI dashboard. Reuses the EXACT same 6 conditions (never a
  /// second/diverging definition of "complete" — this project's standing rule against
  /// calculating the same thing differently in different places).
  async countProfileCompleteness(caseIds: string[]): Promise<{ total: number; complete: number }> {
    if (caseIds.length === 0) return { total: 0, complete: 0 };

    const cases = await this.prisma.case.findMany({
      where: { id: { in: caseIds } },
      select: {
        id: true,
        student: { select: { dateOfBirth: true, targetCountry: true, targetMajor: true, targetIntake: true, scholarshipGoal: true } },
      },
    });
    const casesWithAcademicRecord = await this.prisma.academicRecord.findMany({
      where: { caseId: { in: caseIds }, grade: { not: null } },
      select: { caseId: true },
      distinct: ['caseId'],
    });
    const caseIdsWithAcademicRecord = new Set(casesWithAcademicRecord.map((r) => r.caseId));

    const complete = cases.filter(
      (c) =>
        c.student.dateOfBirth !== null &&
        c.student.targetCountry !== null &&
        c.student.targetMajor !== null &&
        c.student.targetIntake !== null &&
        c.student.scholarshipGoal !== null &&
        caseIdsWithAcademicRecord.has(c.id),
    ).length;

    return { total: cases.length, complete };
  }

  private async assertStudentProfileComplete(caseId: string): Promise<void> {
    const caseRecord = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId }, select: { studentId: true } });
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: caseRecord.studentId } });

    const missing: string[] = [];
    if (!student.dateOfBirth) missing.push('dateOfBirth');
    if (!student.targetCountry) missing.push('targetCountry');
    if (!student.targetMajor) missing.push('targetMajor');
    if (!student.targetIntake) missing.push('targetIntake');
    if (!student.scholarshipGoal) missing.push('scholarshipGoal');

    /// GPA is Optional per client decision (2026-08-25, CONFLICT-004 — sheet17's reading
    /// wins over sheet04's "Bắt buộc") — only `grade` gates approval here.
    const academicRecord = await this.prisma.academicRecord.findFirst({
      where: { caseId, grade: { not: null } },
    });
    if (!academicRecord) missing.push('academicRecord (grade)');

    if (missing.length > 0) {
      throw new ConflictException({
        code: 'STUDENT_PROFILE_INCOMPLETE',
        message: `The student's profile is missing required fields before this assessment can be approved: ${missing.join(', ')}.`,
        missingFields: missing,
      });
    }
  }
}
