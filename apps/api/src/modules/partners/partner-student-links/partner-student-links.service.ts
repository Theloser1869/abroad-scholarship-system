import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Partner, PartnerStudentLink, Student } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult } from '../../../common/dto/list-query.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePartnerStudentLinkDto } from './dto/create-partner-student-link.dto';
import { PartnerStudentLinkQueryDto } from './dto/partner-student-link-query.dto';
import { UpdatePartnerStudentLinkDto } from './dto/update-partner-student-link.dto';

/// DEC-12 — mirrors DEC-09/DEC-10/DEC-11's `STUDENT_SUMMARY_SELECT` pattern exactly.
/// PartnerStudentLink is read from two different parent contexts
/// (`/partners/:partnerId/student-links` needs the Student's name; `/students/:studentId/
/// partner-links` needs the Partner's name) — both summaries are embedded unconditionally
/// on every list/detail read, never conditionally per-endpoint, keeping one shared shape.
const PARTNER_SUMMARY_SELECT = { select: { id: true, name: true, countryCode: true } } as const;
const STUDENT_SUMMARY_SELECT = { select: { id: true, studentCode: true, fullName: true } } as const;

export type PartnerStudentLinkWithRelations = PartnerStudentLink & {
  partner: Pick<Partner, 'id' | 'name' | 'countryCode'>;
  student: Pick<Student, 'id' | 'studentCode' | 'fullName'>;
};

/// 10-partners/01_PARTNER_CRM.md Partner<->Student/Case section — SRS 6.17 "liên kết nhiều
/// student/case/application bằng bảng trung gian." Every FK here is validated against its
/// real owning table (never trusting a client-supplied id blind); nothing is ever copied
/// (no student/partner/application name stored on this row).
@Injectable()
export class PartnerStudentLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async listForPartner(partnerId: string, query: PartnerStudentLinkQueryDto): Promise<PaginatedResult<PartnerStudentLinkWithRelations>> {
    await this.assertPartnerExists(partnerId);
    return this.paginate({ partnerId, ...(query.status ? { status: query.status } : {}) }, query);
  }

  async listForStudent(studentId: string, query: PartnerStudentLinkQueryDto): Promise<PaginatedResult<PartnerStudentLinkWithRelations>> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: `Student ${studentId} not found.` });
    return this.paginate({ studentId, ...(query.status ? { status: query.status } : {}) }, query);
  }

  async getById(id: string): Promise<PartnerStudentLinkWithRelations> {
    return this.findOrThrow(id);
  }

  /// "Không biến PartnerStudentLink thành một duplicate Case/Application entity" — this
  /// row only ever stores FKs, never a copy of Case/Application state. Duplicate check:
  /// no second ACTIVE link for the exact same (partner, student, case, application) tuple
  /// — a Student may still have many DIFFERENT active links to the same Partner if the
  /// case/application differs.
  async create(partnerId: string, principal: Principal, dto: CreatePartnerStudentLinkDto): Promise<PartnerStudentLink> {
    await this.assertPartnerExists(partnerId);
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: `Student ${dto.studentId} not found.` });

    if (dto.caseId) {
      const caseRecord = await this.prisma.case.findUnique({ where: { id: dto.caseId } });
      if (!caseRecord || caseRecord.studentId !== dto.studentId) {
        throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${dto.caseId} not found for this student.` });
      }
    }
    if (dto.applicationId) {
      const application = await this.prisma.application.findUnique({ where: { id: dto.applicationId } });
      if (!application || application.studentId !== dto.studentId) {
        throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: `Application ${dto.applicationId} not found for this student.` });
      }
    }
    // Client Acceptance Remediation GAP-006 (REQ-PARTNER-008) — same "validate against the
    // real owning table, never trust a client-supplied id blind" pattern as caseId/
    // applicationId above.
    if (dto.contractId) {
      const contract = await this.prisma.contract.findUnique({ where: { id: dto.contractId } });
      if (!contract || contract.studentId !== dto.studentId) {
        throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: `Contract ${dto.contractId} not found for this student.` });
      }
    }
    if (dto.scholarshipApplicationId) {
      const scholarshipApplication = await this.prisma.scholarshipApplication.findUnique({ where: { id: dto.scholarshipApplicationId } });
      if (!scholarshipApplication || scholarshipApplication.studentId !== dto.studentId) {
        throw new NotFoundException({
          code: 'SCHOLARSHIP_APPLICATION_NOT_FOUND',
          message: `Scholarship application ${dto.scholarshipApplicationId} not found for this student.`,
        });
      }
    }

    const existing = await this.prisma.partnerStudentLink.findFirst({
      where: { partnerId, studentId: dto.studentId, caseId: dto.caseId ?? null, applicationId: dto.applicationId ?? null, status: 'ACTIVE' },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PARTNER_STUDENT_LINK',
        message: 'An active link already exists for this partner/student/case/application combination.',
        existingLinkId: existing.id,
      });
    }

    return this.prisma.partnerStudentLink.create({
      data: {
        partnerId,
        studentId: dto.studentId,
        caseId: dto.caseId,
        applicationId: dto.applicationId,
        contractId: dto.contractId,
        scholarshipApplicationId: dto.scholarshipApplicationId,
        linkType: dto.linkType,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        notes: dto.notes,
        createdById: principal.userId,
      },
    });
  }

  async update(id: string, dto: UpdatePartnerStudentLinkDto): Promise<PartnerStudentLink> {
    const link = await this.findOrThrow(id);
    if (link.status === 'ARCHIVED') {
      throw new ConflictException({ code: 'PARTNER_STUDENT_LINK_ARCHIVED', message: 'This link is archived and can no longer be edited.' });
    }
    return this.prisma.partnerStudentLink.update({
      where: { id },
      data: {
        linkType: dto.linkType,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  /// "Link removal/archive" — no hard-delete anywhere (Hard Rule #5); archiving preserves
  /// the link's full history, stamping `endDate`.
  async archive(id: string): Promise<PartnerStudentLink> {
    const link = await this.findOrThrow(id);
    if (link.status === 'ARCHIVED') {
      throw new ConflictException({ code: 'PARTNER_STUDENT_LINK_ARCHIVED', message: 'This link is already archived.' });
    }
    return this.prisma.partnerStudentLink.update({ where: { id }, data: { status: 'ARCHIVED', endDate: new Date() } });
  }

  private async paginate(where: Record<string, unknown>, query: PartnerStudentLinkQueryDto): Promise<PaginatedResult<PartnerStudentLinkWithRelations>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.partnerStudentLink.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { partner: PARTNER_SUMMARY_SELECT, student: STUDENT_SUMMARY_SELECT },
      }),
      this.prisma.partnerStudentLink.count({ where }),
    ]);
    return new PaginatedResult(data as PartnerStudentLinkWithRelations[], new PageMeta(page, limit, totalItems));
  }

  private async assertPartnerExists(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException({ code: 'PARTNER_NOT_FOUND', message: `Partner ${partnerId} not found.` });
  }

  private async findOrThrow(id: string): Promise<PartnerStudentLinkWithRelations> {
    const link = await this.prisma.partnerStudentLink.findUnique({
      where: { id },
      include: { partner: PARTNER_SUMMARY_SELECT, student: STUDENT_SUMMARY_SELECT },
    });
    if (!link) throw new NotFoundException({ code: 'PARTNER_STUDENT_LINK_NOT_FOUND', message: `Partner student link ${id} not found.` });
    return link;
  }
}
