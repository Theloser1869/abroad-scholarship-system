import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PartnerProgram, Prisma } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePartnerProgramDto } from './dto/create-partner-program.dto';
import { PartnerProgramQueryDto } from './dto/partner-program-query.dto';
import { UpdatePartnerProgramDto } from './dto/update-partner-program.dto';

const SORTABLE_FIELDS = ['name', 'degreeLevel', 'createdAt'] as const;

/// 10-partners/01_PARTNER_CRM.md PartnerProgram section. "PartnerProgram phải thuộc
/// Partner" — always created under an existing Partner, never standalone. "Không duplicate
/// PartnerProgram chỉ vì nhiều Student/Application" — this row itself carries no
/// Student/Application FK; it's referenced BY CommissionRule, never vice versa.
@Injectable()
export class PartnerProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async listForPartner(partnerId: string, query: PartnerProgramQueryDto): Promise<PaginatedResult<PartnerProgram>> {
    await this.assertPartnerExists(partnerId);
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'name', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.PartnerProgramWhereInput = {
      partnerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.partnerProgram.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.partnerProgram.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<PartnerProgram> {
    return this.findOrThrow(id);
  }

  /// Duplicate check on (partnerId, name, degreeLevel, major, intake) — same "don't create
  /// a near-identical row" discipline as Program's own duplicate check (Phase 08).
  async create(partnerId: string, dto: CreatePartnerProgramDto): Promise<PartnerProgram> {
    const partner = await this.assertPartnerExists(partnerId);

    if (dto.programId) {
      const program = await this.prisma.program.findUnique({ where: { id: dto.programId } });
      if (!program) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: `Program ${dto.programId} not found.` });
    }

    const existing = await this.prisma.partnerProgram.findFirst({
      where: { partnerId, name: { equals: dto.name, mode: 'insensitive' }, degreeLevel: dto.degreeLevel, major: dto.major, intake: dto.intake },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PARTNER_PROGRAM',
        message: `Partner "${partner.name}" already has a program named "${dto.name}" with the same degree/major/intake.`,
        existingPartnerProgramId: existing.id,
      });
    }

    const suffix = await this.idGenerator.nextPartnerProgramSuffix(partner.partnerCode);
    return this.prisma.partnerProgram.create({
      data: {
        partnerProgramCode: suffix,
        partnerId,
        programId: dto.programId,
        name: dto.name,
        degreeLevel: dto.degreeLevel,
        major: dto.major,
        intake: dto.intake,
        tuition: dto.tuition,
        tuitionCurrency: dto.tuitionCurrency,
        scholarshipInfo: dto.scholarshipInfo,
        admissionsRule: dto.admissionsRule,
      },
    });
  }

  async update(id: string, dto: UpdatePartnerProgramDto): Promise<PartnerProgram> {
    await this.findOrThrow(id);
    if (dto.programId) {
      const program = await this.prisma.program.findUnique({ where: { id: dto.programId } });
      if (!program) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: `Program ${dto.programId} not found.` });
    }
    return this.prisma.partnerProgram.update({
      where: { id },
      data: {
        programId: dto.programId,
        name: dto.name,
        degreeLevel: dto.degreeLevel,
        major: dto.major,
        intake: dto.intake,
        tuition: dto.tuition,
        tuitionCurrency: dto.tuitionCurrency,
        scholarshipInfo: dto.scholarshipInfo,
        admissionsRule: dto.admissionsRule,
        status: dto.status,
      },
    });
  }

  async archive(id: string): Promise<PartnerProgram> {
    await this.findOrThrow(id);
    return this.prisma.partnerProgram.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  private async assertPartnerExists(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException({ code: 'PARTNER_NOT_FOUND', message: `Partner ${partnerId} not found.` });
    return partner;
  }

  private async findOrThrow(id: string): Promise<PartnerProgram> {
    const program = await this.prisma.partnerProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException({ code: 'PARTNER_PROGRAM_NOT_FOUND', message: `Partner program ${id} not found.` });
    return program;
  }
}
