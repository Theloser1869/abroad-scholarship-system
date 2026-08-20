import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Program } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { ProgramQueryDto } from './dto/program-query.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

const SORTABLE_FIELDS = ['major', 'degreeLevel', 'createdAt', 'lastVerifiedAt'] as const;

/// 08-admission/01_MASTER_DATA.md. Must belong to exactly one University (FK) — "Không
/// duplicate Program chỉ vì nhiều application"; Application references a Program by ID,
/// never by (university name, major) text.
@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async list(query: ProgramQueryDto): Promise<PaginatedResult<Program>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'major', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.ProgramWhereInput = {
      ...(query.universityId ? { universityId: query.universityId } : {}),
      ...(query.degreeLevel ? { degreeLevel: query.degreeLevel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { major: { contains: query.search, mode: 'insensitive' } },
              { programCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.program.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.program.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<Program> {
    return this.findOrThrow(id);
  }

  async create(dto: CreateProgramDto): Promise<Program> {
    await this.assertUniversityExists(dto.universityId);
    await this.assertNoDuplicate(dto.universityId, dto.degreeLevel, dto.major, dto.intake);
    const programCode = await this.idGenerator.nextYearlyCode('PRG');
    return this.prisma.program.create({
      data: {
        programCode,
        universityId: dto.universityId,
        degreeLevel: dto.degreeLevel,
        major: dto.major,
        intake: dto.intake,
        durationMonths: dto.durationMonths,
        tuition: dto.tuition,
        tuitionCurrency: dto.tuitionCurrency,
        applicationFee: dto.applicationFee,
        eligibility: dto.eligibility,
        requirements: dto.requirements,
        status: dto.status,
        source: dto.source,
      },
    });
  }

  async update(id: string, dto: UpdateProgramDto): Promise<Program> {
    const existing = await this.findOrThrow(id);
    if (dto.universityId) await this.assertUniversityExists(dto.universityId);
    if (dto.universityId !== undefined || dto.degreeLevel !== undefined || dto.major !== undefined || dto.intake !== undefined) {
      await this.assertNoDuplicate(
        dto.universityId ?? existing.universityId,
        dto.degreeLevel ?? existing.degreeLevel,
        dto.major ?? existing.major,
        dto.intake !== undefined ? dto.intake : (existing.intake ?? undefined),
        id,
      );
    }
    return this.prisma.program.update({
      where: { id },
      data: {
        universityId: dto.universityId,
        degreeLevel: dto.degreeLevel,
        major: dto.major,
        intake: dto.intake,
        durationMonths: dto.durationMonths,
        tuition: dto.tuition,
        tuitionCurrency: dto.tuitionCurrency,
        applicationFee: dto.applicationFee,
        eligibility: dto.eligibility,
        requirements: dto.requirements,
        status: dto.status,
        source: dto.source,
      },
    });
  }

  async verify(id: string): Promise<Program> {
    await this.findOrThrow(id);
    return this.prisma.program.update({ where: { id }, data: { lastVerifiedAt: new Date() } });
  }

  private async assertUniversityExists(universityId: string): Promise<void> {
    const university = await this.prisma.university.findUnique({ where: { id: universityId } });
    if (!university) throw new NotFoundException({ code: 'UNIVERSITY_NOT_FOUND', message: `University ${universityId} not found.` });
  }

  private async assertNoDuplicate(universityId: string, degreeLevel: string, major: string, intake: string | undefined, excludeId?: string): Promise<void> {
    const existing = await this.prisma.program.findFirst({
      where: {
        universityId,
        degreeLevel: { equals: degreeLevel, mode: 'insensitive' },
        major: { equals: major, mode: 'insensitive' },
        intake: intake ?? null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PROGRAM',
        message: `A program (${degreeLevel} ${major}${intake ? `, intake ${intake}` : ''}) already exists for this university (${existing.programCode}).`,
        existingProgramId: existing.id,
      });
    }
  }

  private async findOrThrow(id: string): Promise<Program> {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: `Program ${id} not found.` });
    return program;
  }
}
