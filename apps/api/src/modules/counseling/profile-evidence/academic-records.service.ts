import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicRecord } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';

/// 07-profile/02_PROFILE_EVIDENCE.md. One row per (school, period) — never overwritten
/// across periods, only within the same period (see schema.prisma's own comment on
/// `AcademicRecord`). Reuses `assertCaseAccessible` directly (docs/ASSUMPTIONS.md ASM-16
/// reasoning, extended to every Phase 07 Case-scoped entity).
@Injectable()
export class AcademicRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<AcademicRecord[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.academicRecord.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<AcademicRecord> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return record;
  }

  async create(principal: Principal, caseId: string, dto: CreateAcademicRecordDto): Promise<AcademicRecord> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const school = await this.resolveSchool(dto.schoolMasterId, dto.school);
    const record = await this.prisma.academicRecord.create({
      data: {
        caseId,
        school,
        schoolMasterId: dto.schoolMasterId,
        period: dto.period,
        grade: dto.grade,
        gpa: dto.gpa,
        gradingScale: dto.gradingScale,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, caseId);
    return record;
  }

  async update(principal: Principal, id: string, dto: UpdateAcademicRecordDto): Promise<AcademicRecord> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    const school = dto.schoolMasterId !== undefined || dto.school !== undefined ? await this.resolveSchool(dto.schoolMasterId, dto.school) : undefined;
    const updated = await this.prisma.academicRecord.update({
      where: { id },
      data: { school, schoolMasterId: dto.schoolMasterId, period: dto.period, grade: dto.grade, gpa: dto.gpa, gradingScale: dto.gradingScale, evidenceDocumentId: dto.evidenceDocumentId },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, record.caseId);
    return updated;
  }

  /// Client Acceptance Remediation DEC-05(b) (2026-08-27) — "ưu tiên School Master, cho phép
  /// nhập trường chưa có." When `schoolMasterId` is given, `school` is always resolved from
  /// that row's own `name` server-side (never trusted from the client, to avoid drift between
  /// the two); when it isn't, `school` is plain client-supplied free text.
  private async resolveSchool(schoolMasterId: string | undefined, freeTextSchool: string | undefined): Promise<string> {
    if (!schoolMasterId) return freeTextSchool!;
    const master = await this.prisma.schoolMaster.findUnique({ where: { id: schoolMasterId } });
    if (!master) throw new NotFoundException({ code: 'SCHOOL_MASTER_NOT_FOUND', message: `School master ${schoolMasterId} not found.` });
    return master.name;
  }

  async verify(principal: Principal, id: string): Promise<AcademicRecord> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return this.prisma.academicRecord.update({ where: { id }, data: { verifiedById: principal.userId, verifiedAt: new Date() } });
  }

  private async findOrThrow(id: string): Promise<AcademicRecord> {
    const record = await this.prisma.academicRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 'ACADEMIC_RECORD_NOT_FOUND', message: `Academic record ${id} not found.` });
    return record;
  }
}
