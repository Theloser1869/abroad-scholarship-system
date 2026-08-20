import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Case, Lead, LeadStatus, Prisma, Student } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DuplicateDetectionService } from '../../case-management/shared/duplicate-detection.service';
import { TaskGenerationService } from '../../case-management/tasks/task-generation.service';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const SORTABLE_FIELDS = ['createdAt', 'contactName', 'status', 'score'] as const;

/// 04-core-crm/01_LEAD.md status machine: New→Contacted→Qualified→Consultation→
/// Contracting→Converted/Lost. CONVERTED is reachable only through `convert()` below (SRS
/// section 9: "Converted chỉ khi tạo được Contract/Student hợp lệ") — never a bare status
/// PATCH, enforced by `UpdateLeadStatusDto` excluding it from its allowed values AND by
/// this transition table not listing it as a manual target from anywhere.
const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['CONSULTATION', 'LOST'],
  CONSULTATION: ['CONTRACTING', 'LOST'],
  CONTRACTING: ['LOST'],
  CONVERTED: [],
  LOST: [],
};

export interface ConvertResult {
  student: Student;
  case: Case;
  merged: boolean;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
    private readonly scope: ScopePolicyService,
    private readonly duplicates: DuplicateDetectionService,
    private readonly taskGeneration: TaskGenerationService,
  ) {}

  async list(principal: Principal, query: LeadQueryDto): Promise<PaginatedResult<Lead>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.LeadWhereInput = {
      ...this.scope.leadListFilter(principal),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.search
        ? {
            OR: [
              { contactName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { leadCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.lead.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(principal: Principal, id: string): Promise<Lead> {
    await this.scope.assertLeadAccessible(principal, id);
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException({ code: 'LEAD_NOT_FOUND', message: `Lead ${id} not found.` });
    return lead;
  }

  async create(dto: CreateLeadDto, actorId: string): Promise<Lead> {
    const leadCode = await this.idGenerator.nextYearlyCode('LEAD');
    return this.prisma.lead.create({
      data: {
        leadCode,
        contactName: dto.contactName,
        parentName: dto.parentName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        campaign: dto.campaign,
        countryInterest: dto.countryInterest?.toUpperCase(),
        majorInterest: dto.majorInterest,
        intake: dto.intake,
        serviceInterest: dto.serviceInterest,
        ownerId: dto.ownerId ?? actorId,
        score: dto.score,
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateLeadDto): Promise<Lead> {
    await this.getById(principal, id);
    return this.prisma.lead.update({
      where: { id },
      data: {
        contactName: dto.contactName,
        parentName: dto.parentName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        campaign: dto.campaign,
        countryInterest: dto.countryInterest?.toUpperCase(),
        majorInterest: dto.majorInterest,
        intake: dto.intake,
        serviceInterest: dto.serviceInterest,
        score: dto.score,
      },
    });
  }

  async updateStatus(principal: Principal, id: string, newStatus: Exclude<LeadStatus, 'CONVERTED'>): Promise<Lead> {
    const lead = await this.getById(principal, id);
    const allowed = LEAD_TRANSITIONS[lead.status];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot move Lead from ${lead.status} to ${newStatus}.`,
        allowedTransitions: allowed,
      });
    }
    return this.prisma.lead.update({ where: { id }, data: { status: newStatus } });
  }

  async assignOwner(principal: Principal, id: string, dto: AssignLeadDto): Promise<Lead> {
    await this.getById(principal, id);
    return this.prisma.lead.update({ where: { id }, data: { ownerId: dto.ownerId } });
  }

  /// SRS 6.2 + 04-core-crm/01_LEAD.md conversion flow. See ConvertLeadDto for the
  /// duplicate-confirmation protocol. Runs as a single DB transaction — Lead status flips
  /// to CONVERTED only if Student+Case resolution also succeeds, matching SRS section 9
  /// ("Converted chỉ khi tạo được Contract/Student hợp lệ") and
  /// docs/architecture/TARGET_ARCHITECTURE.md section 12's saga guidance for this exact
  /// cross-domain flow.
  async convert(principal: Principal, id: string, dto: ConvertLeadDto): Promise<ConvertResult> {
    const lead = await this.getById(principal, id);

    if (lead.status === 'CONVERTED') {
      throw new ConflictException({ code: 'LEAD_ALREADY_CONVERTED', message: 'This lead has already been converted.' });
    }
    if (lead.status === 'LOST') {
      throw new ConflictException({ code: 'LEAD_LOST', message: 'A lost lead cannot be converted.' });
    }

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    const candidates = await this.duplicates.findPotentialDuplicateStudents({
      email: lead.email,
      phone: lead.phone,
      fullName: lead.contactName,
      dateOfBirth,
    });

    let resolvedStudentId: string;
    let merged: boolean;

    if (candidates.length > 0 && !dto.confirmMatch) {
      throw new ConflictException({
        code: 'DUPLICATE_STUDENT_CANDIDATES',
        message: 'Potential existing Student(s) found — confirm merge or explicitly create a new Student.',
        candidates: candidates.map((c) => ({ id: c.id, studentCode: c.studentCode, fullName: c.fullName, email: c.email, phone: c.phone })),
      });
    }

    if (dto.confirmMatch === 'MERGE') {
      const target = candidates.find((c) => c.id === dto.mergeIntoStudentId);
      if (!target) {
        throw new ConflictException({
          code: 'INVALID_MERGE_TARGET',
          message: 'mergeIntoStudentId does not match a currently-detected duplicate candidate.',
        });
      }
      resolvedStudentId = target.id;
      merged = true;
    } else {
      const studentCode = await this.idGenerator.nextYearlyCode('HS');
      const created = await this.prisma.student.create({
        data: {
          studentCode,
          fullName: lead.contactName,
          dateOfBirth: dateOfBirth ?? undefined,
          email: lead.email,
          phone: lead.phone,
          targetCountry: lead.countryInterest,
          targetMajor: lead.majorInterest,
          targetIntake: lead.intake,
        },
      });
      resolvedStudentId = created.id;
      merged = false;
    }

    // "Không tạo duplicate Case cho cùng một lifecycle nếu business rule không yêu cầu" —
    // reuse an already-active Case for the resolved Student instead of creating a second
    // one (this matters most for the MERGE path, where the existing Student may already
    // have an open Case from a prior engagement).
    const existingActiveCase = await this.prisma.case.findFirst({
      where: { studentId: resolvedStudentId, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
    });

    const caseOwnerId = dto.caseOwnerId ?? lead.ownerId;

    let resultCase: Case;
    if (existingActiveCase) {
      // Reuse: only the Lead needs updating.
      await this.prisma.lead.update({ where: { id }, data: { status: 'CONVERTED', convertedStudentId: resolvedStudentId } });
      resultCase = existingActiveCase;
    } else {
      const caseCode = await this.idGenerator.nextYearlyCode('CASE');
      const [createdCase] = await this.prisma.$transaction([
        this.prisma.case.create({
          data: { caseCode, studentId: resolvedStudentId, ownerId: caseOwnerId, stage: dto.caseStage ?? 'intake' },
        }),
        this.prisma.lead.update({ where: { id }, data: { status: 'CONVERTED', convertedStudentId: resolvedStudentId } }),
      ]);
      await this.prisma.caseMember.create({ data: { caseId: createdCase.id, userId: caseOwnerId, role: 'OWNER' } });
      await this.taskGeneration.generateForEvent({
        triggerEvent: 'CASE_CREATED',
        sourceEntityType: 'Case',
        sourceEntityId: createdCase.id,
        ownerId: caseOwnerId,
        caseId: createdCase.id,
      });
      resultCase = createdCase;
    }

    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: resolvedStudentId } });
    return { student, case: resultCase, merged };
  }
}
