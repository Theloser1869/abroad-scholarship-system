import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ScholarshipMaster } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateScholarshipMasterDto } from './dto/create-scholarship-master.dto';
import { ScholarshipMasterQueryDto } from './dto/scholarship-master-query.dto';
import { UpdateScholarshipMasterDto } from './dto/update-scholarship-master.dto';

const SORTABLE_FIELDS = ['name', 'provider', 'deadline', 'createdAt', 'lastVerifiedAt'] as const;

/// 08-admission/01_MASTER_DATA.md. Master definition only — deliberately separate from
/// `ScholarshipApplication` (the per-student transaction, in ../scholarship-applications).
/// "Không tạo một ScholarshipMaster mới cho mỗi student application" — one master row is
/// referenced by many ScholarshipApplication rows via FK, never copied per applicant.
@Injectable()
export class ScholarshipMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async list(query: ScholarshipMasterQueryDto): Promise<PaginatedResult<ScholarshipMaster>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'name', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.ScholarshipMasterWhereInput = {
      ...(query.universityId ? { universityId: query.universityId } : {}),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { provider: { contains: query.search, mode: 'insensitive' } },
              { scholarshipCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.scholarshipMaster.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.scholarshipMaster.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<ScholarshipMaster> {
    return this.findOrThrow(id);
  }

  async create(dto: CreateScholarshipMasterDto): Promise<ScholarshipMaster> {
    if (dto.universityId) await this.assertUniversityExists(dto.universityId);
    if (dto.programId) await this.assertProgramExists(dto.programId);
    await this.assertNoDuplicate(dto.provider, dto.name, dto.universityId, dto.programId);
    const scholarshipCode = await this.idGenerator.nextYearlyCode('SCHM');
    return this.prisma.scholarshipMaster.create({
      data: {
        scholarshipCode,
        provider: dto.provider,
        name: dto.name,
        universityId: dto.universityId,
        programId: dto.programId,
        eligibility: dto.eligibility,
        coverageType: dto.coverageType,
        amount: dto.amount,
        percentage: dto.percentage,
        amountCurrency: dto.amountCurrency,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        requiredDocuments: dto.requiredDocuments,
        conditions: dto.conditions,
        status: dto.status,
        source: dto.source,
      },
    });
  }

  async update(id: string, dto: UpdateScholarshipMasterDto): Promise<ScholarshipMaster> {
    const existing = await this.findOrThrow(id);
    if (dto.universityId) await this.assertUniversityExists(dto.universityId);
    if (dto.programId) await this.assertProgramExists(dto.programId);
    if (dto.provider !== undefined || dto.name !== undefined || dto.universityId !== undefined || dto.programId !== undefined) {
      await this.assertNoDuplicate(
        dto.provider ?? existing.provider,
        dto.name ?? existing.name,
        dto.universityId !== undefined ? dto.universityId : (existing.universityId ?? undefined),
        dto.programId !== undefined ? dto.programId : (existing.programId ?? undefined),
        id,
      );
    }
    return this.prisma.scholarshipMaster.update({
      where: { id },
      data: {
        provider: dto.provider,
        name: dto.name,
        universityId: dto.universityId,
        programId: dto.programId,
        eligibility: dto.eligibility,
        coverageType: dto.coverageType,
        amount: dto.amount,
        percentage: dto.percentage,
        amountCurrency: dto.amountCurrency,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        requiredDocuments: dto.requiredDocuments,
        conditions: dto.conditions,
        status: dto.status,
        source: dto.source,
      },
    });
  }

  async verify(id: string): Promise<ScholarshipMaster> {
    await this.findOrThrow(id);
    return this.prisma.scholarshipMaster.update({ where: { id }, data: { lastVerifiedAt: new Date() } });
  }

  private async assertUniversityExists(universityId: string): Promise<void> {
    const university = await this.prisma.university.findUnique({ where: { id: universityId } });
    if (!university) throw new NotFoundException({ code: 'UNIVERSITY_NOT_FOUND', message: `University ${universityId} not found.` });
  }

  private async assertProgramExists(programId: string): Promise<void> {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: `Program ${programId} not found.` });
  }

  private async assertNoDuplicate(provider: string, name: string, universityId: string | undefined, programId: string | undefined, excludeId?: string): Promise<void> {
    const existing = await this.prisma.scholarshipMaster.findFirst({
      where: {
        provider: { equals: provider, mode: 'insensitive' },
        name: { equals: name, mode: 'insensitive' },
        universityId: universityId ?? null,
        programId: programId ?? null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_SCHOLARSHIP_MASTER',
        message: `A scholarship "${name}" from ${provider} already exists for this university/program (${existing.scholarshipCode}).`,
        existingScholarshipMasterId: existing.id,
      });
    }
  }

  private async findOrThrow(id: string): Promise<ScholarshipMaster> {
    const scholarship = await this.prisma.scholarshipMaster.findUnique({ where: { id } });
    if (!scholarship) throw new NotFoundException({ code: 'SCHOLARSHIP_MASTER_NOT_FOUND', message: `ScholarshipMaster ${id} not found.` });
    return scholarship;
  }
}
